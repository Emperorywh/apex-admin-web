export interface LineRecord {
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
    deviceConfig: object;
}

export interface LineDriver {
    name: string;
    clazz: string;
}

export interface LineState {
    fault: boolean;
    allowEntry: boolean;
}
