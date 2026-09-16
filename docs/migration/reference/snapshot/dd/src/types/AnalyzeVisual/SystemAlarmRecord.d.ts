import type { ErrorEntry } from "@/types/PlaybackTypings";

/**
 * 分页查询系统告警记录参数（对应 SystemAlarmRecordPageParam）
 * 对应后端接口 /fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords
 * 所有筛选字段均为可选
 */
export interface PageSystemAlarmRecordsParams {
    /** 每页的数量 */
    pageSize?: number;
    /** 当前的页码 */
    pageNo?: number;
    /** 告警来源：VEHICLE 车辆 / DEVICE 设备 / SERVER 服务器 */
    sourceType?: string;
    /** 告警来源标识（车辆key/设备key/服务器标识等） */
    sourceKey?: string;
    /** 告警来源名称 */
    sourceName?: string;
    /** 告警码 */
    alarmCode?: string;
    /** 告警类型 */
    alarmType?: string;
    /** 告警级别：WARNING / FATAL */
    alarmLevel?: string;
    /** 关联订单key */
    orderKey?: string;
    /** 是否已关闭（true 仅查已关闭，false 仅查未关闭，不传查全部） */
    isClosed?: boolean;
    /** 告警开始时间起 */
    startTimeBegin?: string;
    /** 告警开始时间止 */
    startTimeEnd?: string;
    /** 告警结束时间起 */
    endTimeBegin?: string;
    /** 告警结束时间止 */
    endTimeEnd?: string;
}

/**
 * 系统告警记录（对应 SystemAlarmRecord）
 * errorModel 复用回放模块已定义的 ErrorEntry（与后端 ErrorModel 结构一致）
 */
export interface SystemAlarmRecord {
    id: number;
    createTime?: string;
    updateTime?: string;
    createUser?: string;
    updateUser?: string;
    /** 告警来源：VEHICLE 车辆 / DEVICE 设备 / SERVER 服务器 */
    sourceType?: string;
    /** 告警来源标识（车辆key/设备key/服务器标识等） */
    sourceKey?: string;
    /** 告警来源名称 */
    sourceName?: string;
    /** 告警码 */
    alarmCode?: string;
    /** 告警类型 */
    alarmType?: string;
    /** 告警级别：WARNING / FATAL */
    alarmLevel?: string;
    /** 关联订单key */
    orderKey?: string;
    /** 关联订单名称 */
    orderName?: string;
    /** 上层订单ID */
    upperOrderId?: string;
    /** 扩展JSON */
    payloadJson?: Record<string, any>;
    /** 开始时间 */
    startTime?: string;
    /** 结束时间 */
    endTime?: string;
    /** 持续时长（秒） */
    durationSeconds?: number;
    /** 是否已关闭（endTime 有值即为 true） */
    isClosed?: boolean;
    /** 告警发生小时（startTime 截断到小时） */
    startHour?: string;
    /** 告警发生日期（startTime 截断到天 00:00:00） */
    startDay?: string;
    /** 异常详情 */
    errorModel?: ErrorEntry;
}

/**
 * 系统告警记录分页数据（对应 PageSystemAlarmRecord）
 * 仅声明前端实际消费的分页字段，忽略 orders/optimizeCountSql 等 MyBatis-Plus 内部字段
 */
export interface PageSystemAlarmRecord {
    /** 告警记录列表 */
    records: SystemAlarmRecord[];
    /** 总条数 */
    total: number;
    /** 每页数量 */
    size: number;
    /** 当前页码 */
    current: number;
    /** 总页数 */
    pages: number;
}

/**
 * 分页查询系统告警记录响应结果（对应 ResultPageSystemAlarmRecord）
 */
export interface ResultPageSystemAlarmRecord {
    /** 返回码，200 正常 */
    code: number;
    /** 返回信息 */
    message: string;
    /** 时间戳 */
    timestamp: number;
    /** 分页数据 */
    data: PageSystemAlarmRecord;
}

/**
 * 告警统计报表查询参数（对应 AlarmStatisticsParam）
 * 对应后端接口 /fms/v1/report/systemAlarmRecord/alarmStatistics
 * 所有字段均可选：startTime/endTime 限定统计窗口；
 * topAgvDate / topAlarmVehicleKey 不传则不查对应维度
 */
export interface AlarmStatisticsParam {
    /** 开始时间（date-time 字符串，如 2026-08-01 00:00:00） */
    startTime?: string;
    /** 结束时间（date-time 字符串，如 2026-08-14 23:59:59） */
    endTime?: string;
    /**
     * 指定日期查 Top10 AGV 告警次数（截断到天 00:00:00），不传不查。
     * 文档标注 string(date-time)，实测后端约定格式为 yyyy-MM-dd HH:mm:ss
     * （如 2026-08-11 00:00:00，当天开始时间），只传日期会解析失败返回 500
     */
    topAgvDate?: string;
    /** 指定 AGV（vehicleKey）查每天 Top10 告警，不传不查 */
    topAlarmVehicleKey?: string;
}

/**
 * 每日告警统计（按天升序）
 */
export interface DailyAlarmCount {
    /** 日期（当天 00:00:00） */
    date: string;
    /** 当天关闭的告警数（有 endTime） */
    closedCount: number;
    /** 当天未关闭的告警数（无 endTime） */
    unclosedCount: number;
    /** 当天开始的告警总时长（秒） */
    totalDurationSeconds: number;
}

/**
 * 指定日期 Top10 AGV 告警次数（倒序）
 */
export interface AgvAlarmCount {
    /** 车辆Key */
    vehicleKey: string;
    /** 车辆名称 */
    vehicleName: string;
    /** 告警次数 */
    alarmCount: number;
}

/**
 * 单条告警信息（指定 AGV 每天 Top10 告警的明细项）
 */
export interface AlarmInfo {
    /** 告警码 */
    alarmCode: string;
    /** 异常详情 */
    errorModel?: ErrorEntry;
    /** 告警次数 */
    count: number;
    /** 当天该告警总时长（秒） */
    totalDurationSeconds: number;
}

/**
 * 指定 AGV 某天的 Top10 告警
 */
export interface DailyTopAlarm {
    /** 日期（当天 00:00:00） */
    date: string;
    /** 当天 Top10 告警（按次数倒序） */
    topAlarms: AlarmInfo[];
}

/**
 * 告警统计报表聚合数据（对应 AlarmStatisticsVO）
 */
export interface AlarmStatisticsVO {
    /** 每日告警统计（关闭数/未关闭数/总时长，按天升序） */
    dailyAlarmCounts: DailyAlarmCount[];
    /** 指定日期 Top10 AGV 告警次数（倒序），topAgvDate 有值时有数据 */
    topAgvAlarms: AgvAlarmCount[];
    /** 指定 AGV 每天 Top10 告警，topAlarmVehicleKey 有值时有数据 */
    dailyTopAlarms: DailyTopAlarm[];
}

/**
 * 告警统计报表响应结果（对应 ResultAlarmStatisticsVO）
 */
export interface ResultAlarmStatisticsVO {
    /** 返回码，200 正常 */
    code: number;
    /** 返回信息 */
    message: string;
    /** 时间戳 */
    timestamp: number;
    /** 告警统计聚合数据 */
    data: AlarmStatisticsVO;
}
