export interface SearchParamsType {
    pageSize?: number;
    pageNo?: number;
    query?: string;
}

export interface ObstacleParameters {
    name: string;
    avoid: string;
    enable: boolean
}

export interface ObstacleRecord {
    id?: number;
    createTime?: string;
    updateTime?: string;
    createUser?: string;
    updateUser?: string;
    obstacleAvoidanceName: string;
    parameters: ObstacleParameters[];
}

export interface ObstacleResponseType {
    records: ObstacleRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface DeleteObstacleType {
    id?: string | number;
}
