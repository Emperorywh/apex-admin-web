/**
 * 仪表盘服务 DTO（P34 合并业务首页；owner=P34，contracts.md 实时看板节）。
 *
 * 与 OpenAPI schema 逐字段核对（基线 SHA-256 A82E9B5F…49C7C，本轮复核未变化）：
 * - DashboardParam / DashboardBoardVO / OrderStatistics / HourlyCount /
 *   VehicleStatistics（POST /fms/v1/dispatcher/dashboard/board）
 * - SystemAlarmRecordPageParamSystemAlarmRecord / PageSystemAlarmRecord /
 *   SystemAlarmRecord / ErrorModel / Translation
 *   （POST /fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords）
 *
 * 字段纪律：
 * - int64 计数字段按 JSON number 承载（G10，与 P21/P22/P33 同口径：
 *   本页数量级为计数与秒数，无精度风险）；
 * - 后端时间字符串（hourTime/startTime 等）原样保留为 string，
 *   解析统一走 @/utils/datetime（部署时区口径），本层不做时间换算；
 * - 可选字段如实声明为可选：后端对无数据字段可能不下发，
 *   消费方（features/dashboard/realtime.ts 纯计算）按「缺失 ≠ 0」纪律处理。
 */

/** 看板查询参数（DashboardParam）：days 统计天数，缺省 2 = 昨天 + 今天 */
export interface DashboardBoardParam {
  /** 订单统计天数（int32）；本页固定 2，覆盖今日 KPI 与昨日同时刻基线 */
  days: number
}

/** 每小时订单统计（HourlyCount）：创建/完成口径的原始小时行，汇总由前端完成 */
export interface HourlyCountDto {
  /** 小时时间（date-time，实测形如 yyyy-MM-ddTHH:00:00，部署时区墙钟） */
  hourTime?: string
  /** 该小时创建的订单数 */
  created?: number
  /** 该小时完成的订单数（完成口径，趋势图与平均每小时指标使用） */
  succeeded?: number
  /** 该小时取消的订单数 */
  cancelled?: number
  /** 该小时失败的订单数 */
  failed?: number
  /** 该小时创建的已完成订单数（创建口径，完成率/平均耗时分母） */
  createdSucceededCount?: number
  /** 该小时创建的已完成订单总耗时（秒，double；平均耗时分子） */
  createdSucceededDurationSeconds?: number
}

/** 订单侧聚合（OrderStatistics）：小时行集合 + 当前积压快照 */
export interface OrderStatisticsDto {
  /** 每小时订单统计（按小时时间升序，覆盖统计天数；缺失小时不下发） */
  hourlyCounts?: HourlyCountDto[]
  /** 当前任务积压（队列中的订单数，快照直读） */
  queueOrderCount?: number
}

/** 车辆侧聚合（VehicleStatistics）：五类状态 + 在线/总数快照 */
export interface VehicleStatisticsDto {
  /** AGV 总数 */
  totalVehicleCount?: number
  /** 在线 AGV 数 */
  onlineVehicleCount?: number
  /** 运行中 AGV 数 */
  runningCount?: number
  /** 空闲 AGV 数 */
  idleCount?: number
  /** 充电中 AGV 数 */
  chargingCount?: number
  /** 故障 AGV 数 */
  faultCount?: number
  /** 离线 AGV 数 */
  offlineCount?: number
}

/** 看板聚合响应体（DashboardBoardVO） */
export interface DashboardBoardDto {
  /** 订单侧数据 */
  order?: OrderStatisticsDto
  /** 车侧数据 */
  vehicle?: VehicleStatisticsDto
}

/** 后端翻译条目（Translation）：错误描述多语言（translationKey 形如 zh_CN/en_US） */
export interface TranslationDto {
  translationKey?: string
  translationValue?: string
}

/** 错误模型（ErrorModel）：告警描述原文 + 多语言译文（仅展示用） */
export interface ErrorModelDto {
  errorType?: string
  errorDescription?: string
  errorDescriptionTranslations?: TranslationDto[]
}

/** 系统告警记录（SystemAlarmRecord）：本页仅消费未关闭告警的展示字段 */
export interface SystemAlarmRecordDto {
  /** 记录 ID（int64，JSON number 承载，G10 同口径） */
  id?: number
  /** 告警来源（VEHICLE/DEVICE/SERVER） */
  sourceType?: string
  /** 告警来源标识（车辆 key/设备 key 等；导航 /vehicle-info 的实体参数） */
  sourceKey?: string
  /** 告警来源名称（展示优先于 sourceKey） */
  sourceName?: string
  /** 告警码 */
  alarmCode?: string
  /** 告警类型（后端自由字符串，原样展示不臆译） */
  alarmType?: string
  /** 告警级别（WARNING/FATAL，未知值按协议原值展示） */
  alarmLevel?: string
  /** 关联订单 key（导航 /order-info 的实体参数） */
  orderKey?: string
  /** 关联订单名称 */
  orderName?: string
  /** 告警开始时间（date-time 墙钟字符串；未关闭告警持续时长据此现算） */
  startTime?: string
  /** 告警结束时间（未关闭告警不下发） */
  endTime?: string
  /** 持续时长（秒，未关闭告警不下发） */
  durationSeconds?: number
  /** 是否已关闭（本页固定按 isClosed=false 查询） */
  isClosed?: boolean
  /** 错误模型（描述原文 + 多语言） */
  errorModel?: ErrorModelDto
}

/** 告警分页响应体（PageSystemAlarmRecord，MyBatis-Plus 分页形态） */
export interface PageSystemAlarmRecordDto {
  records?: SystemAlarmRecordDto[]
  /** 总数（int64）；本页仅取第一页作滚动列表，不消费总数分页 */
  total?: number
  current?: number
  size?: number
  pages?: number
}
