export interface AutoDoorRecord {
    id: number;
    createTime: string;
    updateTime:string; 
    createUser: string;
    updateUser: string;
    deviceKey: string;
    deviceName: string;
    deviceStatus: boolean;
    ip: string;
    port: number;
    slaveId: number;
    readFunction: string;
    faultSignal: number;
    doorFullyOpenSignal: number;
    doorFullyCloseSignal: number;
    writeFunction: string;
    doorOpeningSignal: number;
    doorClosingSignal: number;
}

export interface AutoDoorCommand {
    deviceKey: string;
}
