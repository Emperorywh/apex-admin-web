/**
 * 地图推送记录（P12）协议 DTO（owner=P12，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json（MapPushRecord / MapPushSubRecord /
 * PageMapPushRecord / MapPushRecordPageParamMapPushRecord / MapRePushParam），
 * 文档未标 required 一律可选，消费侧按留白处理。
 * 精度纪律（G10）：行主键 id / mapPushRecordId（int64）以 JSON number 承载；
 * mapId（推送的地图唯一 key）在协议层即为 string，原样保持不转数字。
 */

/**
 * 推送子记录状态枚举（OpenAPI mapPushState）：
 * 等待 / 推送中 / 失败 / 成功 / 已取消；
 * 仅 WAITING / RUNNING 存在未完成推送，取消操作只对其有意义（旧实现同边界）。
 */
export type MapPushState = 'WAITING' | 'RUNNING' | 'FAILED' | 'SUCCEEDED' | 'CANCELLED'

/** 推送子记录（OpenAPI MapPushSubRecord；主行 mapPushSubRecords 元素，展开行子表数据源） */
export interface MapPushSubRecordDto {
  /** 技术主键（int64；子记录级重推/取消按它定位，JSON number 承载 G10 同 P11） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 所属推送记录 id（int64；子记录级操作请求体必带） */
  mapPushRecordId?: number
  /** 推送唯一 key（后端生成标识，页面不消费） */
  subRecordKey?: string
  /** 推送的车辆 key */
  vehicleKey?: string
  /** 推送的车辆名称（子表展示列） */
  vehicleName?: string
  /** 地图推送状态（枚举见 MapPushState） */
  mapPushState?: MapPushState
  /** 地图推送完成时间（仅终态有值；缺失留白） */
  finishTime?: string
  /** 推送失败原因 */
  failReason?: string
  /** 推送取消原因（OpenAPI 保留字段；旧实现已改用 waitReason，仍原样承接不丢） */
  cancelReason?: string
  /** 推送等待原因（如「车辆不是禁用状态」，解释子记录为何仍处于等待） */
  waitReason?: string
}

/** 推送记录（OpenAPI MapPushRecord；一行 = 一次推送批次，含多台车辆子记录） */
export interface MapPushRecordDto {
  /** 技术主键（int64；记录级重推/取消按它定位，JSON number 承载 G10 同 P11） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 推送的地图唯一 key（string 协议原样） */
  mapId?: string
  /** 推送的地图名称 */
  mapName?: string
  /** 推送的地图版本 */
  mapVersion?: string
  /** 推送的地图下载地址（旧页面不消费，保持协议原样不丢） */
  mapDownloadLink?: string
  /** 是否推送 SLAM 底图 */
  enabledPushSlamMap?: boolean
  /** 推送的地图子记录集合（展开行子表数据源；主表「推送结果」列按状态汇总计数） */
  mapPushSubRecords?: MapPushSubRecordDto[]
}

/** 推送记录分页数据（PageMapPushRecord，My-Plus 形态） */
export interface MapPushRecordPageDto {
  records?: MapPushRecordDto[]
  total?: number
  size?: number
  current?: number
}

/**
 * 分页查询参数（GET query 平铺；pageNo 从 1 计数，G04 同款；
 * OpenAPI MapPushRecordPageParamMapPushRecord 仅有分页两个字段——
 * 接口不支持任何筛选/排序（G09 不开放排序），旧实现同边界）。
 */
export interface MapPushRecordPageParam {
  pageNo: number
  pageSize: number
}

/**
 * 重推 / 取消推送共用请求体（OpenAPI MapRePushParam）：
 * - 记录级：只带 mapPushRecordId，后端对该记录下全部子记录生效；
 * - 子记录级：另带 mapPushSubRecordIds（单元素数组），仅对单台车辆生效。
 */
export interface MapRePushParam {
  /** 推送记录的 id（int64） */
  mapPushRecordId: number
  /** 推送子记录的 id 集合（int64；记录级操作不传） */
  mapPushSubRecordIds?: number[]
}
