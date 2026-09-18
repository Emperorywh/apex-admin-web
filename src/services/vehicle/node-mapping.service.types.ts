/**
 * AGV 节点映射 DTO（P07；operation 逐项核对 OpenAPI 与旧实现
 * C:\code\dd\src\types\VehicleDeploy\NodeMappingType.d.ts）。
 *
 * 形态纪律：
 * - 分页查询为 GET+query（pageNo 从 1 计数），增删改为 POST+JSON 请求体，
 *   与旧实现/规格清单一致，本层不做「归一化」改写；
 * - 记录主标识为 mappingKey（字符串）；id 为 int64 数字主键（协议原样，
 *   仅列表兜底展示用，不参与行 ID——行 ID 恒取 mappingKey）；
 * - mapNodeMapping 字段名为单数、实际是按地图分组的数组（后端命名原样保留）。
 */

/** 坐标点（后端 Point/Point2D）：映射点位与候选点位共用；缺失为 null 不猜 */
export interface MappingPointDto {
  x?: number | null
  y?: number | null
}

/** 地图节点（后端 MappingNode）：节点标识/名称 + 节点坐标（提交时需要坐标原样回传） */
export interface MappingNodeDto {
  nodeId?: string
  nodeName?: string
  x?: number | null
  y?: number | null
}

/** 单条节点映射：地图节点 ↔ 映射点位 */
export interface NodeMappingDto {
  mapNode?: MappingNodeDto
  mappingPoint?: MappingPointDto
}

/** 按地图分组的节点映射（后端 MapNodeMapping） */
export interface MapNodeMappingDto {
  mapId?: string
  mapName?: string
  nodeMappings?: NodeMappingDto[] | null
}

/** AGV 节点映射记录（后端 AGVNodeMapping） */
export interface AgvNodeMappingRecordDto {
  id?: number
  createTime?: string | null
  updateTime?: string | null
  createUser?: string | null
  updateUser?: string | null
  mappingKey?: string
  mappingName?: string
  /** 单数命名、实际为数组（后端命名原样） */
  mapNodeMapping?: MapNodeMappingDto[] | null
  agvKeys?: string[] | null
}

/** 分页数据体（仅声明前端消费字段，忽略 MyBatis-Plus 内部字段） */
export interface AgvNodeMappingPageDto {
  records?: AgvNodeMappingRecordDto[] | null
  total?: number
  size?: number
  current?: number
  pages?: number
}

/** 分页查询参数（GET+query；mappingName 模糊筛选，空串不传） */
export interface AgvNodeMappingPageParam {
  pageNo: number
  pageSize: number
  mappingName?: string
}

/** 新增参数：映射名称 + 按地图分组的 nodeMappings + AGV key 集合 */
export interface AgvNodeMappingSaveParam {
  mappingName: string
  nodeMappings: MapNodeMappingDto[]
  agvKeys: string[]
}

/** 编辑参数：与新增同构 + mappingKey 定位（2026-08-19 起整体替换语义，旧 SPEC §2.1） */
export interface AgvNodeMappingUpdateParam extends AgvNodeMappingSaveParam {
  mappingKey: string
}

/** 删除参数（按映射唯一 key 定位） */
export interface AgvNodeMappingDeleteParam {
  mappingKey: string
}

/** 采集点位建议查询参数：mapId 必传，expectedCount 可选（不传由后端自动预算） */
export interface CollectionNodeSuggestionParam {
  mapId: string
  expectedCount?: number
}

/** 候选点位（后端 CandidatePoint）：控制点即地图节点（id/name/point 一一对应） */
export interface CandidatePointDto {
  id?: string
  name?: string
  point?: MappingPointDto
}

/** 采集点位建议（后端 Suggestion）：前端仅消费 controlPoints（覆盖率等字段原样保留） */
export interface CollectionNodeSuggestionDto {
  controlPoints?: CandidatePointDto[] | null
  budget?: number
  autoBudget?: boolean
  totalPoints?: number
  uncoveredCount?: number
  uncoveredRatio?: number
  uncoveredPoints?: CandidatePointDto[] | null
}
