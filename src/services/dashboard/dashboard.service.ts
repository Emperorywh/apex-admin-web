/**
 * 仪表盘服务：一次返回调度统计聚合数据（KPI / 趋势 / 分布 / 告警）。
 * 当前为 mock 实现（见 dashboard.mock.ts）；接入调度后端时保留函数签名，
 * 替换为真实统计接口（走 request 实例）并解包响应即可。
 */

import { CanceledError } from 'axios'
import type { RequestOptions } from '@/services/request/request.types'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'
import { MOCK_DASHBOARD_LATENCY_MS, buildMockDashboardOverview } from '@/services/dashboard/dashboard.mock'

export function getDashboardOverview(options?: RequestOptions): Promise<DashboardOverview> {
  const { signal } = options ?? {}
  if (signal?.aborted) return Promise.reject(new CanceledError('canceled'))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve(buildMockDashboardOverview())
    }, MOCK_DASHBOARD_LATENCY_MS)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new CanceledError('canceled'))
    }
    signal?.addEventListener('abort', onAbort)
  })
}
