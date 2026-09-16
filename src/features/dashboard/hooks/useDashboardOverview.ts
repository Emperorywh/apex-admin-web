/**
 * 仪表盘数据 Hook：拉取聚合统计。
 * 查询生命周期统一由 usePageQuery 接管；轮询沿用当前目标实现（30 秒固定间隔，
 * 页签或 document 隐藏自动暂停、恢复立即请求）。源系统实时看板的“完成后 5 秒”
 * 轮询（PAGE_POLLING.realtimeDashboard）归 T084 迁移真实内容时接入。
 */

import { getDashboardOverview } from '@/services/dashboard/dashboard.service'
import { toApiError } from '@/services/request/request'
import { usePageQuery } from '@/hooks/page-query'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'

/** 当前目标实现的自动刷新间隔（毫秒） */
export const AUTO_REFRESH_INTERVAL_MS = 30_000

export interface UseDashboardOverviewResult {
  overview: DashboardOverview | null
  /** 首次加载（尚无数据可展示） */
  loading: boolean
  error: string | null
  reload: () => void
}

export function useDashboardOverview(): UseDashboardOverviewResult {
  const page = usePageQuery({
    fetcher: (_params, { signal }) => getDashboardOverview({ signal }),
    params: null,
    polling: { mode: 'interval', intervalMs: AUTO_REFRESH_INTERVAL_MS },
  })

  return {
    overview: page.data,
    loading: page.loading,
    error: page.error ? toApiError(page.error).title : null,
    reload: page.reload,
  }
}
