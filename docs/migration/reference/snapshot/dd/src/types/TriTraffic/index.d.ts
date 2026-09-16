type AtLeastOneKey<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: T[P] };

export interface TriTrafficRecord {
    id?: number;
    createTime?: string;
    updateTime?: string;
    createUser?: string;
    updateUser?: string;
    areaCode?: string;
    nodeEdgeGroupId?: string;
    lockedSys?: string;
    isExternalArbitrator?: boolean;
    extendParam?: AtLeastOneKey<object, "url">;
}

export interface TriTrafficResponse {
    records: TriTrafficRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface PageTrafficType {
    pageSize: number;
    pageNo: number;
    areaCode?: string;
}

export interface SimpleTrafficEdgeGroups {
    id: string;
    name: string;
    mapId: string;
}

export interface TestCommunicationType {
    applyType: "APPLY" | "RELEASE" | string;
    areaCode?: string;
    systemCode: "rxx";
}
