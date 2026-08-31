/**
 * 仪表盘域跨层实体（页面、组件与 service 共用的 ViewModel）。
 * 统计口径为调度聚合数据，与任务/车辆详情页的明细实体相互独立。
 */

/** 车辆运行状态（仪表盘聚合口径） */
export type VehicleRuntimeState = 'IDLE' | 'RUNNING' | 'CHARGING' | 'ALARM' | 'OFFLINE'

/** 任务类型分布口径（在任务域 WORK/PARK 基础上补充调度派生类型） */
export type DashboardOrderType = 'WORK' | 'PARK' | 'CHARGE' | 'MOVE'

/** 告警级别 */
export type AlarmLevel = 'ERROR' | 'WARN' | 'INFO'

/** 单个 KPI 指标：当前值 + 较昨日同时段变化（百分比，正为增加；null 表示无对比基数） */
export interface DashboardKpiMetric {
  value: number
  deltaPercent: number | null
}

/** 顶部 KPI 概览 */
export interface DashboardKpi {
  todayOrders: DashboardKpiMetric
  processing: DashboardKpiMetric
  queued: DashboardKpiMetric
  completionRate: DashboardKpiMetric
  onlineVehicles: DashboardKpiMetric
  activeAlarms: DashboardKpiMetric
}

/** 24 小时滚动窗口趋势点（time 形如 'YYYY-MM-DD HH:00'） */
export interface HourlyTrendPoint {
  time: string
  created: number
  completed: number
}

/** 单日任务统计（date 形如 'YYYY-MM-DD'） */
export interface DailyOrderStat {
  date: string
  completed: number
  failed: number
}

/** 车辆状态分布切片 */
export interface VehicleStatusSlice {
  state: VehicleRuntimeState
  count: number
}

/** 任务类型分布切片 */
export interface OrderTypeSlice {
  orderType: DashboardOrderType
  count: number
}

/** 车辆任务排行项 */
export interface VehicleTaskRankItem {
  vehicleName: string
  groupName: string
  completedCount: number
}

/** 最新告警项 */
export interface RecentAlarmItem {
  id: number
  level: AlarmLevel
  alarmCode: string
  vehicleName: string
  message: string
  raisedAt: string
}

/** 仪表盘聚合数据（一次请求返回全部统计块） */
export interface DashboardOverview {
  kpi: DashboardKpi
  hourlyTrend: HourlyTrendPoint[]
  dailyStats: DailyOrderStat[]
  vehicleStatus: VehicleStatusSlice[]
  orderTypes: OrderTypeSlice[]
  vehicleRank: VehicleTaskRankItem[]
  recentAlarms: RecentAlarmItem[]
  /** 数据生成时间 'YYYY-MM-DD HH:mm:ss' */
  generatedAt: string
}
