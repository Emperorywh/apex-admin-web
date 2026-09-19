/**
 * 多地图点边组合（P11）协议 DTO（owner=P11，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json（SystemNodeEdgeGroup / MapNodeEdgeGroupJson /
 * NodeEdgeGroup / SimpleMap / SystemNodeEdgeGroupAddParam /
 * SystemNodeEdgeGroupUpdateParam / SystemNodeEdgeGroupParam /
 * LittleSimpleMapNodeEdgeGroup），文档未标 required 一律可选，消费侧按留白处理。
 * 精度纪律（G10）：行主键 id（int64）以 JSON number 承载；点边组合 id 与地图 id
 * 在协议层即为 string（OpenAPI 明确 string 类型），原样保持不转数字。
 */

/** 点边组合明细（OpenAPI NodeEdgeGroup；地图点边组合在地图编辑侧维护，本页只读引用） */
export interface NodeEdgeGroupDetailDto {
  /** 点边组合唯一 id（string 协议原样；提交用 mapNodeEdgeGroupIds 元素） */
  id?: string
  /** 点边组合名称 */
  name?: string
  /** 包含的边 id 集合（子表「边数量」取其长度） */
  edgeIds?: string[]
  /** 包含的节点 id 集合（子表「节点数量」取其长度） */
  nodeIds?: string[]
}

/** 点边组合所属地图简单信息（OpenAPI SimpleMap） */
export interface SimpleMapDto {
  /** 地图唯一 id（string 协议原样） */
  mapId?: string
  /** 地图名称 */
  mapName?: string
}

/** 行内单条「点边组合-所属地图」对（OpenAPI MapNodeEdgeGroupJson；展开行子表数据源） */
export interface MapNodeEdgeGroupJsonDto {
  /** 点边组合明细 */
  nodeEdgeGroup?: NodeEdgeGroupDetailDto
  /** 所属地图简单信息 */
  simpleMap?: SimpleMapDto
}

/** 多地图点边组合记录（GET pageSystemNodeEdgeGroups 行记录；OpenAPI SystemNodeEdgeGroup） */
export interface SystemNodeEdgeGroupDto {
  /** 技术主键（int64；编辑/删除按它定位，JSON number 承载 G10 同 P09/P10） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 系统多地图点边组合唯一名称 */
  nodeEdgeGroupName?: string
  /** 系统多地图点边组合唯一 key（后端生成，列表展示） */
  nodeEdgeGroupKey?: string
  /** 关联的地图点边组合集合（展开行子表数据源） */
  nodeEdgeGroups?: MapNodeEdgeGroupJsonDto[]
}

/** 多地图点边组合分页数据（PageSystemNodeEdgeGroup，My-Plus 形态） */
export interface SystemNodeEdgeGroupPageDto {
  records?: SystemNodeEdgeGroupDto[]
  total?: number
  size?: number
  current?: number
}

/** 分页查询参数（GET query 平铺；pageNo 从 1 计数，G04 同款） */
export interface SystemNodeEdgeGroupPageParam {
  pageNo: number
  pageSize: number
  /** 按组合名称模糊查询 */
  query?: string
}

/** 创建参数（POST createSystemNodeEdgeGroup；OpenAPI SystemNodeEdgeGroupAddParam） */
export interface SystemNodeEdgeGroupCreateParam {
  /** 系统多地图点边组合唯一名称 */
  systemNodeEdgeGroupName: string
  /** 地图点边组合 id 集合（string 数组按用户选择顺序原样提交） */
  mapNodeEdgeGroupIds: string[]
}

/** 编辑参数（POST updateSystemNodeEdgeGroup；OpenAPI SystemNodeEdgeGroupUpdateParam，
 * 按 int64 主键定位，mapNodeEdgeGroupIds 集合整体替换——协议语义页面照实提交） */
export interface SystemNodeEdgeGroupUpdateParam {
  systemNodeEdgeGroupId: number
  systemNodeEdgeGroupName: string
  mapNodeEdgeGroupIds: string[]
}

/** 删除参数（POST deleteSystemNodeEdgeGroup；OpenAPI SystemNodeEdgeGroupParam） */
export interface SystemNodeEdgeGroupDeleteParam {
  systemNodeEdgeGroupId: number
}

/** 点边组合选项（GET getAllSimpleNodeEdgeGroups 行记录；OpenAPI LittleSimpleMapNodeEdgeGroup，
 * 全部地图的点边组合扁平集合，本页弹窗穿梭框数据源） */
export interface SimpleNodeEdgeGroupOptionDto {
  /** 点边组合唯一 id（string 协议原样） */
  id?: string
  /** 点边组合名称 */
  name?: string
}
