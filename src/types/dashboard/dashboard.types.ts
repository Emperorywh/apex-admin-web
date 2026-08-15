/**
 * Dashboard 业务域实体（规格 §14.1）。
 * 被 pages/features/services 跨层共享的权威定义；
 * 请求/响应 DTO 随 service 任务放入 dashboard.service.types.ts。
 */

/**
 * 图表序列按日期升序，date 使用 YYYY-MM-DD（格式见 dashboard.constants.ts）。
 * 所有计数都是非负整数，percent 使用 0 到 100 的数值。
 */
export interface DashboardOverview {
  stats: {
    userCount: number
    enabledUserCount: number
    roleCount: number
    todayLoginCount: number
  }
  loginTrend: Array<{ date: string; count: number }>
  userGrowth: Array<{ date: string; count: number }>
  roleDistribution: Array<{ roleName: string; count: number; percent: number }>
}
