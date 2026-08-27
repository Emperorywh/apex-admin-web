/**
 * 仪表盘数据 Hook：随页面请求 scope 取消，支持手动刷新。
 */

import { useCallback, useEffect, useState } from 'react'
import { usePageRequest } from '@/hooks/usePageRequest'
import { getDashboardOverview } from '@/services/dashboard/dashboard.service'
import { isCancelledError, toApiError } from '@/services/request/request'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'

export interface UseDashboardResult {
  data: DashboardOverview | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useDashboard(): UseDashboardResult {
  const { signal } = usePageRequest()
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const overview = await getDashboardOverview({ signal })
      setData(overview)
    } catch (caught) {
      if (isCancelledError(caught)) return
      setError(toApiError(caught).title)
    } finally {
      setLoading(false)
    }
  }, [signal])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
