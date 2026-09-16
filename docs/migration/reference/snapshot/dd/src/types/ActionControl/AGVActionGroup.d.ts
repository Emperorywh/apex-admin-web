import type { ActionRecord } from "./AGVActions";
export interface PageAGVActionGroupType {
    pageSize: number;
    pageNo: number;
    query?: string;
}

export interface ActionGroupType {
    id?: number;
    agvActionGroupName: string;
    agvActionIds: string[];
}

export interface AGVActionGroupType {
    id?: number;
    agvActionGroupName: string;
    agvActionIds: number[];
}

export interface AgvGroupRecord {
    id?: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    actionGroupName: string;
    agvActions: ActionRecord[];
}

export interface AgvActionGroups {
    records: AgvGroupRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface DeleteActionGroup {
    id?: number;
}
