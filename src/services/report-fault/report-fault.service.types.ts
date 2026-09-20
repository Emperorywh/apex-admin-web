/**
 * 故障告警报表 DTO（P36 整页交付；owner=P36，contracts.md 系统告警报表节）。
 *
 * 协议来源：OpenAPI schemas AlarmStatisticsParam / AlarmStatisticsVO /
 * SystemAlarmRecordPageParamSystemAlarmRecord / SystemAlarmRecord / ErrorModel，
 * 与旧实现消费结构（C:\code\dd HttpDashboardRepository + SystemAlarmRecord.d.ts）
 * 逐字段核对一致。分页响应壳 records/total 由请求层统一解包后进入本层类型。
 */

/** 告警来源协议枚举（OpenAPI：VEHICLE 车辆 / DEVICE 设备 / SERVER 服务器） */
export type AlarmSourceType = 'VEHICLE' | 'DEVICE' | 'SERVER'

/** 告警级别协议枚举（OpenAPI：仅 FATAL / WARNING 两级） */
export type AlarmLevel = 'FATAL' | 'WARNING'

/**
 * 告警统计聚合查询参数（AlarmStatisticsParam）。
 * 三个时间字段契约均标注 date-time；topAgvDate 后端实测约定
 * "yyyy-MM-dd HH:mm:ss"（截断到天 00:00:00），只传日期会解析失败（旧实现联调实证）。
 */
export interface AlarmStatisticsParam {
  /** 统计窗口开始（"yyyy-MM-dd HH:mm:ss"，部署时区墙钟，规格 11.3） */
  startTime?: string
  /** 统计窗口结束（同上） */
  endTime?: string
  /** 指定日期查 Top10 车辆告警次数（窗口最后一天 00:00:00），不传不查该维度 */
  topAgvDate?: string
  /** 指定车辆（vehicleKey）查每天 Top10 告警；页面无消费场景，不传 */
  topAlarmVehicleKey?: string
}

/** 每日告警统计行（DailyAlarmCount）：按 startTime 所在自然日归天 */
export interface DailyAlarmCountDto {
  /** 日期（当天 00:00:00；兼容 "yyyy-MM-dd HH:mm:ss" 与 "yyyy-MM-ddTHH:mm:ss" 两种分隔） */
  date?: string
  /** 当天关闭的告警数（有 endTime） */
  closedCount?: number
  /** 当天未关闭的告警数（无 endTime） */
  unclosedCount?: number
  /** 当天开始的告警总时长（秒，int64 JSON number 承载——G10 与 P21/P33 同口径） */
  totalDurationSeconds?: number
}

/** 指定日期 Top10 车辆告警行（AgvAlarmCount，后端按次数倒序下发） */
export interface AgvAlarmCountDto {
  /** 车辆唯一标识 */
  vehicleKey?: string
  /** 车辆名称（展示名优先，空时回退 vehicleKey——旧实现同口径） */
  vehicleName?: string
  /** 当日告警次数 */
  alarmCount?: number
}

/** 指定车辆每天 Top10 告警（dailyTopAlarms 元素；本页不消费该维度，保留协议形状） */
export interface DailyTopAlarmDto {
  /** 日期（当天 00:00:00） */
  date?: string
  /** 当天 Top10 告警（按次数倒序） */
  topAlarms?: {
    /** 告警码 */
    alarmCode?: string
    /** 异常详情（ErrorModel，形状同 SystemAlarmRecordDto.errorModel） */
    errorModel?: AlarmErrorModelDto
    /** 告警次数 */
    count?: number
    /** 当天该告警总时长（秒） */
    totalDurationSeconds?: number
  }[]
}

/** 告警统计聚合 VO（AlarmStatisticsVO） */
export interface AlarmStatisticsVo {
  /** 每日告警统计（关闭数/未关闭数/总时长；不保证连续覆盖统计窗口） */
  dailyAlarmCounts?: DailyAlarmCountDto[]
  /** 指定日期 Top10 车辆告警（topAgvDate 有值时下发） */
  topAgvAlarms?: AgvAlarmCountDto[]
  /** 指定车辆每天 Top10 告警（topAlarmVehicleKey 有值时下发；本页不消费） */
  dailyTopAlarms?: DailyTopAlarmDto[]
}

