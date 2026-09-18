/**
 * 车辆管理 DTO（P05；GET/POST /dispatcher/vehicle/*，OpenAPI Vehicle* schema）。
 *
 * 与共享选项 DTO（vehicle.service.types 的 SimpleVehicleDto）分文件维护：
 * 本文件只承载车辆管理页的列表/表单/指令协议，选项契约仍归 contracts.md 第 5 节。
 */

/** 网络状态（OpenAPI 枚举；未知值显示协议原值，不臆造语义） */
export type VehicleConnectionState = 'ONLINE' | 'OFFLINE' | 'CONNECTIONBROKEN'

/** 调度状态（OpenAPI 枚举：ENABLE 启用 / DISABLE 禁用） */
export type VehicleDispatchState = 'ENABLE' | 'DISABLE'

/** 车辆指令操作类型（OpenAPI VehicleOperate.operate 枚举） */
export type VehicleOperateCommand = 'PAUSE' | 'CONTINUE' | 'ENABLED' | 'DISABLED'

/** AGV 尺寸（米；OpenAPI AgvDimension） */
export interface AgvDimensionDto {
  length?: number | null
  width?: number | null
  centerOffset?: number | null
  loadLength?: number | null
  loadWidth?: number | null
}

/** AGV 定位（OpenAPI AgvPosition 的列表页消费子集） */
export interface AgvPositionDto {
  x?: number | null
  y?: number | null
  theta?: number | null
  mapDescription?: string | null
  localizationScore?: number | null
}

/** 车辆运行状态（OpenAPI State；详情抽屉消费，结构保持协议原样不裁剪） */
export interface VehicleStateDto {
  maps?: { mapId?: string | null; mapDescription?: string | null }[] | null
  orderId?: string | null
  orderUpdateId?: number | null
  lastNodeId?: string | null
  lastNodeSequenceId?: number | null
  driving?: boolean | null
  paused?: boolean | null
  operatingMode?: string | null
  nodeStates?: unknown[] | null
  edgeStates?: unknown[] | null
  agvPosition?: AgvPositionDto | null
  velocity?: { vx?: number | null; vy?: number | null; omega?: number | null } | null
  loads?: unknown[] | null
  actionStates?: unknown[] | null
  batteryState?: {
    batteryCharge?: number | null
    charging?: boolean | null
  } | null
  errors?: unknown[] | null
  safetyState?: { estop?: string | null } | null
}

/** 车辆列表行记录（OpenAPI VehicleRecord；本页唯一列表/详情数据源） */
export interface VehicleRecordDto {
  /** 车辆唯一 key（调度系统标识，行 ID 与指令目标） */
  key?: string | null
  name?: string | null
  /** 车辆类型数值（旧系统既定语义：1=叉车、2=小车；未知值显示原值） */
  vehicleType?: number | null
  agvDimension?: AgvDimensionDto | null
  state?: VehicleStateDto | null
  connectionState?: VehicleConnectionState | string | null
  dispatchState?: VehicleDispatchState | string | null
  createTime?: string | null
}

/** 车辆分页数据（OpenAPI PageVehicleRecord 的已消费字段） */
export interface VehiclePage {
  records?: VehicleRecordDto[] | null
  total?: number | null
  size?: number | null
  current?: number | null
}

/** 列表查询参数（OpenAPI VehiclePageParamVehicle；pageNo 从 1 计数） */
export interface VehiclePageParam {
  pageNo: number
  pageSize: number
  /** 车辆名称或唯一 key 模糊查询 */
  query?: string
}

/**
 * 新增/编辑车辆表单参数（OpenAPI VehicleAddParam / VehicleUpdateParam 字段一致，共用形状）。
 * add 与 update 的差异由调用点表达：新增带未关联上报车辆选择的 agvKey；
 * 编辑时 agvKey 固定为行记录 key（后端以 key 定位，不可改）。
 */
export interface VehicleFormParam {
  agvKey: string
  agvName: string
  agvType?: number
  length: number
  width: number
  loadLength: number
  loadWidth: number
  centerOffset: number
  dispatchState: VehicleDispatchState
}

/** 删除车辆参数（OpenAPI VehicleDeleteParam） */
export interface VehicleDeleteParam {
  key: string
}

/** 单车指令参数（OpenAPI VehicleOperate） */
export interface VehicleOperateParam {
  vehicleKey: string
  operate: VehicleOperateCommand
}

/**
 * 批量指令参数（OpenAPI VehicleBatchOperate）。
 * vehicleKeys 不传 = 对全部车辆操作（旧实现语义，协议原样保留）。
 */
export interface VehicleBatchOperateParam {
  vehicleKeys?: string[]
  operate: VehicleOperateCommand
}
