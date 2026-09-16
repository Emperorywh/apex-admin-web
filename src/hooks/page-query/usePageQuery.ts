/**
 * 页面统一查询控制器（T010 交付）：可见性驱动的查询、过期响应隔离与轮询。
 *
 * 职责边界（SPEC §6.3/§9.2）：
 * - 只管“读”：写入、设备指令、上传下载归 T011 会话任务层，本控制器绝不接管；
 * - 可见性 = Activity 激活（页签可见）∧ document 可见；两者任一不满足即暂停，
 *   恢复后立即发起一次请求，不积攒隐藏期间的轮询任务；
 * - 过期响应隔离：每次发起为新“代”，仅最新一代可落地；条件切换同时中止上一代请求；
 * - 轮询以“上次请求落定”为基准重排，同一查询任一时刻至多一个在途请求、一个定时器；
 * - 取消不是失败；连续失败仅在状态中计数并暴露，弹窗去重由错误事件层负责。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'
import { isCancelledError, toApiError } from '@/services/request/request'
import type { ApiError } from '@/services/request/request.types'
import {
  pollingGapMs,
  type UsePageQueryOptions,
  type UsePageQueryResult,
} from '@/hooks/page-query/pageQuery.types'
import { useDocumentVisible } from '@/hooks/page-query/useDocumentVisible'

/** 无 scope 场景（登录页等）：视为始终可见，无取消信号联动 */
const IDLE_SIGNAL = new AbortController().signal

export function usePageQuery<TParams, TData>(
  options: UsePageQueryOptions<TParams, TData>,
): UsePageQueryResult<TData> {
  const { params, polling, enabled = true } = options

  const scope = useRequestScope()
  const scopeSignal = scope?.signal ?? IDLE_SIGNAL
  const activityVisible = scope?.isActive ?? true
  const documentVisible = useDocumentVisible()
  /** 完整可见性：应用页签（Activity）与浏览器页签（document）都可见 */
  const visible = activityVisible && documentVisible

  /* 可变依赖统一走 ref：fetcher/polling 每次渲染可能变化，不应触发重新请求 */
  const fetcherRef = useRef(options.fetcher)
  fetcherRef.current = options.fetcher
  const pollingRef = useRef(polling)
  pollingRef.current = polling
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  /** 最新查询条件：issue 经 ref 读取，编排 effect 只依赖条件键 */
  const paramsRef = useRef(params)
  paramsRef.current = params

  /** 条件键：JSON 序列化判定“条件是否变化”，避免要求消费方记忆化 */
  const paramsKey = useMemo(() => stableKey(params), [params])

  /** 手动刷新令牌：reload 时 +1，驱动编排 effect 重新发起 */
  const [reloadToken, setReloadToken] = useState(0)

  /* 请求代际：只递增不重置，任何时刻只有 genRef 指向的“最新代”允许落地 */
  const genRef = useRef(0)
  /** 当前在途请求的中止控制器（代际推进/编排清理时中止上一代） */
  const abortRef = useRef<AbortController | null>(null)
  /** 轮询定时器：任一时刻至多一个 */
  const timerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  const [data, setData] = useState<TData | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [failureCount, setFailureCount] = useState(0)
  const [pending, setPending] = useState(() => enabled && visible)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /** issue 的稳定引用：轮询落定回调中经 ref 间接调用，避免闭包捕获过期 issue */
  const issueRef = useRef<() => void>(() => {})

  /**
   * 发起一次查询：新代际、中止上一代在途请求；取消或过期响应不落地。
   * 仅由编排 effect 与轮询定时器调用，同一 effect 内串行，天然不并发堆叠。
   */
  const issue = useCallback(() => {
    /* scope 信号已中止（如刚从隐藏恢复、控制器尚未换新）：跳过本次，
       待控制器换新后 scopeSignal 变化会再次触发编排 effect，用新信号发请求 */
    if (scopeSignal.aborted) return

    const generation = ++genRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    /* scope 取消（页签隐藏/刷新/关闭、缓存淘汰）联动本请求 */
    if (scopeSignal !== IDLE_SIGNAL) {
      scopeSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    setPending(true)
    void fetcherRef
      .current(paramsRef.current, { signal: controller.signal })
      .then((result) => {
        if (!mountedRef.current || generation !== genRef.current) return
        setData(result)
        setError(null)
        setFailureCount(0)
      })
      .catch((caught) => {
        if (!mountedRef.current || generation !== genRef.current) return
        if (isCancelledError(caught)) return
        setError(toApiError(caught))
        setFailureCount((count) => count + 1)
      })
      .finally(() => {
        if (!mountedRef.current || generation !== genRef.current) return
        setPending(false)
        /* 落定后按策略重排下一次轮询；不可见/停用时暂停，
           恢复可见由编排 effect 立即请求，这里不排定时器（不积攒隐藏期间任务） */
        const policy = pollingRef.current
        if (policy && visibleRef.current && enabledRef.current) {
          clearTimer()
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null
            issueRef.current()
          }, pollingGapMs(policy))
        }
      })
  }, [scopeSignal, clearTimer])

  issueRef.current = issue

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  /**
   * 编排 effect：请求的发起与清理的唯一入口。
   * 触发时机：条件变化 / scope 信号更换（页签刷新、隐藏后恢复）/ 可见性切换 /
   * enabled 切换 / 手动刷新。暂停分支清理在途与定时器；恢复时立即请求。
   */
  useEffect(() => {
    if (!enabledRef.current || !visibleRef.current) {
      /* 暂停：取消在途、撤销待发轮询；已有数据与错误态原样保留（页面降级展示） */
      abortRef.current?.abort()
      abortRef.current = null
      clearTimer()
      setPending(false)
      return undefined
    }
    issueRef.current()
    return () => {
      /* 条件切换/隐藏/卸载：中止本轮在途请求并撤销待发轮询，
         上一代响应因代际失配不会落地（SPEC §6.3 过期响应防护） */
      abortRef.current?.abort()
      abortRef.current = null
      clearTimer()
    }
    /* scopeSignal 为对象引用：页签恢复/刷新时更换为未中止的新信号，即“恢复立即请求”入口 */
  }, [paramsKey, scopeSignal, visible, enabled, reloadToken, clearTimer])

  /* 挂载/卸载标记：卸载（关闭页签、LRU 淘汰）后任何响应都不再落地 */
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return {
    data,
    loading: pending && data === null,
    refreshing: pending && data !== null,
    error,
    failureCount,
    reload,
  }
}

/** 条件键：纯数据条件直接序列化；异常输入（函数/循环引用）退化为引用身份键 */
const fallbackKeys = new WeakMap<object, string>()
let fallbackSeq = 0

function stableKey(params: unknown): string {
  if (params === null || typeof params !== 'object') return String(params)
  try {
    return JSON.stringify(params) ?? 'null'
  } catch {
    const cached = fallbackKeys.get(params)
    if (cached) return cached
    const key = `__ref__${++fallbackSeq}`
    fallbackKeys.set(params, key)
    return key
  }
}
