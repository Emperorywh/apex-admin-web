export interface SearchParamsType {
    pageSize: number;
    pageNo: number;
    query?: string;
}

export interface ModbusElevator {
    id?: number;
    createTime?: string;
    updateTime?: string;
    createUser?: string;
    updateUser?: string;
    deviceKey?: string;
    deviceName: string;
    ip: string;
    port: number;
    deviceStatus: boolean;
    slaveId: number;
    readFunction: string;
    faultSignal: number;
    occupySignal: number;
    frontDoorFullyOpenSignal: number;
    frontDoorFullyCloseSignal: number;
    backDoorFullyOpenSignal: number;
    backDoorFullyCloseSignal: number;
    currentFloor: number;
    writeFunction: string;
    frontDoorOpeningSignal: number;
    frontDoorClosingSignal: number;
    backDoorOpeningSignal: number;
    backDoorClosingSignal: number;
    targetFloor: number;
    occupyVehicleKey: string;
}

export interface CommandParams {
    deviceKey?: string;
    targetFloor?: number;
    currentFloor?: number;
}

export interface ElevatorState {
    onlineState: string;
    currentFloor: number;
    runningState: string;
    frontDoorState: string;
    backDoorState: string;
    occupyAgv?: {
        key: string;
        name: string;
    };
}
