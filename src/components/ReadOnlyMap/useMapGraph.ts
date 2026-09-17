/**
 * 地图图形数据加载 hook（T00.7）。
 *
 * 与通用选项 hook（useStaticOptions）同一套失败语义，差异点：
 * - 数据形状是 MapGraph（nodes+edges），而非选项数组；
 * - 失败时携带可展示错误文本（apiErrorMessage 还原），供组件渲染
 *   StateBlock offline 与重试；
 * - 主动取消（页签关闭/刷新/换图）静默：不置 error、不提示；
 * - 防乱序：仅最后一次发起的结果落库（快速切换 mapId 时旧响应不覆盖）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { fetchMapGraph } from '@/services/map/map.service'
import type { MapGraph } from '@/services/map/map.service.types'
import { usePageRequest } from '@/hooks/usePageRequest'

export interface MapGraphState {
  /** 已加载的地图数据；null 表示尚未成功加载（与真实空地图区分） */
  graph: MapGraph | null
  loading: boolean
  /** 最近一次加载是否真正失败（取消不算） */
  error: boolean
  /** 失败详情（已翻译的可展示文案） */
  errorText: string
  /** 显式重载（失败重试 / 需要最新数据时） */
  reload: () => void
}

export function useMapGraph(mapId: string | undefined): MapGraphState {
  // 解构 signal/revision：signal 引用稳定可进 effect 依赖（scope 更换即重启）
  const { signal: scopeSignal, revision: scopeRevision } = usePageRequest()

  const [graph, setGraph] = useState<MapGraph | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [errorText, setErrorText] = useState('')

  // 防乱序序号：仅最后一次发起的响应允许落库
  const seqRef = useRef(0)

  const load = useCallback(async (id: string, signal: AbortSignal) => {
    const seq = ++seqRef.current
    setLoading(true)
    setError(false)
    setErrorText('')
    try {
      const next = await fetchMapGraph(id, { signal })
      if (seq !== seqRef.current || signal.aborted) return
      setGraph(next)
    } catch (err) {
      // 主动取消静默（换图/切页/关页），不判失败不提示
      if (isCancelledError(err) || signal.aborted) return
      if (seq !== seqRef.current) return
      // 真正失败：清空远端区域（DoD 6），显示错误与重试
      setGraph(null)
      setError(true)
      setErrorText(apiErrorMessage(err) || '地图数据加载失败')
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!mapId) {
      // 无 mapId：清空在途状态，等待调用方给出目标
      seqRef.current += 1
      setGraph(null)
      setLoading(false)
      setError(false)
      setErrorText('')
      return
    }
    const controller = new AbortController()
    const onScopeAbort = () => controller.abort()
    scopeSignal.addEventListener('abort', onScopeAbort)
    void load(mapId, controller.signal)
    return () => {
      controller.abort()
      scopeSignal.removeEventListener('abort', onScopeAbort)
    }
  }, [mapId, scopeSignal, scopeRevision, load])

  const reload = useCallback(() => {
    if (mapId) void load(mapId, new AbortController().signal)
  }, [mapId, load])

  return { graph, loading, error, errorText, reload }
}
