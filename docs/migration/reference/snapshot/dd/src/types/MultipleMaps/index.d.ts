export interface PageCrossMaps {
    pageSize: number;
    pageNo: number;
    query?: string;
}

interface CrossMap {
    mapId: string;
    nodeId: string;
}

export interface CreateCrossMap {
    crossMapName: string;
    deviceKey: string;
    crossMaps: CrossMap[];
}

export interface SimpleMap {
    mapId: string;
    mapName: string;
}

export interface GetCrossMapStations {
    mapId: string;
}

export interface Elevator {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    deviceKey: string;
    deviceName: string;
    deviceStatus: boolean;
    driverKey: string;
    floors: number;
    deviceConfig: Record<string, unknown>;
    agvKeys: null
}

export interface CrossMapStation {
    id: string;
    name: string;
    mapId?: string;
}

export interface VehicleAction {
    id?: 5,
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    actionType: string;
    actionDescription: string;
    blockingType: string;
    actionParameters: ActionParameter[]
}

export interface ActionParameter {
    key: string;
    value: object;
}

export interface CrossMap {
    mapId: string;
    mapName: string;
    nodeId: string;
    nodeName: string;
}

export interface CrossMapRecord {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    crossMapName: string;
    deviceKey: string;
    deviceName: string;
    crossMaps: CrossMap[];
}

export interface CrossMapData {
    records: CrossMapRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface DeleteCrossMap {
    id: number;
}
