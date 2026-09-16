/**
 * @description 实时运行看板相关类型定义
 * 对应后端接口 /fms/v1/dispatcher/dashboard/board
 * @date 2026-8-6
 */

/**
 * 实时运行看板查询参数（对应 DashboardParam）
 * 两个字段后端均有默认值，可不传
 */
export interface DashboardParam {
    /** 订单统计天数，默认2天（昨天+今天） */
    days?: number;
    /** 订单类型，默认工作任务 */
    orderTypes?: string[];
}

/**
 * 每小时订单统计（按小时时间升序，覆盖统计天数）
 */
export interface HourlyCount {
    /** 小时时间（业务时区墙钟，实际返回带 T 分隔符：yyyy-MM-ddTHH:00:00） */
    hourTime: string;
    /** 该小时创建的订单数 */
    created: number;
    /** 该小时完成的订单数 */
    succeeded: number;
    /** 该小时取消的订单数 */
    cancelled: number;
    /** 该小时失败的订单数 */
    failed: number;
    /** 该小时创建的已完成订单数（平均耗时分子用） */
    createdSucceededCount: number;
    /** 该小时创建的已完成订单总耗时（秒，平均耗时=总耗时/数量） */
    createdSucceededDurationSeconds: number;
}

/**
 * 订单统计（对应 OrderStatistics）
 * 总数/完成率/平均耗时由前端基于 hourlyCounts 自行汇总
 */
export interface OrderStatistics {
    /** 每小时订单统计列表 */
    hourlyCounts: HourlyCount[];
    /** 当前任务积压（队列中的订单数） */
    queueOrderCount: number;
}

/**
 * 车辆（AGV）统计（对应 VehicleStatistics）
 */
export interface VehicleStatistics {
    /** AGV总数 */
    totalVehicleCount: number;
    /** 在线AGV数 */
    onlineVehicleCount: number;
    /** 运行中AGV数 */
    runningCount: number;
    /** 空闲AGV数 */
    idleCount: number;
    /** 充电中AGV数 */
    chargingCount: number;
    /** 故障AGV数 */
    faultCount: number;
    /** 离线AGV数 */
    offlineCount: number;
}

/**
 * 实时运行看板聚合数据（对应 DashboardBoardVO）
 */
export interface DashboardBoardVO {
    /** 订单统计 */
    order: OrderStatistics;
    /** 车辆统计 */
    vehicle: VehicleStatistics;
}

/**
 * 实时运行看板响应结果（对应 ResultDashboardBoardVO）
 */
export interface ResultDashboardBoardVO {
    /** 返回码，200 正常 */
    code: number;
    /** 返回信息 */
    message: string;
    /** 时间戳 */
    timestamp: number;
    /** 看板聚合数据 */
    data: DashboardBoardVO;
}
