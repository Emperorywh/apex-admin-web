/**
 * 一次性全量只读选项的统一加载 hook（T00.7 共享选项契约）。
 *
 * 适用范围：GET 无参/简单参数、返回完整集合的跨页只读选项
 * （getSimpleVehicles / getAGVActions / getRoles / getElevators /
 *   getOrderTemplates / getSimpleMaps / getVehicleGroups / get*Drivers 等，
 *   唯一 operation 清单见 docs/migration/contracts.md 第 5 节）。
 * 分页业务查询、页面私有查询不用本 hook（各自页面任务实现）。
 *
 * 行为契约（与请求层/表格语义一致）：
 * - 取消：AbortSignal 取自页签请求 scope——切页/刷新/关页自动中止在途请求，
 *   主动取消静默（不报错、不判离线）；
 * - 防乱序：仅接受最后一次发起的结果，旧响应不覆盖新状态；
 * - 真正失败：立即清空 options（不留旧数据冒充成功）+ error=true，
 *   页面据此渲染 StateBlock offline 或禁用依赖操作；错误文案可经
 *   apiErrorMessage 还原；
 * - fetcher 引用经 ref 消费：调用方无需为 fetcher 稳定性操心（内联闭包安全），
 *   effect 只由 enabled / scope.revision 驱动；
 * - 语言切换：i18next 语言变化会改变服务端返回文案时，由消费方把语言
 *   加入 deps 触发重查（本 hook 不自动监听，避免选项页无谓重放）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { isCancelledError } from '@/services/request/request'
import { usePageRequest } from '@/hooks/usePageRequest'

export interface StaticOptionsState<T> {
  /** 选项集合；加载中保留 null 区分"尚未加载"与"真实空集合" */
  options: T[] | null
  loading: boolean
  /** 最近一次加载是否真正失败（取消不算；重载成功自动复位） */
  error: boolean
  /** 显式重载（失败重试按钮 / 操作成功后刷新选项） */
  reload: () => void
}

export function useStaticOptions<T>(
  /** 返回完整选项集合的只读查询；实现必须把收到的 signal 传给请求层 */
  fetcher: (signal: AbortSignal) => Promise<T[]>,
  /** false 时不发起请求（如未选定地图时地图节点选项不加载） */
  enabled: boolean = true,
): StaticOptionsState<T> {
  // 解构出 signal 与 revision：signal 引用在 scope 生命周期内稳定，
  // 可安全进入 effect 依赖（scope 更换时 signal 引用变化正是重启时机）
  const { signal: scopeSignal, revision: scopeRevision } = usePageRequest()

  // options === null 表示"尚未成功加载"；[] 仅代表后端确认的空集合
  const [options, setOptions] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)

  // fetcher 经 ref 消费：调用方内联闭包不会重启请求循环
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  // 计数器实现防乱序：仅最后一次发起的响应允许落库
  const seqRef = useRef(0)

  const load = useCallback(
    async (signal: AbortSignal) => {
      const seq = ++seqRef.current
      setLoading(true)
      setError(false)
      try {
        const list = await fetcherRef.current(signal)
        if (seq !== seqRef.current || signal.aborted) return
        setOptions(list)
        setError(false)
      } catch (err) {
        // 主动取消静默：不置 error、不改 options（新 scope 重建后由 effect 重查）
        if (isCancelledError(err) || signal.aborted) return
        if (seq !== seqRef.current) return
        // 真正失败：清空远端区域（DoD 6），保留调用方本地状态不受影响
        setOptions([])
        setError(true)
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!enabled) {
      // 条件未满足：清空在途状态，避免残留旧选项与错误标记
      seqRef.current += 1
      setOptions(null)
      setLoading(false)
      setError(false)
      return
    }
    const controller = new AbortController()
    // 页签 scope 中止（切页/关页/刷新）时同步终止本次选项请求
    const onScopeAbort = () => controller.abort()
    scopeSignal.addEventListener('abort', onScopeAbort)
    void load(controller.signal)
    return () => {
      controller.abort()
      scopeSignal.removeEventListener('abort', onScopeAbort)
    }
  }, [enabled, scopeSignal, scopeRevision, load])

  const reload = useCallback(() => {
    void load(new AbortController().signal)
  }, [load])

  return { options, loading, error, reload }
}
