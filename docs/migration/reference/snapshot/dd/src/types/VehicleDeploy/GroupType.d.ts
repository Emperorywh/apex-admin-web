export interface VehicleGroupParams {
    pageSize: number;
    pageNo: number;
    query: string;
}

export interface Records {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: number;
    updateUser: number;
    agvGroupKey: string;
    agvGroupName: string;
    agvKeys: string[];
    simpleAGVs: SimpleVehicle[];
}

export interface Orders {
    column: string;
    asc: boolean;
}

export interface VehicleGroupResult {
    records: Records[];
    total: number;
    size: number;
    current: number;
    orders: Orders[];
    optimizeCountSql: object;
    searchCount: object;
    optimizeJoinOfCountSql: boolean;
    maxLimit: number;
    countId: string;
    pages: number;
}

export interface SimpleVehicle {
    key: string;
    name: string;
}

export interface VehicleGroupForm {
    groupKey?: string;
    groupName: string;
    vehicleKeys: string[];
}

export interface UpdateVehicleGroup {
    groupKey: string;
    groupName: string;
    vehicleKeys: string;
}
