/**
 * Dashboard 业务域常量（规格 §14.1/§14.3）：概览接口与图表日期格式。
 * dashboard service、图表组件与 demo adapter 一律引用本文件。
 */

/** Dashboard 接口路径（规格 §14.3：GET /dashboard/overview → DashboardOverview） */
export const DASHBOARD_ENDPOINTS = {
  OVERVIEW: '/dashboard/overview',
} as const

/**
 * 图表序列日期格式（规格 §14.1）。
 * loginTrend/userGrowth 的 date 使用 YYYY-MM-DD，序列按日期升序。
 */
export const DASHBOARD_DATE_FORMAT = 'YYYY-MM-DD'
