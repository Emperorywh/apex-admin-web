/**
 * 车辆状态 DTO（P39；GET /dispatcher/vehicle/getVehicleState，OpenAPI
 * VehicleStateRecord 及其子 schema 逐一核对）。
 *
 * 与 P05 的车辆管理 DTO（vehicle-manage.service.types）分文件维护：本文件只承载
 * 完整车辆详情页的调度域状态协议（VehicleStateRecord），与列表页行记录内嵌的
 * State（车辆平台域状态）不是同一结构，不合并。
 *
 * 字段纪律：契约未标注必填的属性一律可空——空值留白由展示层处理，本层不补默认值。
 */

/** 车辆类型（OpenAPI int32；1=叉车、2=小车为既定取值域，未知值显示原值） */
export type VehicleAgvType = 1 | 2

/** 订单状态（OpenAPI 七值枚举；未知值显示协议原值） */
export type VehicleOrderState =
  | 'IN_QUEUE'
  | 'OUT_QUEUE'
  | 'PROCESSING'
  | 'HANG'
  | 'CANCELLED'
  | 'SUCCEEDED'
  | 'FAILED'

/** 网络连接状态（OpenAPI 三值枚举） */
export type VehicleStateConnectionState = 'ONLINE' | 'OFFLINE' | 'CONNECTIONBROKEN'

/** 车辆执行状态（OpenAPI 八值枚举；旧系统 RobotStatus 枚举同口径） */
export type VehicleProcStatus =
  | 'IDLE'
  | 'CHARGE'
  | 'PROCESSING'
  | 'PAUSED'
  | 'TRAFFIC'
  | 'AVOID'
  | 'BRAKE'
  | 'ERROR'

/** 调度状态（OpenAPI 枚举：ENABLE 启用 / DISABLE 禁用） */
export type VehicleStateDispatchState = 'ENABLE' | 'DISABLE'

/** 紧急停车状态（OpenAPI 四值枚举） */
export type VehicleEstopState = 'AUTOACK' | 'MANUAL' | 'REMOTE' | 'NONE'

/** AGV 安全状态（OpenAPI SafetyState） */
export interface SafetyStateDto {
  /** true=安全域被入侵（如遇障）；false=未入侵 */
  fieldViolation?: boolean | null
  estop?: VehicleEstopState | null
}

/** AGV 电池状态（OpenAPI BatteryState；reach 为电池电流，标签沿用旧实现） */
export interface BatteryStateDto {
  batteryCharge?: number | null
  batteryVoltage?: number | null
  batteryHealth?: number | null
  charging?: boolean | null
  reach?: number | null
}

/** AGV 尺寸（米；OpenAPI AGVDimension） */
export interface AgvDimensionStateDto {
  length?: number | null
  width?: number | null
  centerOffset?: number | null
  loadLength?: number | null
  loadWidth?: number | null
}

/** AGV 定位信息（OpenAPI AgvPosition） */
export interface AgvPositionStateDto {
  x?: number | null
  y?: number | null
  /** 车辆朝向角，弧度，范围 [-PI, PI] */
  theta?: number | null
  mapId?: string | null
  mapDescription?: string | null
  positionInitialized?: boolean | null
  /** 定位置信度，范围 [0.0, 1.0] */
  localizationScore?: number | null
  /** 定位偏差范围值（米） */
  deviationRange?: number | null
  normal?: boolean | null
}

/** 载货包围盒参考（OpenAPI BoundingBoxReference；契约未声明属性细节） */
export interface BoundingBoxReferenceDto {
  [key: string]: unknown
}

/** 载货尺寸（OpenAPI LoadDimensions；契约未声明属性细节） */
export interface LoadDimensionsDto {
  [key: string]: unknown
}

/** AGV 载货信息（OpenAPI Load；契约比旧页面类型多出的子对象，递归展示语义自然覆盖） */
export interface LoadDto {
  loadId?: string | null
  loadType?: string | null
  loadPosition?: string | null
  weight?: number | null
  boundingBoxReference?: BoundingBoxReferenceDto | null
  loadDimensions?: LoadDimensionsDto | null
}

/** 车辆完整状态（OpenAPI VehicleStateRecord） */
export interface VehicleStateRecordDto {
  agvKey?: string | null
  agvName?: string | null
  type?: VehicleAgvType | null
  /** 车辆正在执行的订单 key */
  orderKey?: string | null
  orderName?: string | null
  orderState?: VehicleOrderState | null
  connectionState?: VehicleStateConnectionState | null
  safetyState?: SafetyStateDto | null
  batteryState?: BatteryStateDto | null
  agvDimension?: AgvDimensionStateDto | null
  agvPosition?: AgvPositionStateDto | null
  vehicleProcStatus?: VehicleProcStatus | null
  dispatchState?: VehicleStateDispatchState | null
  paused?: boolean | null
  loaded?: boolean | null
  load?: LoadDto | null
  /** 创建时间（int64 毫秒时间戳） */
  createTime?: number | null
}
