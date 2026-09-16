export interface PageAgvActionTypes {
    pageSize?: number;
    pageNo?: number;
    query?: string;
}

export interface ActionParameters {
    key: string;
    value: any[] | number | string;
}

export interface AGVActionType {
    id?: number;
    actionType: string;
    actionDescription: string;
    blockingType: string;
    actionParameters: ActionParameters[];
}

export interface ActionRecord {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    actionType: string;
    actionDescription: string;
    blockingType: string;
    actionParameters: ActionParameters[];
}

export interface AGVActionResult {
    records: ActionRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface DeleteAgvActionType {
    id: number;
}
