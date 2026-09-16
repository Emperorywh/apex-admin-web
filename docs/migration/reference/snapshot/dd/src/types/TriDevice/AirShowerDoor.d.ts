/**
 * 风淋门设备配置统一使用可索引的 JSON 对象类型。
 * 领域层集中定义后，表单提交、列表展示和通用 JSON 查看器可以共享同一数据契约。
 */
export type AirDoorDeviceConfig = Record<string, unknown>;

export interface AddAirDoor {
    deviceKey: string;
    deviceName: string;
    driverKey: string;
    ip: string;
    port: number;
    /**
     * 设备扩展配置以 JSON 文本录入，提交前解析为领域对象。
     * 接口入参与列表返回值共用同一配置类型，避免展示层进行类型断言。
     */
    deviceConfig: AirDoorDeviceConfig;
}

export interface AirDoorForm {
    deviceKey: string;
    deviceName: string;
    driverKey: string;
    ip: string;
    port: number;
    /** 表单内 deviceConfig 为 TextArea 录入的 JSON 文本 */
    deviceConfig: string;
}

/**
 * 风淋门驱动（对齐后端 DeviceDriver：name / key / driverProtocol）
 */
export interface AirDoorDriver {
    name: string;
    key: string;
    /**
     * 驱动协议作为新增设备时的默认配置来源。
     * 使用领域配置类型保证回填、提交和展示的数据结构一致。
     */
    driverProtocol: AirDoorDeviceConfig;
}

export interface PageAirDoor {
    pageSize: number;
    pageNo: number;
    query?: string;
}

/**
 * 风淋门接口统一使用的网络状态枚举。
 * 由领域类型集中定义，避免列表与详情分别维护状态取值。
 */
export type AirDoorNetworkState = "ONLINE" | "OFFLINE";

/**
 * 风淋门记录（对齐后端 DeviceAirShowerDoor）
 */
export interface AirDoorRecord {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    deviceKey: string;
    deviceName: string;
    deviceStatus: boolean;
    showerStatus: boolean;
    ip: string;
    port: number;
    driverKey: string;
    /**
     * 分页接口返回的设备配置，可直接交给通用 JSON 查看器展示。
     * 具体配置键由驱动协议决定，因此值类型保持为 unknown。
     */
    deviceConfig: AirDoorDeviceConfig;
    /** 占用设备的车辆集合 */
    vehicleNames: string[];
    /**
     * 自动门网络状态，与分页接口 Swagger 枚举保持一致。
     * ONLINE 表示在线，OFFLINE 表示离线。
     */
    onlineState: AirDoorNetworkState;
}

export interface AirDoorData {
    records: AirDoorRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

/**
 * 设备操作入参（对齐后端 DeviceParam，doorWay 非必填）
 */
export interface AirDoorDeviceKey {
    deviceKey: string;
    doorWay?: string;
}

/**
 * 开门 / 关门 / 风淋操作入参（doorWay 必填：FRONT 前 / BACK 后）
 */
export interface AirDoorOpen {
    deviceKey: string;
    doorWay: string;
}

export interface AirDoorControlForm {
    doorWay: "FRONT" | "BACK";
}

/**
 * 风淋门状态（对齐后端 AirShowerDoorState，扁平结构）
 */
export interface AirDoorState {
    /**
     * 在线状态与列表字段使用相同枚举，避免跨接口产生隐式状态值。
     * ONLINE 表示在线，OFFLINE 表示离线。
     */
    onlineState: AirDoorNetworkState;
    /** 风淋状态：UNKNOWN / AIRING / AIRED */
    showerState: string;
    /** 是否故障 */
    failed: boolean;
    /** 前门状态：UNKNOWN / ERROR / DOOR_OPENED / DOOR_OPENING / DOOR_CLOSED / DOOR_CLOSING */
    frontDoorState: string;
    /** 后门状态：UNKNOWN / ERROR / DOOR_OPENED / DOOR_OPENING / DOOR_CLOSED / DOOR_CLOSING */
    backDoorState: string;
}

/**
 * 风淋门操作类型（对齐后端 AirShowerDoorOperationType：apply 申请操作 / release 释放操作）
 */
export type AirDoorOperationType = "apply" | "release";

/**
 * 风淋门可用操作枚举（对齐后端 AirShowerDoorOperationType）
 */
export type AirDoorOperation =
    | "OPEN_FONT_DOOR"
    | "OPEN_BACK_DOOR"
    | "CLOSE_FONT_DOOR"
    | "CLOSE_BACK_DOOR"
    | "SHOWER";
