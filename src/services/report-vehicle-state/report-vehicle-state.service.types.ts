/**
 * 车辆状态统计报表 DTO（P37 整页交付；owner=P37，contracts.md 车辆报表节）。
 *
 * 协议来源：OpenAPI schemas AgvStateStatisticsParam / AgvExecutingTimeStatisticsVO /
 * VehicleExecutingDuration / AgvStateStatisticsVO / DailyStateDuration，
 * 与旧实现消费结构（C:\code\dd src/types/AnalyzeVisual/VehicleStateStatistics.d.ts）
 * 逐字段核对一致。响应壳 code/message/timestamp/data 由请求层统一解包后进入本层类型。
 *
 * 注意（协议口径）：VehicleStatisticState 是「报表聚合状态」枚举，与车辆实时
 * 状态（vehicleProcStatus / RobotStatus）不同——后端按此枚举做时长聚合统计，
 * 两者不可混用（旧类型定义注释同口径）。
 */

/** 车辆统计状态协议枚举（OpenAPI states.items.enum，13 值；顺序即后端声明顺序） */
export type VehicleStatisticState =
  | 'ONLINE' // 在线
  | 'OFFLINE' // 离线
  | 'IDLE' // 空闲
  | 'EXECUTING_WORK' // 执行作业
  | 'EXECUTING_CHARGE' // 执行充电
  | 'EXECUTING_PARK' // 执行停靠
  | 'TRAFFIC' // 交管等待
  | 'PAUSED' // 暂停
  | 'AVOID' // 避让
  | 'BRAKE' // 制动
  | 'WARNING' // 告警
  | 'ERROR' // 异常
  | 'CHARGING' // 充电中

/**
 * 车辆状态统计查询参数（AgvStateStatisticsParam）。
 * 两个车辆报表 operation 共用该请求体：
 * - POST /report/vehicleStatisticsReport/agvExecutingTimeStatistics（每车×每状态）
 * - POST /report/vehicleStatisticsReport/agvStateStatistics（每日聚合，P35 消费）
 */
export interface VehicleStateStatisticsParam {
  /** 开始时间（"yyyy-MM-dd HH:mm:ss"，部署时区墙钟，规格 11.3） */
  startTime?: string
  /** 结束时间（同上；byHour=true 时与起点跨度不得超过 24 小时，后端限制） */
  endTime?: string
  /** 是否按小时维度统计（小时维度时时间范围不能超过 24 小时） */
  byHour?: boolean
  /** 车辆集合（空 = 全部车辆；本页不提供车辆筛选，保留协议形状） */
  vehicleKeys?: string[]
  /** 状态集合（空 = 统计所有状态；服务层归一化为不传参，旧实现同口径） */
  states?: VehicleStatisticState[]
}

/** 每车各状态总时长行（VehicleExecutingDuration；int64 秒按 JSON number 承载，G10） */
export interface VehicleExecutingDurationDto {
  /** 车辆唯一标识 */
  vehicleKey?: string
  /** 车辆名称（展示名优先，空时回退 vehicleKey——旧实现同口径） */
  vehicleName?: string
  /** 车辆统计状态（未知枚举防御性显示协议原值，不臆造映射） */
  state?: VehicleStatisticState
  /** 该状态执行总时长（秒，int64） */
  totalDurationSeconds?: number
}

/** 每车各状态总时长统计 VO（AgvExecutingTimeStatisticsVO；P37 页面主接口） */
export interface AgvExecutingTimeStatisticsVo {
  /** 每车各状态总时长统计（每车×每状态一行，车辆顺序为接口下发顺序） */
  vehicleExecutingDurations?: VehicleExecutingDurationDto[]
}

/**
 * 每日状态时长统计行（DailyStateDuration；按天升序，每天一条汇总记录）。
 * P35 任务统计报表消费该维度（利用率趋势/当天车辆数），P37 建立共享服务层。
 */
export interface DailyStateDurationDto {
  /** 日期（当天 00:00:00，date-time） */
  date?: string
  /** 当天所选状态合计总时长（秒，int64；已含参与车辆的累计，无需再按状态求和） */
  totalDurationSeconds?: number
  /** 当天有该批状态记录的车辆数量（vehicleKey 去重；与有效秒数相乘为平均利用率分母） */
  vehicleCount?: number
}

/** 每日状态时长统计 VO（AgvStateStatisticsVO；P35 消费，本任务仅交付服务层） */
export interface AgvStateStatisticsVo {
  /** 每日时长统计（按天升序；参数指定的状态聚合为一条；利用率由前端计算） */
  dailyStateDurations?: DailyStateDurationDto[]
}
