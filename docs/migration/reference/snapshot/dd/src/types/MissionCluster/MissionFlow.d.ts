import type { Actions } from "./MissionCreate";

export interface OrderGroupForm {
    orderFlowName: string;
    orderTemplateKeys: string[];
    cronExpression: string;
    triggerTimes: number;
    triggerType: number;
}

export interface OrderGroupQueryType {
    pageSize: number;
    pageNo: number;
    query?: string;
    orderGroupName?: string;
    orderGroupTaskState?: string;
}

export interface OrderFlowOperationType {
    operation: "PAUSE" | "CONTINUE" | "CANCEL";
    id: number;
}

export interface SubOrderMissionType {
    mapI: string;
    mapName: string;
    stationId: string;
    stationName: string;
    actions: Actions[];
}

export interface SubOrderFlowType {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    orderFlowKey: string;
    subOrderFlowKey: string;
    orderTemplateName: string;
    orderTemplateKey: string;
    appointVehicleKey: string | null;
    appointVehicleName: string | null;
    appointVehicleGroupKey: string | null;
    appointVehicleGroupName: string | null;
    subOrderMissions: SubOrderMissionType[];
    subOrderFlowState: "EXECUTING" | "PAUSED" | "ABNORMAL" | "CANCELLED" | "FAILED" | "COMPLETED";

}

export interface OrderGroupRecord {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    orderFlowName: string;
    orderFlowKey: string;
    subOrderFlows: SubOrderFlowType[];
    triggerType: number;
    triggerTimes: number;
    cronExpression: string;

}

export interface OrderGroupTaskResult {
    records: OrderGroupRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;

}
