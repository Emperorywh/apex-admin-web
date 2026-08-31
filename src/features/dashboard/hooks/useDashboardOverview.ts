/**
 * 仪表盘数据 Hook：拉取聚合统计，随页面请求 scope 取消；
 * 页签处于激活态时每 30 秒静默轮询，异常时可通过 reload 重试。
 */

import { useCallback, useEffect, useState } from 'react'
import { usePageActive } from '@/hooks/usePageActive'
import { usePageRequest } from '@/hooks/usePageRequest'
import { getDashboardOverview } from '@/services/dashboard/dashboard.service'
import { isCancelledError, toApiError } from '@/services/request/request'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'

/** 自动刷新间隔（毫秒） */
const AUTO_REFRESH_INTERVAL_MS = 30_000

export interface UseDashboardOverviewResult {
  overview: DashboardOverview | null
  /** 首次加载（尚无数据可展示） */
  loading: boolean
  error: string | null
  reload: () => void
}

export function useDashboardOverview(): UseDashboardOverviewResult {
  const { signal, revision } = usePageRequest()
  const { isActive } = usePageActive()
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let active = true
    setError(null)
    getDashboardOverview({ signal })
      .then((data) => {
        if (!active) return
        setOverview(data)
        setLoading(false)
      })
      .catch((caught) => {
        if (!active || isCancelledError(caught)) return
        setError(toApiError(caught).title)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [signal, revision, reloadToken])

  /* 页签隐藏（Activity hidden）时暂停轮询，激活轮次变化后重排定时器 */
  useEffect(() => {
    if (!isActive) return undefined
    const timer = window.setInterval(() => setReloadToken((token) => token + 1), AUTO_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [isActive])

  return { overview, loading, error, reload }
}
