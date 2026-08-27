/**
 * 仪表盘域常量。
 */

/** 概览时间范围选项（展示值，业务上仅影响演示数据口径） */
export const DASHBOARD_RANGE_OPTIONS = ['近 24 小时', '近 7 天', '近 30 天'] as const

export type DashboardRange = (typeof DASHBOARD_RANGE_OPTIONS)[number]

/** 实时事件流演示刷新间隔（毫秒） */
export const EVENT_FEED_PUSH_INTERVAL_MS = 6_000

/** 实时事件流在页面保留的最大条数（容量，条） */
export const EVENT_FEED_MAX_ITEMS = 8
