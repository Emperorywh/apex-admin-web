export interface DeviceChargePileState {
    chargePileState: {
        state: "ERROR"| "IDLE" | "CHARGING" | "FULL" | "FAULT" | "OFFLINE";
        statusInfo: {
            fault: boolean;
            working: boolean;
            chargingComplete: boolean;
            manualMode: boolean;
            agvInPosition: boolean;
            moduleFault: boolean;
            acFault: boolean;
            rodExtending: boolean;
            rodRetracting: boolean;
            rodChargingExtending: boolean;
            rodAtZero: boolean;
            chargerId: number;
            rawInfo: string;
        }
    }
}

export interface ChargePileRecord {
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
    deviceChargePileState?: DeviceChargePileState;
}

export interface ChargeDriver {
    key: string;
    name: string;
    driverProtocol: object;
}
