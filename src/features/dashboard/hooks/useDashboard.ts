/**
 * Dashboard 概览数据 Hook（规格 §14.2/§15）：页面数据统一来自 GET /dashboard/overview。
 * 请求经 usePageRequest() 注入页签作用域（规格 §7.4-6），页签隐藏/关闭/淘汰时统一取消；
 * 失败提示由请求层统一弹出（非 silent，规格 §7.4-3），取消静默（规格 §7.4-9），
 * 本 Hook 只收敛数据/加载/重试状态；已加载数据在页签隐藏期间由 Activity 保留。
 */
import { useCallback, useEffect, useState } from 'react'
import { usePageRequest } from '@/hooks/usePageRequest'
import { getDashboardOverview } from '@/services/dashboard/dashboard.service'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'

export interface UseDashboardResult {
  /** 概览数据；首次成功前为 null */
  overview: DashboardOverview | null
  /** 加载中：首次进入与手动刷新期间为 true */
  loading: boolean
  /** 手动刷新：失败后由页面重试入口再次调用 */
  refresh: () => Promise<void>
}

export function useDashboard(): UseDashboardResult {
  const pageRequest = usePageRequest()
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getDashboardOverview(pageRequest)
      setOverview(data)
    } catch {
      // 取消静默（规格 §7.4-9）；真实失败的提示由请求层统一弹出，这里保留现有数据态供重试
    } finally {
      setLoading(false)
    }
  }, [pageRequest])

  useEffect(() => {
    void load()
  }, [load])

  return { overview, loading, refresh: load }
}
