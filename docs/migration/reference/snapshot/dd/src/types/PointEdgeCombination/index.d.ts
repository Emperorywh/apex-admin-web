/**
 * 分页查询多地图点边组合的参数
 */
export interface PageSystemNodeEdgeGroupParam {
    /** 当前页码 */
    pageNo: number;
    /** 每页数量 */
    pageSize: number;
    /** 系统点边组合名称（模糊查询） */
    query?: string;
}

/**
 * 简单的地图点边组合（仅含 id 与名称，用于下拉选项）
 */
export interface LittleSimpleMapNodeEdgeGroup {
    /** 点边组合唯一id */
    id: string;
    /** 点边组合名称 */
    name: string;
}

/**
 * 简单的地图信息（点边组合所属地图）
 */
export interface SimpleMap {
    /** 地图id */
    mapId: string;
    /** 地图名称 */
    mapName: string;
}

/**
 * 点边组合明细（嵌套在地图点边组合条目中的点边组合本体）
 */
export interface NodeEdgeGroupDetail {
    /** 点边组合唯一id */
    id: string;
    /** 点边组合名称 */
    name: string;
    /** 包含的边id集合 */
    edgeIds: string[];
    /** 包含的节点id集合 */
    nodeIds: string[];
    /** 用户自定义属性 */
    userDefinedProperties?: Record<string, unknown>;
}

/**
 * 地图点边组合明细（列表展开行的子项）
 * 对应接口 nodeEdgeGroups 数组中的每一项，结构为 { nodeEdgeGroup, simpleMap }
 */
export interface NodeEdgeGroup {
    /** 点边组合本体 */
    nodeEdgeGroup: NodeEdgeGroupDetail;
    /** 所属地图简单信息 */
    simpleMap: SimpleMap;
}

/**
 * 系统多地图点边组合记录（列表行）
 */
export interface SystemNodeEdgeGroupRecord {
    /** 数据库id */
    id: number;
    /** 创建时间 */
    createTime: string;
    /** 更新时间 */
    updateTime: string;
    /** 创建人 */
    createUser: string;
    /** 更新人 */
    updateUser: string;
    /** 系统多地图点边组合唯一名称 */
    nodeEdgeGroupName: string;
    /** 系统多地图点边组合唯一key */
    nodeEdgeGroupKey: string;
    /** 关联的地图点边组合集合 */
    nodeEdgeGroups: NodeEdgeGroup[];
}

/**
 * 分页数据
 */
export interface PageSystemNodeEdgeGroupData {
    /** 当前页数据 */
    records: SystemNodeEdgeGroupRecord[];
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
 * 创建多地图点边组合的表单数据
 */
export interface CreateSystemNodeEdgeGroupParam {
    /** 系统多地图点边组合唯一名称 */
    systemNodeEdgeGroupName: string;
    /** 地图点边组合id集合 */
    mapNodeEdgeGroupIds: string[];
}

/**
 * 更新多地图点边组合的参数
 */
export interface UpdateSystemNodeEdgeGroupParam {
    /** 系统多地图点边组合数据库id */
    systemNodeEdgeGroupId: number;
    /** 系统多地图点边组合唯一名称 */
    systemNodeEdgeGroupName: string;
    /** 地图点边组合id集合 */
    mapNodeEdgeGroupIds: string[];
}
