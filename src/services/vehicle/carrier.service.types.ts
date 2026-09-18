/**
 * 载具类型服务 DTO（dispatcher/carrier，OpenAPI 与旧实现逐字段核对）。
 *
 * 载具（Carrier）是调度系统的运载单元类型配置（长宽尺寸，单位 mm），
 * 与车辆（AGV）型号业务无关：字段名与单位均保留协议原样，不擅自改语义。
 * P06 起本文件 owner 归 P06（contracts.md 第 5 节）。
 */

/** 载具类型行记录（旧实现 CarrierRecord 同形；分页查询行数据源） */
export interface CarrierRecordDto {
  /** 记录 ID（后端自增主键；int64 经 JSON number 承载，行 ID 层转字符串） */
  id?: number
  /** 创建时间（yyyy-MM-dd HH:mm:ss 字符串，展示层经 displayDateTime 统一） */
  createTime?: string
  /** 更新时间（同上） */
  updateTime?: string
  /** 创建人（原始值，缺失留白） */
  createUser?: string
  /** 更新人（原始值，缺失留白） */
  updateUser?: string
  /** 载具名称（展示用） */
  carrierName?: string
  /** 载具编码（展示用） */
  carrierCode?: string
  /** 载具长度（mm，协议原样数值） */
  carrierLength?: number
  /** 载具宽度（mm，协议原样数值） */
  carrierWidth?: number
}

/** 分页查询参数（旧实现 PageCarrierParams 同形；POST 请求体平铺） */
export interface CarrierPageParam {
  /** 当前的页码（后端 1 计数，页面用 toBackendPage 从零基 pageIndex 换算） */
  pageNo: number
  /** 每页的数量 */
  pageSize: number
  /** 载具名称（可选筛选） */
  carrierName?: string
  /** 载具编码（可选筛选） */
  carrierCode?: string
}

/** 分页响应（旧实现 CarrierPageResult 同形；MyBatis-Plus 分页结构） */
export interface CarrierPage {
  records?: CarrierRecordDto[]
  total?: number
  size?: number
  current?: number
  pages?: number
}

/** 新增载具类型参数（旧实现 CreateCarrierParams 同形） */
export interface CarrierAddParam {
  /** 载具名称 */
  carrierName: string
  /** 载具编码 */
  carrierCode: string
  /** 载具长度（mm） */
  carrierLength: number
  /** 载具宽度（mm） */
  carrierWidth: number
}

/** 编辑载具类型参数：新增字段全量 + id 定位（旧实现 UpdateCarrierParams 同形） */
export interface CarrierUpdateParam extends CarrierAddParam {
  /** 载具类型 ID */
  id: number
}

/** 删除载具类型参数（按 id 定位） */
export interface CarrierDeleteParam {
  /** 载具类型 ID */
  id: number
}
