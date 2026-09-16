export interface PageElevators {
    pageSize: number;
    pageNo: number;
    query?: string;
}

interface FloorConfig {
    floor: number;
    floorStatus: boolean;
    mapId: string;
    areaId: string;
}

export interface AddElevator {
    deviceKey?: string;
    deviceName: string;
    driverKey: string;
    floors: number;
    ip: string;
    port: number;
    deviceStatus: boolean;
    deviceConfig: Record<string, unknown>;
}

interface DeviceConfig {
    key: string;
    value: string;
}

export interface ElevatorForm {
    deviceKey?: string;
    deviceName: string;
    driverKey: string;
    floors: number;
    ip: string;
    port: number;
    deviceStatus: boolean;
    deviceConfig: DeviceConfig[];
}

export interface ElevatorDriver {
    name: string;
    key: string;
    driverProtocol: object;
}

export interface ElevatorRecord {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    deviceKey: string;
    deviceName: string;
    deviceStatus: boolean;
    driverKey: string;
    floors: number;
    ip: string;
    port: number;
    deviceConfig: Record<string, string>;
    agvKeys: string | null;
    onlineState: string;
}

export interface ElevatorData {
    records: ElevatorRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface OuterCallParams {
    deviceKey: string;
    currentFloor: number;
}

export interface ElevatorControlForm {
    deviceKey: string;
    currentFloor: number;
    targetFloor: number;
    doorWay: string;
}

export interface ElevatorCommand {
    deviceKey: string;
    doorWay?: string;
}

export interface InnerCallParams {
    deviceKey: string;
    targetFloor: number;
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
