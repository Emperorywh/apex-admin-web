/**
 * 地图只读数据 DTO（T00.7 共享地图能力）。
 *
 * 来源与边界：
 * - getMapInfo 的响应 schema 在 OpenAPI 中未定义（通配媒体类型），
 *   字段结构依据旧系统当前可达实现（dd KonvaMap/useMapData + MappingModal）
 *   核实登记：`data.currentMapInfoVersion.mapJson.{nodes,edges}`；
 * - DTO 保留后端真实字段（含尚未消费的业务字段），未知枚举不做前端收窄；
 * - MapNodeDto/MapEdgeDto 是节点映射、地图关联、点边组合等页面共享的
 *   只读渲染契约；地图编辑（暂缓 H02）不消费本文件。
 */

/** 地图节点业务类型（后端原值；warehouse_font 为历史拼写，运行时实际下发） */
export type MapNodeType =
  | 'node'
  | 'work'
  | 'shelf'
  | 'charge'
  | 'park'
  | 'warehouse_front'
  | 'warehouse_back'

/** 地图节点（米制世界坐标；字段与旧可达实现逐一对应） */
export interface MapNodeDto {
  id: string
  name: string
  type: MapNodeType
  mapId: string
  x: number
  y: number
  /** 朝向角（弧度或角度未在文档声明，原样透传给渲染层） */
  angle: number | null
  allowVehicleGroups: string[] | null
  enterChargeStationId: string | null
  enableLimitForkLiftRotation: boolean
  /** 旧实现未消费的扩展字段：原样保留，不猜结构 */
  actions: unknown[]
  userDefinedProperties: unknown
  addDis: number | null
}

/** 地图路径类型（后端原值） */
export type MapEdgeType = 'LINE' | 'BEZIER'

/** 地图路径（米制世界坐标；cx/cy/dx/dy 存在时为贝塞尔曲线） */
export interface MapEdgeDto {
  id: string
  name: string
  mapId: string
  edgeType: MapEdgeType
  sx: number
  sy: number
  ex: number
  ey: number
  cx: number | null
  cy: number | null
  dx: number | null
  dy: number | null
  /** 反向路径（渲染为红色，可辨识行进方向） */
  isBackEdge: boolean
  cost: number
  snodeId: string
  enodeId: string
  sfacing: number
  efacing: number
  loadType: number
  enableLimitForkLiftReturn: boolean
  allowVehicleGroups: string[]
  maxLoadSpeed: number
  maxFreeSpeed: number
  actions: unknown[]
  userDefinedProperties: unknown
}

/** 地图结构 JSON（getMapInfo.data.currentMapInfoVersion.mapJson 的内容） */
export interface MapJsonDto {
  nodes?: MapNodeDto[]
  edges?: MapEdgeDto[]
}

/** 前端消费的地图图形实体：节点与路径集合（渲染层唯一输入形状） */
export interface MapGraph {
  nodes: MapNodeDto[]
  edges: MapEdgeDto[]
}

/**
 * 简单地图信息（GET /dispatcher/map/getSimpleMaps，OpenAPI SimpleMap schema）。
 * 地图下拉选项的唯一数据源（P07/P09/P10/P11 等消费）。
 */
export interface SimpleMapDto {
  /** 地图唯一 id */
  mapId?: string
  /** 地图名称 */
  mapName?: string
}
