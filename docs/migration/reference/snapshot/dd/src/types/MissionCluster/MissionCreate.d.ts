export interface ActionParameterType {
    key: string;
    value: unknown;
}

export interface Actions {
    actionType: string;
    actionDescription: string;
    blockingType: string;
    actionParameters: ActionParameterType[];
}

export interface OrderMissionType {
    mapId: string;
    stationId: string;
    actions: Actions[];
}

export interface OrderGroupType {
    id?: number;
    orderTemplateName: string;
    appointVehicleKey: string;
    appointVehicleGroupKey: string;
    orderMissions: OrderMissionType[];
}

export interface PageOrderGroupType {
    pageSize: number;
    pageNo: number;
    query?: string;
}

export interface OrderTemplateMissionType {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    orderMissionTemplateKey: string;
    orderTemplateKey: string;
    mapId: string;
    mapName: string;
    stationId: string;
    stationName: string;
    actions: Actions[];
}

export interface OrderTemplateRecord {
    id: 4,
    createTime: string;
    updateTime: string;
    createUser:string;
    updateUser: string;
    orderTemplateName: string;
    orderTemplateKey: string;
    appointVehicleKey: string;
    appointVehicleName: string;
    appointVehicleGroupKey: string | null;
    appointVehicleGroupName: string | null;
    orderMissions: OrderTemplateMissionType[];

}

export interface OrderGroupResultType {
    records: OrderGroupRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface DeleteOrderTemplateType {
    orderTemplateKey: string;
}
