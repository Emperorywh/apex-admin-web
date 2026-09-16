/**
 * 坐标点（对应后端 Point / Point2D）
 * 映射点位与候选点位共用
 */
export interface MappingPoint {
    /** x 坐标 */
    x?: number;
    /** y 坐标 */
    y?: number;
}

/**
 * 地图节点（对应后端 MappingNode）
 */
export interface MappingNode {
    /** 节点ID */
    nodeId?: string;
    /** 节点名称 */
    nodeName?: string;
    /** 节点 x 坐标 */
    x?: number;
    /** 节点 y 坐标 */
    y?: number;
}

/**
 * 节点映射（对应后端 NodeMapping）
 * 一条「地图节点 ↔ 映射点位」的对应关系
 */
export interface NodeMapping {
    /** 地图节点 */
    mapNode?: MappingNode;
    /** 映射点位 */
    mappingPoint?: MappingPoint;
}

/**
 * 单张地图的节点映射（对应后端 MapNodeMapping）
 * 按地图分组的节点映射列表
 */
export interface MapNodeMapping {
    /** 地图ID */
    mapId?: string;
    /** 地图名称 */
    mapName?: string;
    /** 该地图下的节点映射列表 */
    nodeMappings?: NodeMapping[];
}

/**
 * 更新AGV节点映射参数（对应后端 AGVNodeMappingUpdateParam）
 * 2026-08-19 起与保存接口结构对齐：按地图分组的 nodeMappings + agvKeys，整体替换语义
 */
export interface AGVNodeMappingUpdateParam {
    /** 映射唯一key */
    mappingKey?: string;
    /** 映射名称 */
    mappingName?: string;
    /** 节点映射列表（按地图分组） */
    nodeMappings?: MapNodeMapping[];
    /** AGV唯一key集合 */
    agvKeys?: string[];
}

/**
 * 保存AGV节点映射参数（对应后端 AGVNodeMappingAddParam）
 * 注意：nodeMappings 字段虽叫 nodeMappings，实际元素为按地图分组的 MapNodeMapping
 */
export interface AGVNodeMappingAddParam {
    /** 映射名称 */
    mappingName?: string;
    /** 节点映射列表（按地图分组） */
    nodeMappings?: MapNodeMapping[];
    /** AGV唯一key集合 */
    agvKeys?: string[];
}

/**
 * 删除AGV节点映射参数（对应后端 AGVNodeMappingParam）
 */
export interface AGVNodeMappingParam {
    /** 映射唯一key */
    mappingKey?: string;
}

/**
 * 分页查询节点映射参数（对应后端 AGVNodeMappingPageParam）
 */
export interface AGVNodeMappingPageParam {
    /** 每页的数量 */
    pageSize?: number;
    /** 当前的页码 */
    pageNo?: number;
    /** 映射名称（模糊查询） */
    mappingName?: string;
}

/**
 * AGV节点映射记录（对应后端 AGVNodeMapping）
 * mapNodeMapping 字段虽为单数命名，实际是按地图分组的数组
 */
export interface AGVNodeMapping {
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
    /** 映射唯一key */
    mappingKey?: string;
    /** 映射名称 */
    mappingName?: string;
    /** 节点映射列表（按地图分组） */
    mapNodeMapping?: MapNodeMapping[];
    /** AGV唯一key集合 */
    agvKeys?: string[];
}

/**
 * 节点映射分页数据（对应后端 PageAGVNodeMapping）
 * 仅声明前端实际消费的分页字段，忽略 orders/optimizeCountSql 等 MyBatis-Plus 内部字段
 */
export interface PageAGVNodeMapping {
    /** 节点映射记录列表 */
    records: AGVNodeMapping[];
    /** 总条数 */
    total: number;
    /** 每页数量 */
    size: number;
    /** 当前页码 */
    current: number;
    /** 总页数 */
    pages: number;
}

/**
 * 分页查询节点映射响应结果（对应后端 ResultPageAGVNodeMapping）
 */
export interface ResultPageAGVNodeMapping {
    /** 返回码，200 正常 */
    code: number;
    /** 返回信息 */
    message: string;
    /** 时间戳 */
    timestamp: number;
    /** 分页数据 */
    data: PageAGVNodeMapping;
}

/**
 * 获取采集点位建议参数
 * mapId 必传，expectedCount 可选（期望的采集点位数量）
 */
export interface CollectionNodeSuggestionParam {
    /** 地图ID */
    mapId: string;
    /** 期望点位数量（可选，不传由后端自动计算预算） */
    expectedCount?: number;
}

/**
 * 候选点位（对应后端 CandidatePoint）
 */
export interface CandidatePoint {
    /** 点位ID */
    id?: string;
    /** 点位名称 */
    name?: string;
    /** 点位坐标 */
    point?: MappingPoint;
}

/**
 * 采集点位建议（对应后端 Suggestion）
 */
export interface CollectionNodeSuggestion {
    /** 建议的控制点（采集点位）列表 */
    controlPoints?: CandidatePoint[];
    /** 点位预算数量 */
    budget?: number;
    /** 是否自动计算预算 */
    autoBudget?: boolean;
    /** 点位总数 */
    totalPoints?: number;
    /** 未覆盖点位数量 */
    uncoveredCount?: number;
    /** 未覆盖比例 */
    uncoveredRatio?: number;
    /** 未覆盖点位列表 */
    uncoveredPoints?: CandidatePoint[];
}

/**
 * 获取采集点位建议响应结果（对应后端 ResultSuggestion）
 */
export interface ResultCollectionNodeSuggestion {
    /** 返回码，200 正常 */
    code: number;
    /** 返回信息 */
    message: string;
    /** 时间戳 */
    timestamp: number;
    /** 采集点位建议数据 */
    data: CollectionNodeSuggestion;
}
