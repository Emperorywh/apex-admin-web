/**
 * AGV 状态时长统计报表专用状态枚举（对应后端 VehicleStatisticState）
 *
 * 注意：该枚举与车辆实时状态（vehicleProcStatus / RobotStatus）不同，
 * 后端报表按此枚举做时长聚合统计，故单独定义，不要混用。
 */
export type VehicleStatisticState =
    | "ONLINE" // 在线
    | "OFFLINE" // 离线
    | "IDLE" // 空闲
    | "EXECUTING_WORK" // 执行作业
    | "EXECUTING_CHARGE" // 执行充电
    | "EXECUTING_PARK" // 执行停靠
    | "TRAFFIC" // 交管等待
    | "PAUSED" // 暂停
    | "AVOID" // 避让
    | "BRAKE" // 制动
    | "WARNING" // 告警
    | "ERROR" // 异常
    | "CHARGING"; // 充电中

/**
 * AGV 状态统计查询参数（对应 AgvStateStatisticsParam）
 * 两个状态时长报表接口共用该请求参数
 */
export interface AgvStateStatisticsParam {
    /** 开始时间 */
    startTime?: string;
    /** 结束时间 */
    endTime?: string;
    /** 是否按小时维度统计（小时维度时时间范围不能超过 24 小时） */
    byHour?: boolean;
    /** 车辆集合 */
    vehicleKeys?: string[];
    /** 状态集合（为空时统计所有状态） */
    states?: VehicleStatisticState[];
}

//*********************************************************************接口1：AGV 状态每日时长统计******************************************************//

/**
 * 每日有效状态时长统计（按天升序，每天一条汇总记录）。
 * 后端汇总所选状态的总时长，并返回当天车辆数，供前端计算平均利用率。
 */
export interface DailyStateDuration {
    /** 日期（当天 00:00:00） */
    date: string;
    /**
     * 当天所选状态的总时长（秒）。
     * 已包含参与统计车辆的累计时长，无需再次按状态求和。
     */
    totalDurationSeconds: number;
    /**
     * 当天参与统计的车辆数量。
     * 与当天有效统计秒数相乘，作为平均利用率的分母。
     */
    vehicleCount: number;
}

/**
 * AGV 状态每日时长统计聚合数据（对应 AgvStateStatisticsVO）
 */
export interface AgvStateStatisticsVO {
    /**
     * 每日有效状态时长与车辆数量。
     * 按天升序返回，每天一条汇总记录。
     */
    dailyStateDurations: DailyStateDuration[];
}

/**
 * AGV 状态每日时长统计响应结果（对应 ResultAgvStateStatisticsVO）
 */
export interface ResultAgvStateStatisticsVO {
    /** 返回码，200 正常 */
    code: number;
    /** 返回信息 */
    message: string;
    /** 时间戳 */
    timestamp: number;
    /** 每日状态时长统计聚合数据 */
    data: AgvStateStatisticsVO;
}

//*********************************************************************接口2：AGV 各状态总时长统计（每车）******************************************************//

/**
 * 每车各状态总时长统计
 */
export interface VehicleExecutingDuration {
    /** 车辆标识 */
    vehicleKey: string;
    /** 车辆名称 */
    vehicleName: string;
    /** 车辆统计状态 */
    state: VehicleStatisticState;
    /** 该状态执行总时长（秒） */
    totalDurationSeconds: number;
}

/**
 * AGV 各状态总时长统计聚合数据（对应 AgvExecutingTimeStatisticsVO）
 */
export interface AgvExecutingTimeStatisticsVO {
    /** 每车各状态总时长统计 */
    vehicleExecutingDurations: VehicleExecutingDuration[];
}

/**
 * AGV 各状态总时长统计响应结果（对应 ResultAgvExecutingTimeStatisticsVO）
 */
export interface ResultAgvExecutingTimeStatisticsVO {
    /** 返回码，200 正常 */
    code: number;
    /** 返回信息 */
    message: string;
    /** 时间戳 */
    timestamp: number;
    /** 各状态总时长统计聚合数据 */
    data: AgvExecutingTimeStatisticsVO;
}
