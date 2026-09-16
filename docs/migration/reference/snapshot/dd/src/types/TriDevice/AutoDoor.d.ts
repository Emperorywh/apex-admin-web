export interface PageAutoDoorParams {
    pageSize: number;
    pageNo: number;
    query?: string;
}

export interface AutoDoorParams {
    deviceKey?: string;
    deviceName: string;
    driverKey: string;
    ip: string;
    port: number;
    deviceStatus: boolean;
    deviceConfig: object;
}

export interface AutoDoorDriver {
    name: string;
    key: string;
    driverProtocol: object;
}

export interface AutoDoorRecord {
    id?: number;
    createTime?: string;
    updateTime?: string;
    createUser?: string;
    updateUser?: string;
    deviceKey: string;
    deviceName: string;
    deviceStatus: boolean;
    driverKey: string;
    ip: string;
    port: number;
    deviceConfig?: Record<string, string> | string;
    agvKeys: string | null;
}

export interface PageAutoDoor {
    code: number;
    message: string;
    timestamp: number;
    data: {
        records: AutoDoorRecord[];
        total: number;
        size: number;
        current: number;
        pages: number;
    }
}

export interface AutoDoorDeviceKey {
    deviceKey: string;
}

interface SimpleAGVS {
    key: string;
    name: string;
}

export interface AutoDoorState {
    autoDoorState: {
        doorState: string;
    };
    simpleAGVS: SimpleAGVS[];
}
