/**
 * 分页查询载具类型参数
 * 用于 pageCarriers 接口的查询参数
 */
export interface PageCarrierParams {
    /** 每页数量 */
    pageSize: number;
    /** 当前页码 */
    pageNo: number;
    /** 载具名称 */
    carrierName?: string;
    /** 载具编码 */
    carrierCode?: string;
}

/**
 * 载具类型记录
 * 包含载具类型的完整信息，用于分页查询的响应数据
 */
export interface CarrierRecord {
    /** 记录ID */
    id: number;
    /** 创建时间 */
    createTime?: string;
    /** 更新时间 */
    updateTime?: string;
    /** 创建人 */
    createUser?: string;
    /** 更新人 */
    updateUser?: string;
    /** 载具名称 */
    carrierName?: string;
    /** 载具编码 */
    carrierCode?: string;
    /** 载具长度(mm) */
    carrierLength?: number;
    /** 载具宽度(mm) */
    carrierWidth?: number;
}

/**
 * 分页查询载具类型响应数据
 */
export interface CarrierPageResult {
    records: CarrierRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

/**
 * 添加载具类型参数
 * 用于 createCarrier 接口的请求体
 */
export interface CreateCarrierParams {
    /** 载具名称 */
    carrierName: string;
    /** 载具编码 */
    carrierCode: string;
    /** 载具长度(mm) */
    carrierLength: number;
    /** 载具宽度(mm) */
    carrierWidth: number;
}

/**
 * 更新载具类型参数
 * 用于 updateCarrier 接口的请求体，比新增多一个 id 字段
 */
export interface UpdateCarrierParams extends CreateCarrierParams {
    /** 载具类型ID */
    id: number;
}

/**
 * 删除载具类型参数
 * 用于 deleteCarrier 接口的请求体
 */
export interface DeleteCarrierParams {
    /** 载具类型ID */
    id: number;
}
