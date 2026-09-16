import type { ActionParameters } from "@/types/ActionControl/AGVActions";

/**
 * 查询订单详情请求参数
 * 接口已升级为 mission 分页查询，故需携带 pageNo / pageSize
 */
export interface GetOrderDetailType {
    orderTaskKey: string;
    pageNo: number;
    pageSize: number;
}

export interface ExtendParameters {
    key: string;
    value: object;
}

export interface Actions {
    actionType: string;
    actionId: string;
    actionDescription: string;
    blockingType: "NONE" | "SOFT" | "HARD";
    actionParameters: ActionParameters[];
    actionStatus: "WAITING" | "INITIALIZING" | "RUNNING" | "FINISHED" | "FAILED";
    resultDescription: string;
    startTime: string;
    finalTime: string;
    /**
     * 条件标识：动作触发/执行所依赖的条件字符串，可能为空
     */
    conditionStr?: string;
}

export interface OrderMissions {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    orderMissionKey: string;
    /**
     * 上层业务 key
     */
    upperKey: string;
    orderRecordKey: string;
    mapId: string;
    mapName: string;
    stationId: string;
    stationName: string;
    actions: Actions[];
    /**
     * 附属系统动作集合（由调度端执行）
     */
    parallelActions: Actions[];
    /**
     * 子任务执行类型：DEFAULT 默认 / ATTACHED 附着
     */
    executionType: "DEFAULT" | "ATTACHED";
    missionState: "NA" | "PROCESSING" | "HANG" | "CANCELLED" | "FINISHED";
    extendParameters: ExtendParameters[];
    executeTime: string;
    finalTime: string;
    station: object | null;
    /**
     * 上层任务 key
     */
    taskId: string;
}

export interface OrderInfoType {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    processKey: string | null;
    taskId: string | null;
    orderKey: string;
    orderName: string;
    orderType: "WORK" | "CHARGE" | "PARK" | "BATTERY_MAINTAIN"
    priority: number;
    appointVehicleKey: string | null;
    appointVehicleName: string | null;
    appointVehicleGroupKey: string | null;
    appointVehicleGroupName: string | null;
    orderMissions: OrderMissions[];
    extendParameters: ExtendParameters[];
    executeVehicleKey: string;
    executeVehicleName: string;
    orderState: "IN_QUEUE" | "OUT_QUEUE" | "PROCESSING" | "HANG" | "CANCELLED" | "SUCCEEDED" | "FAILED";
    executeTime: string;
    finalTime: string;
    hangReason: string;
    cancelReason: string;
    failReason: string;
}

/**
 * 子任务(mission)分页对象，对应订单详情接口响应的 data.missionPage
 * 字段来自后端 MyBatis-Plus 分页结构：records 当前页数据、total 总条数、size 每页条数、current 当前页码、pages 总页数
 */
export interface MissionPage {
    records: OrderMissions[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

/**
 * 订单详情响应，对应订单详情接口响应的 data
 * orderRecord 为订单主体信息（顶部描述列表数据来源）；missionPage 为子任务分页列表（子任务表格数据来源）
 */
export interface OrderRecordDetailDTO {
    orderRecord: OrderInfoType;
    missionPage: MissionPage;
}