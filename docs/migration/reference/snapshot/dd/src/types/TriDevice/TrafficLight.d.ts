/**
 * 分页查询交通信号灯参数
 * 用于 pageTrafficLights 接口的查询参数
 */
export interface PageTrafficLightParams {
    /** 每页数量 */
    pageSize: number;
    /** 当前页码 */
    pageNo: number;
    /** 交通信号灯的名称或者唯一key */
    query?: string;
}

/**
 * 交通灯设备配置
 * 包含请求地址、请求参数、响应成功表达式等设备通信配置
 */
export interface DeviceConfig {
    /** 交通灯请求地址 */
    url?: string;
    /** 交通灯请求参数 */
    requestParam?: Record<string, any>;
    /** 交通灯响应成功表达式 */
    responseSuccessExpression?: string;
}

/**
 * 交通信号灯记录
 * 包含交通信号灯的完整信息，用于分页查询和列表查询的响应数据
 */
export interface TrafficLightRecord {
    /** 记录ID */
    id?: number;
    /** 创建时间 */
    createTime?: string;
    /** 更新时间 */
    updateTime?: string;
    /** 创建人 */
    createUser?: string;
    /** 更新人 */
    updateUser?: string;
    /** 交通信号灯唯一key */
    deviceKey?: string;
    /** 交通信号灯名称 */
    deviceName?: string;
    /** 交通灯设备配置 */
    deviceConfig?: DeviceConfig;
    /** 交通灯是否需要同步等待响应 */
    syncWaitResponse?: boolean;
    /** 设备驱动唯一key */
    driverKey?: string;
}

/**
 * 交通灯驱动信息
 * 用于 getTrafficLightDrivers 接口的响应数据
 */
export interface TrafficLightDriver {
    /** 驱动唯一名称 */
    name: string;
    /** 驱动唯一key */
    key: string;
    /** 驱动协议配置 */
    driverProtocol: Record<string, any>;
}

/**
 * 添加交通信号灯参数
 * 用于 addTrafficLight 接口的请求体
 */
export interface AddTrafficLightParams {
    /** 交通信号灯名称 */
    deviceName: string;
    /** 交通灯设备配置 */
    deviceConfig: DeviceConfig;
    /** 交通灯是否需要同步等待响应 */
    syncWaitResponse?: boolean;
    /** 设备驱动唯一key */
    driverKey?: string;
}

/**
 * 更新交通信号灯参数
 * 用于 updateTrafficLight 接口的请求体，比新增多一个 deviceKey 字段
 */
export interface UpdateTrafficLightParams extends AddTrafficLightParams {
    /** 交通信号灯唯一key */
    deviceKey: string;
}

/**
 * 删除交通信号灯参数
 * 用于 deleteTrafficLight 接口的请求体
 */
export interface DeleteTrafficLightParams {
    /** 交通信号灯唯一key */
    deviceKey: string;
}
