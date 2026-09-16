export interface PageSysActionType {
    pageSize: number;
    pageNo: number;
    query?: string;
}

export interface ActionParameters {
    key: string;
    value?: any;
}

export interface SysActionType {
    id?: number;
    actionType: string;
    actionDescription: string;
    actionParameters: ActionParameters[];
}

export interface SysActionRecord {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    actionType: string;
    actionDescription: string;
    actionParameters: ActionParameters[];
}

export interface SysActionData {
    records: SysActionRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface DeleteSysAction {
    id: number;
}

export interface ActionImplements {
    type: string;
    name: string;
}
