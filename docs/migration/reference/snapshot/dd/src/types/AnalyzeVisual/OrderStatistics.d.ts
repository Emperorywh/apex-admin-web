export interface OrderStatisticsParams {
    startTime?: string;
    endTime?: string;
    orderTypes?: string[];
    orderStates?: string[];
    vehicleKeys?: string[];
}

export interface OrderQuantityStatisticsParams {
    startTime?: string;
    endTime?: string;
    orderTypes?: string[];
    orderStates?: string[];
    vehicleKeys?: string[];
}

export interface QuantityType {
    orderNumber: number;
    workOrderFinishedNumber: number;
    workOrderCancelledNumber: number;
    workOrderFailedNumber: number;
    chargeOrderFinishedNumber: number;
    batteryMaintainOrderFinishedNumber: number;
    parkOrderFinishedNumber: number;
}

export interface EfficiencyType {
    workOrderAverageTime: number;
    workOrderAverageExecutionTime: number;
    workOrderAverageWaitTime: number;
    parkOrderAverageTime: number;
    chargeOrderAverageTime: number;
    batteryMaintainOrderAverageTime: number;
}

export interface PieData {
    value: number;
    name: string;
}

/**
 * 任务统计报表查询参数（对应 TaskStatisticsParam）
 * 对应后端接口 /fms/v1/report/orderStatisticsReport/taskStatistics
 * 全部字段后端均有默认值，可不传
 */
export interface TaskStatisticsParam {
    /** 开始时间（yyyy-MM-dd HH:mm:ss），与 endTime 配对构成统计窗口 */
    startTime?: string;
    /** 结束时间（yyyy-MM-dd HH:mm:ss） */
    endTime?: string;
    /** 订单类型，默认工作任务 */
    orderTypes?: string[];
    /** 车辆集合（vehicleKey），不传 / 空集合查全部车辆 */
    vehicleKeys?: string[];
}

/**
 * 每日订单统计（按天升序，覆盖统计天数）
 * 后端不再直接给平均耗时，改为返回「已完成订单数 + 已完成订单总耗时」两个原始值，
 * 平均耗时由前端计算：createdSucceededDurationSeconds / createdSucceededCount（数量为 0 时需前端兜底）
 */
export interface DailyCount {
    /** 日期（文档标注 yyyy-MM-dd，实测后端下发 yyyy-MM-ddT00:00:00，消费方需截取前 10 位归一化） */
    date: string;
    /** 当天创建的订单数 */
    created: number;
    /** 当天完成的订单数（按结束时间） */
    completed: number;
    /** 当天取消的订单数（按结束时间） */
    cancelled: number;
    /** 当天失败的订单数（按结束时间） */
    failed: number;
    /** 当天创建的已完成订单数（平均耗时分子用） */
    createdSucceededCount: number;
    /** 当天创建的已完成订单总耗时（秒，平均耗时=总耗时/数量） */
    createdSucceededDurationSeconds: number;
    /** 当天创建且有执行时间的订单总等待时长（秒，执行时间-创建时间） */
    waitDurationSeconds: number;
}

/**
 * 执行时长分布分桶
 */
export interface DurationBucket {
    /** 分桶显示名，如 <1min、1-2min、2-3min、3-5min、5-10min、>10min */
    label: string;
    /** 数量 */
    count: number;
}

/**
 * 任务统计报表聚合数据（对应 TaskStatisticsVO）
 * 总数/完成率/环比由前端基于 dailyCounts 自行汇总
 */
export interface TaskStatisticsVO {
    /** 每日订单统计列表 */
    dailyCounts: DailyCount[];
    /** 执行时长分布（按固定分桶，按桶升序） */
    durationDistribution: DurationBucket[];
}

/**
 * 任务统计报表响应结果（对应 ResultTaskStatisticsVO）
 */
export interface ResultTaskStatisticsVO {
    /** 返回码，200 正常 */
    code: number;
    /** 返回信息 */
    message: string;
    /** 时间戳 */
    timestamp: number;
    /** 任务统计聚合数据 */
    data: TaskStatisticsVO;
}
