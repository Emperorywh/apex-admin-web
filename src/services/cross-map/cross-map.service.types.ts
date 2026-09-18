/**
 * 地图关联（P10 跨地图关联页）协议 DTO（owner=P10，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json（CrossMap / CrossMapModel / CrossMapAddParam /
 * CrossMapUpdateParam / CrossMapDeleteParam / SimpleStation / DeviceElevator），
 * 文档未标 required 一律可选，消费侧按留白处理；int64 主键（id）保持 JSON
 * number 承载（G10 纪律同 P09）。
 */

/** 跨地图关联内的单条「地图-节点」对（OpenAPI CrossMapModel） */
export interface CrossMapModelDto {
  /** 地图唯一 id */
  mapId?: string
  /** 地图名称 */
  mapName?: string
  /** 节点唯一 id */
  nodeId?: string
  /** 节点名称 */
  nodeName?: string
}

/** 跨地图关联记录（GET pageCrossMaps 行记录；OpenAPI CrossMap schema） */
export interface CrossMapDto {
  /** 技术主键（int64；编辑/删除按它定位） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 跨地图名称 */
  crossMapName?: string
  /** 关联电梯设备唯一 key */
  deviceKey?: string
  /** 关联电梯名称 */
  deviceName?: string
  /** 多地图对集合（展开行子表数据源） */
  crossMaps?: CrossMapModelDto[]
}

/** 跨地图关联分页数据（PageCrossMap，My-Plus 形态：records/total/size/current） */
export interface CrossMapPageDto {
  records?: CrossMapDto[]
  total?: number
  size?: number
  current?: number
}

/** 跨地图关联分页查询参数（GET query 平铺；pageNo 从 1 计数，G04 同款） */
export interface CrossMapPageParam {
  pageNo: number
  pageSize: number
  /** 按跨地图名称模糊查询 */
  query?: string
}

/** 创建/编辑提交内的「地图-节点」对（OpenAPI CrossMapParam；只含协议字段） */
export interface CrossMapItemParam {
  mapId: string
  nodeId: string
}

/** 创建跨地图关联参数（POST createCrossMap；OpenAPI CrossMapAddParam） */
export interface CrossMapCreateParam {
  crossMapName: string
  deviceKey: string
  crossMaps: CrossMapItemParam[]
}

/** 编辑跨地图关联参数（POST updateCrossMap；OpenAPI CrossMapUpdateParam，
 * 按 int64 主键 id 定位，整体替换 crossMaps 集合） */
export interface CrossMapUpdateParam {
  id: number
  crossMapName: string
  deviceKey: string
  crossMaps: CrossMapItemParam[]
}

/** 删除跨地图关联参数（POST deleteCrossMap；OpenAPI CrossMapDeleteParam） */
export interface CrossMapDeleteParam {
  id: number
}

/** 跨地图站点选项（GET getCrossMapStations 行记录；OpenAPI SimpleStation） */
export interface SimpleStationDto {
  /** 站点唯一 id（提交用 nodeId 原值） */
  id?: string
  /** 站点名称 */
  name?: string
  /** 站点所在地图 id（本页按行加载时与行地图一致性兜底核对） */
  mapId?: string
}

/**
 * 电梯选项（GET getElevators 行记录；OpenAPI DeviceElevator，本页仅声明
 * 选项消费的标识/名称/状态字段——ip/port/deviceConfig 等管理字段归 P14，
 * 不在本页 DTO 扩展）。
 */
export interface ElevatorOptionDto {
  id?: number
  /** 设备唯一 key（提交用 deviceKey 原值） */
  deviceKey?: string
  /** 设备名称 */
  deviceName?: string
  /** 启用/禁用状态（boolean，仅展示参考，不改变可选择性——旧实现同） */
  deviceStatus?: boolean
}
