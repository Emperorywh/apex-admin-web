export interface MapInfoSearchParams {
    pageSize: number;
    pageNo: number;
    query?: string;
}

export interface MapInfo {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: number;
    updateUser: number;
    mapId: string;
    mapName: string;
    floor: number;
    mapState: "ENABLED" | "DISABLED";
    mapVersionId: number;
    mapJson?: object[];
    currentMapInfoVersion?: any;
}

export interface DeleteMapParams {
    mapId: string;
}

export interface UpdateMapType {
    mapKey: string;
    mapState: string;
    floor: number;
}

export interface PullMapType {
    ip: string;
    mapName?: string;
}

export interface CreateMapType {
    mapName: string;
    mapState: string;
    floor: number;
}
