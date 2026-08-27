/**
 * 仪表盘域跨层 ViewModel（服务端无对应端点，由 dashboard.service 的演示数据映射）。
 */

export type TrendDirection = 'up' | 'down' | 'flat'

/** KPI 指标卡 */
export interface KpiMetric {
  id: string
  label: string
  value: string
  /** 值内嵌的单位片段（如 "万"），以更小字号渲染 */
  unit?: string
  footer: string
  trend: TrendDirection
  trendText?: string
  /** sparkline 路径（viewBox 160x56） */
  sparkPath: string
}

export type WorkflowNodeState = 'done' | 'running' | 'pending'

/** 流程编排节点 */
export interface WorkflowNode {
  id: string
  name: string
  volume: string
  state: WorkflowNodeState
  /** 相对画布的定位（px，画布宽 640） */
  left: number
  top: number
}

/** 流程连线（画布坐标路径） */
export interface WorkflowEdge {
  path: string
  color: string
}

/** 流程连接圆点（画布坐标） */
export interface WorkflowDot {
  x: number
  y: number
  color: string
}

export interface WorkflowPanelModel {
  version: string
  runningFor: string
  performancePercent: number
  chainPercent: string
  stageLabels: string[]
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  dots: WorkflowDot[]
}

/** 资源拓扑健康项 */
export interface TopologyHealthItem {
  id: string
  name: string
  ready: string
}

export interface TopologyRegion {
  id: string
  name: string
  sub: string
  /** SVG 画布坐标（viewBox 420x252） */
  x: number
  y: number
}

export interface TopologyPanelModel {
  score: number
  scoreLabel: string
  healthItems: TopologyHealthItem[]
  regions: TopologyRegion[]
}

export type AlertSeverity = 'P1' | 'P2' | 'P3'

/** 最近告警行 */
export interface AlertItem {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
  target: string
  occurredAt: string
}

/** 日程待办 */
export interface ScheduleTodo {
  id: string
  time: string
  title: string
}

/** 日程面板模型：当月日历 + 待办 */
export interface SchedulePanelModel {
  year: number
  month: number
  today: number
  todos: ScheduleTodo[]
}

export type EventLevel = 'info' | 'warn' | 'error'

/** 实时事件 */
export interface EventItem {
  id: string
  time: string
  title: string
  lines: string[]
  level: EventLevel
}

/** 仪表盘整页聚合模型 */
export interface DashboardOverview {
  kpis: KpiMetric[]
  workflow: WorkflowPanelModel
  topology: TopologyPanelModel
  schedule: SchedulePanelModel
  alerts: AlertItem[]
  events: EventItem[]
  /** 未处理告警数 */
  alertCount: number
}
