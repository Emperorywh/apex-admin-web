/**
 * 车辆分组服务 DTO（dispatcher/vehicleGroup，OpenAPI schema 逐字段核对）。
 *
 * - VehicleGroupDto：全量分组选项（GET getVehicleGroups，P03 代建的共享选项契约，
 *   P04/P20 消费；仅保留选项场景消费的字段）；
 * - VehicleGroupRecordDto：分组管理页行记录（GET pageVehicleGroups，OpenAPI
 *   AGVGroup schema 完整超集）；P04 起本文件 owner 归 P04（contracts.md 第 5 节）。
 */

/** 组内简单车辆条目（OpenAPI SimpleAGV schema；编辑回填与展开行共用） */
export interface SimpleAGVDto {
  /** 车辆唯一 key */
  key?: string
  /** 车辆名称（展示用；缺失时展示原 key，不猜测） */
  name?: string
}

/** 车辆分组信息：分组 key/名称 + 组内车辆 key 集合（选项场景主要消费 key 与名称） */
export interface VehicleGroupDto {
  /** 后端自增主键（int64，JSON number 承载；G10 精度联调核实项） */
  id?: number
  /** 分组唯一 key（调度系统标识） */
  agvGroupKey?: string
  /** 分组名称（展示用） */
  agvGroupName?: string
  /** 组内车辆 key 集合（创建任务选分组提交时由后端解析，不在前端展开） */
  agvKeys?: string[]
}

/**
 * 分组管理页行记录（OpenAPI AGVGroup 完整字段）。
 * agvKeys 与 simpleAGVs 语义重叠（组内车辆 key 集合 vs 简单条目）；
 * 编辑回填/展开行沿用旧实现口径消费 simpleAGVs，agvKeys 作为契约超集保留。
 */
export interface VehicleGroupRecordDto extends VehicleGroupDto {
  /** 创建时间（yyyy-MM-dd HH:mm:ss 字符串，展示层经 displayDateTime 统一） */
  createTime?: string
  /** 更新时间（同上） */
  updateTime?: string
  /** 创建人（原始值，缺失留白） */
  createUser?: string
  /** 更新人（原始值，缺失留白） */
  updateUser?: string
  /** 组内简单车辆条目（名称+key；编辑回填与展开行数据源） */
  simpleAGVs?: SimpleAGVDto[]
}

/** 分页查询参数（OpenAPI AGVGroupPageParamAGVGroup；query 匹配名称或唯一 key） */
export interface VehicleGroupPageParam {
  /** 当前的页码（后端 1 计数，页面用 toBackendPage 从零基 pageIndex 换算） */
  pageNo: number
  /** 每页的数量 */
  pageSize: number
  /** 车辆组名称或者唯一 key（可选筛选） */
  query?: string
}

/** 分页响应（OpenAPI PageAGVGroup，仅消费业务字段；其余 MyBatis-Plus 元数据不接） */
export interface VehicleGroupPage {
  records?: VehicleGroupRecordDto[]
  total?: number
  size?: number
  current?: number
}

/** 新增车辆分组参数（OpenAPI VehicleGroupAddParam） */
export interface VehicleGroupAddParam {
  /** 车型组名称 */
  groupName: string
  /** 车型组包含的 key（可为空数组：允许先建空组再维护） */
  vehicleKeys: string[]
}

/** 更新车辆分组参数（OpenAPI VehicleGroupUpdateParam；groupKey 定位，全量提交组内车辆） */
export interface VehicleGroupUpdateParam {
  /** 车型组唯一 key */
  groupKey: string
  /** 车型组名称 */
  groupName: string
  /** 车型组包含的 key（全量语义：以本次提交为准） */
  vehicleKeys: string[]
}

/** 删除车辆分组参数（OpenAPI VehicleGroupDeleteParam） */
export interface VehicleGroupDeleteParam {
  /** 分组唯一 key */
  key: string
}
