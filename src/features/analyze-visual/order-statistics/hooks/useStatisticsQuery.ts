/**
 * 统计查询 hook（P33 私有；用户触发的参数化查询，非持续轮询页）。
 *
 * 行为契约（规格 8.2 / DoD 6 / D15）：
 * - 防乱序：新查询出发即中止上一次在途请求（计数器 + AbortController 双保险），
 *   旧响应永不覆盖新状态；
 * - 取消级联：页签请求 scope 中止（切页/关页/刷新重建）时同步终止当前查询，
 *   主动取消静默——不报错、不清数据、不判离线；
 * - 真正失败：立即清空该区域远端数据（data=null）并置 error，筛选条件保留
 *   （失败清理不涉及用户输入）；不用旧数据或空数组冒充成功；
 * - 失败自动恢复：图表是非表格数据块，按按钮纪律不设重试/刷新按钮，恢复依赖
 *   可见状态下的有限退避自动重查（规格 8.2；间隔复用轮询集中配置，上限 3 次，
 *   页签非激活或文档不可见时不自动发请求，错误态如实保留）；
 * - 手动查询（查询按钮）随时可用，成功后自动重查计数归零。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RequestOptions } from '@/services/request/request.types'
import { isCancelledError } from '@/services/request/request'
import { usePageRequest } from '@/hooks/usePageRequest'
import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'
import {
  POLL_BACKOFF_MULTIPLIER,
  POLL_BASE_INTERVAL_MS,
  POLL_MAX_BACKOFF_MS,
} from '@/constants/polling.constants'

/** 失败自动重查上限：有限次退避后停止，避免后端故障期间空转（规格 8.2「有限退避」） */
const MAX_FAILURE_RETRIES = 3

export interface StatisticsQueryResult<P, T> {
  /** 最近一次成功查询的数据；null 表示尚未成功或已因失败清空 */
  data: T | null
  loading: boolean
  /** 最近一次查询是否真正失败（取消不算） */
  error: boolean
  /** 发起一次查询（查询按钮 / 初始加载 / 失败自动重查共用） */
  run: (param: P) => void
}

/**
 * fetcher 与服务层签名同形：服务函数直接传入即可（第二参数为 RequestOptions，
 * 本 hook 注入当前查询级取消信号）。
 */
export function useStatisticsQuery<P, T>(
  fetcher: (param: P, options?: RequestOptions) => Promise<T>,
): StatisticsQueryResult<P, T> {
  const { signal: scopeSignal } = usePageRequest()
  const scope = useRequestScope()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // fetcher 经 ref 消费：调用方无需为引用稳定性操心
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  // 页签激活状态经 ref 消费：自动重查定时器触发时读最新值
  const activeRef = useRef(scope?.isActive ?? true)
  activeRef.current = scope?.isActive ?? true

  // 防乱序计数器 + 查询级取消控制器
  const seqRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  // 失败自动重查：定时器与已重查次数、最近一次查询参数（自动重查沿用同一参数）
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const retryCountRef = useRef(0)
  const lastParamRef = useRef<P | null>(null)

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== undefined) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = undefined
    }
  }, [])

  const run = useCallback(
    (param: P) => {
      lastParamRef.current = param
      clearRetryTimer()
      retryCountRef.current = 0
      // 新查询出发即废弃上一次在途请求（防乱序的核心：旧响应连落库资格都没有）
      controllerRef.current?.abort()
      seqRef.current += 1
      const seq = seqRef.current
      const controller = new AbortController()
      controllerRef.current = controller
      // 页签 scope 中止（切页/关页/刷新）级联取消本次查询
      const onScopeAbort = () => controller.abort()
      scopeSignal.addEventListener('abort', onScopeAbort)

      setLoading(true)
      void (async () => {
        try {
          const result = await fetcherRef.current(param, { signal: controller.signal })
          if (seq !== seqRef.current || controller.signal.aborted) return
          setData(result)
          setError(false)
        } catch (err) {
          // 主动取消静默（页签关闭/新查询接管）：不算失败、不清数据、不调度重查
          if (isCancelledError(err) || controller.signal.aborted) return
          if (seq !== seqRef.current) return
          // 真正失败：清空该请求对应的远端数据区域（DoD 6），筛选条件不受影响
          setData(null)
          setError(true)
          // 失败自动恢复：按可见状态有限退避调度（仅本 hook 职责内，不新增全局轮询）
          if (retryCountRef.current >= MAX_FAILURE_RETRIES) return
          const delay = Math.min(
            POLL_BASE_INTERVAL_MS * POLL_BACKOFF_MULTIPLIER ** retryCountRef.current,
            POLL_MAX_BACKOFF_MS,
          )
          retryCountRef.current += 1
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = undefined
            // 页签非激活或浏览器文档不可见时不自动发请求：错误态如实保留，
            // 恢复可见后由用户查询按钮或下一次失败调度兜底（普通页不承诺后台重查）
            if (!activeRef.current || document.visibilityState !== 'visible') return
            if (lastParamRef.current !== null) run(lastParamRef.current)
          }, delay)
        } finally {
          if (seq === seqRef.current) setLoading(false)
          scopeSignal.removeEventListener('abort', onScopeAbort)
        }
      })()
    },
    [clearRetryTimer, scopeSignal],
  )

  // 卸载（页签关闭/LRU 淘汰）清理：中止在途请求、取消待执行的重查定时器
  useEffect(() => {
    return () => {
      clearRetryTimer()
      controllerRef.current?.abort()
    }
  }, [clearRetryTimer])

  return { data, loading, error, run }
}