/** 明细分页查询参数（SystemAlarmRecordPageParamSystemAlarmRecord；全部条件可选） */
export interface SystemAlarmRecordPageParam {
  /** 当前页码（从 1 开始；前端零基 pageIndex 经 toBackendPage 换算） */
  pageNo?: number
  /** 每页数量 */
  pageSize?: number
  /** 告警来源；不传 = 全部来源 */
  sourceType?: AlarmSourceType
  /** 告警来源标识（车辆 key / 设备 key / 服务器标识） */
  sourceKey?: string
  /** 告警来源名称 */
  sourceName?: string
  /** 告警码 */
  alarmCode?: string
  /** 告警类型（后端自由字符串精确匹配） */
  alarmType?: string
  /** 告警级别；不传 = 全部级别 */
  alarmLevel?: AlarmLevel
  /** 关联任务 key */
  orderKey?: string
  /**
   * 是否已关闭：true 仅已关闭 / false 仅未关闭 / 不传查全部。
   * 注意 false 是有效筛选值，直传不可用 `|| undefined` 兜底（会吞掉 false）。
   */
  isClosed?: boolean
  /** 发生时间起（"yyyy-MM-dd HH:mm:ss"） */
  startTimeBegin?: string
  /** 发生时间止 */
  startTimeEnd?: string
  /** 恢复时间起 */
  endTimeBegin?: string
  /** 恢复时间止 */
  endTimeEnd?: string
}

/** 多语言译文条目（ErrorModel.errorDescriptionTranslations 元素，Translation schema） */
export interface AlarmTranslationDto {
  /** 语言标识（后端下发 en_US / zh_CN 下划线形态，比较前需归一化） */
  translationKey?: string
  /** 译文（空白视为未命中，继续回退） */
  translationValue?: string
}

/** 异常关联具体信息（ErrorModel.errorReferences 元素；协议未声明字段形状，原样保留） */
export interface AlarmErrorReferenceDto {
  [key: string]: unknown
}

/** 错误模型（ErrorModel；仅用于展示，数据库不存储） */
export interface AlarmErrorModelDto {
  /** 异常类型 */
  errorType?: string
  /** 异常描述（原文） */
  errorDescription?: string
  /** 异常级别（WARNING / FATAL；与记录 alarmLevel 独立，展示以记录级为准） */
  errorLevel?: AlarmLevel
  /** 异常描述多语言译文 */
  errorDescriptionTranslations?: AlarmTranslationDto[]
  /** 错误建议多语言译文 */
  errorHintTranslations?: AlarmTranslationDto[]
  /** 异常关联的具体信息 */
  errorReferences?: AlarmErrorReferenceDto[]
}

/** 系统告警记录行（SystemAlarmRecord；明细表与行展开详情的数据源） */
export interface SystemAlarmRecordDto {
  /** 记录 ID（int64；行标识经 stringFieldRowId 收敛为字符串，G10 同 P12 口径） */
  id?: number
  /** 记录创建时间（审计字段，本页不展示） */
  createTime?: string
  /** 告警来源 */
  sourceType?: AlarmSourceType
  /** 告警来源标识（车辆 key / 设备 key / 服务器标识） */
  sourceKey?: string
  /** 告警来源名称（空时展示回退 sourceKey） */
  sourceName?: string
  /** 告警码 */
  alarmCode?: string
  /** 告警类型（后端自由字符串，原文展示不做枚举映射） */
  alarmType?: string
  /** 告警级别（FATAL / WARNING；未知值防御性显示原值） */
  alarmLevel?: string
  /** 关联任务 key（任务导航参数） */
  orderKey?: string
  /** 关联任务名称（展示优先，导航参数仍用 orderKey） */
  orderName?: string
  /** 上层订单 ID */
  upperOrderId?: string
  /** 扩展 JSON（原样展示，不翻译不猜测语义） */
  payloadJson?: Record<string, unknown>
  /** 发生时间（startTime；未关闭告警的 endTime / durationSeconds 不下发） */
  startTime?: string
  /** 恢复时间（endTime，未关闭为空） */
  endTime?: string
  /** 持续时长（秒，int64；未关闭不下发） */
  durationSeconds?: number
  /** 是否已关闭（endTime 有值即为 true） */
  isClosed?: boolean
  /** 告警发生小时（后端分组辅助字段，本页不消费） */
  startHour?: string
  /** 告警发生日期（后端分组辅助字段，本页不消费） */
  startDay?: string
  /** 异常详情（描述原文 + 多语言译文 + 错误建议） */
  errorModel?: AlarmErrorModelDto
}

/** 明细分页数据（仅声明前端消费字段，忽略 MyBatis-Plus 内部分页元字段） */
export interface SystemAlarmRecordPage {
  /** 当前页记录 */
  records?: SystemAlarmRecordDto[]
  /** 总条数（rowCount 真实来源；未知不由前端补 0） */
  total?: number
  /** 每页数量 */
  size?: number
  /** 当前页码 */
  current?: number
  /** 总页数 */
  pages?: number
}
