/**
 * Dashboard 业务域实体（AGV 调度概览）：
 * 被 pages/features/constants 跨层共享的权威定义。
 * 纯前端模式下数据来自 dashboard.demoData 的确定性演示数据，
 * 后续接入真实后端时同名结构由 dashboard service 填充。
 */

/** 统计卡与仪表盘数值：计数均为非负整数，时长单位为分钟，比率单位为百分比（保留一位小数） */
export interface AgvDashboardStats {
  /** AGV 总数 */
  agvTotal: number
  /** 当前在线 AGV 数（含运行/待命/充电/故障，不含离线） */
  agvOnline: number
  /** 今日下发任务总数 */
  todayTaskCount: number
  /** 今日已完成任务数 */
  todayCompletedCount: number
  /** 今日平均任务时长（分钟） */
  avgTaskDurationMin: number
  /** 今日异常告警数 */
  todayAlarmCount: number
  /** 昨日下发任务总数（环比基数） */
  yesterdayTaskCount: number
  /** 昨日任务完成率（百分比，保留一位小数） */
  yesterdayCompletionRate: number
  /** 昨日平均任务时长（分钟） */
  yesterdayAvgTaskDurationMin: number
  /** 昨日异常告警数 */
  yesterdayAlarmCount: number
}

/** 24H 任务吞吐序列项：hour 为小时起点标签（如 08:00），序列按时间升序 */
export interface AgvHourlyThroughputItem {
  hour: string
  /** 该小时下发任务数 */
  dispatched: number
  /** 该小时完成任务数 */
  completed: number
}

/** AGV 状态分布项：status 为状态文案 key（经 dashboard 命名空间翻译） */
export interface AgvStatusItem {
  status: string
  count: number
}

/** 区域任务量分布项：area 为区域文案 key（经 dashboard 命名空间翻译） */
export interface AgvAreaTaskItem {
  area: string
  taskCount: number
}

/** AGV 利用率排行项：rate 为百分比（0-100，保留一位小数），序列按利用率降序 */
export interface AgvUtilizationItem {
  agvCode: string
  rate: number
}

/** 任务类型分布项：typeName 为类型文案 key（经 dashboard 命名空间翻译） */
export interface AgvTaskTypeItem {
  typeName: string
  taskCount: number
}

/** 区域 × 时段热力数据项：slot 为两小时时段起点标签（如 08:00），taskCount 为该格任务量 */
export interface AgvHeatmapPoint {
  area: string
  slot: string
  taskCount: number
}

/** 仪表盘快照：页面全部图表与统计卡的输入 */
export interface AgvDashboardSnapshot {
  stats: AgvDashboardStats
  /** 近 12 小时在线 AGV 数（升序，末位与 stats.agvOnline 一致） */
  onlineTrend: number[]
  /** 近 12 小时累计下发任务数（升序，末位与 stats.todayTaskCount 一致） */
  cumulativeTaskTrend: number[]
  /** 近 12 小时平均任务时长·分钟（末位与 stats.avgTaskDurationMin 一致） */
  durationTrend: number[]
  /** 近 12 小时异常告警数（末位与 stats.todayAlarmCount 一致） */
  alarmTrend: number[]
  hourlyThroughput: AgvHourlyThroughputItem[]
  statusDistribution: AgvStatusItem[]
  areaTaskLoad: AgvAreaTaskItem[]
  utilizationRanking: AgvUtilizationItem[]
  taskTypeDistribution: AgvTaskTypeItem[]
  areaSlotHeatmap: AgvHeatmapPoint[]
}
