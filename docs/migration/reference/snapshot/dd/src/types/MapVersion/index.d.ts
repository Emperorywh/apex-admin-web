/**
 * @description 地图版本相关类型定义
 * @date 2026-6-1
 */

/**
 * 动作参数
 */
interface ActionParameter {
    key: string;
    value: object;
}

/**
 * 地图动作
 */
interface MapAction {
    /** 动作类型 */
    actionType: string;
    /** 动作描述 */
    actionDescription: string;
    /** 阻塞类型: NONE, SOFT, HARD */
    blockingType: string;
    /** 动作参数 */
    actionParameters: ActionParameter[];
}

/**
 * 地图节点（版本json用）
 */
interface MapVersionNode {
    /** 节点id */
    id: string;
    /** 节点名称 */
    name: string;
    /** 节点类型: node, warehouse, park, charge, work */
    type: string;
    mapId: string;
    /** 允许的车辆组 */
    allowVehicleGroups: string[];
    /** 关联的充电退出点 */
    enterChargeStationId: string;
    /** 是否启用虚拟停靠站点 */
    enableVirtualParkStation: boolean;
    /** 是否启用虚拟避让点 */
    enableVirtualAvoidStation: boolean;
    /** 是否限制叉车旋转 */
    enableLimitForkLiftRotation: boolean;
    /** x坐标(m/米) */
    x: number;
    /** y坐标(m/米) */
    y: number;
    /** 角度[π,-π] */
    angle: number;
    /** 动作列表 */
    actions: MapAction[];
    /** 用户自定义属性 */
    userDefinedProperties: object;
    /** 车辆到点距离 */
    addDis: number;
}

/**
 * 地图边（版本json用）
 */
interface MapVersionEdge {
    /** 边id */
    id: string;
    /** 边名称 */
    name: string;
    mapId: string;
    /** 边类型: LINE, BEZIER */
    edgeType: string;
    /** 起点x坐标(m/米) */
    sx: number;
    /** 起点y坐标(m/米) */
    sy: number;
    /** 终点x坐标(m/米) */
    ex: number;
    /** 终点y坐标(m/米) */
    ey: number;
    /** 贝塞尔靠近起点的控制点x坐标(m/米) */
    cx: number;
    /** 贝塞尔靠近起点的控制点y坐标(m/米) */
    cy: number;
    /** 贝塞尔靠近终点的控制点x坐标(m/米) */
    dx: number;
    /** 贝塞尔靠近终点的控制点y坐标(m/米) */
    dy: number;
    /** 是否为倒退路径 */
    isBackEdge: boolean;
    /** 路径代价,默认路径长度(m/米) */
    cost: number;
    /** 路径类型: 0:na, 1:load, 2:free */
    loadType: number;
    /** 是否限制车辆回归 */
    enableLimitForkLiftReturn: boolean;
    /** 路径绑定的车型组 */
    allowVehicleGroups: string[];
    /** agv载货避障方案 */
    loadSecurity: number;
    /** agv空载避障方案 */
    freeSecurity: number;
    /** agv载货最大速度 */
    maxLoadSpeed: number;
    /** agv空载最大速度 */
    maxFreeSpeed: number;
    /** 最大载货旋转速度 */
    maxLoadRotationSpeed: number;
    /** 最大空载旋转速度 */
    maxFreeRotationSpeed: number;
    /** 最大载货加速度 */
    maxLoadAcceleration: number;
    /** 最大空载加速度 */
    maxFreeAcceleration: number;
    /** 最大载货减速度 */
    maxLoadDeceleration: number;
    /** 最大空载减速度 */
    maxFreeDeceleration: number;
    /** 动作列表 */
    actions: MapAction[];
    /** 自定义属性 */
    userDefinedProperties: object;
    efacing: number;
    enodeId: string;
    snodeId: string;
    sfacing: number;
}

/**
 * 区域顶点坐标
 */
interface ZoneVertex {
    /** x坐标(m) */
    x: number;
    /** y坐标(m) */
    y: number;
}

/**
 * 地图区域（版本json用）
 */
interface MapVersionZone {
    /** 区域id */
    id: string;
    /** 区域名称 */
    name: string;
    /** 区域类型(避障区域,减速区域) */
    type: string;
    /** 区域顶点坐标 */
    vertices: ZoneVertex[];
    /** 区域最大速度 */
    maximumSpeed: number;
    /** 进入区域动作 */
    entryActions: MapAction[];
    /** 区域持续动作 */
    duringActions: MapAction[];
    /** 退出区域动作 */
    exitActions: MapAction[];
    /** 用户自定义属性 */
    userDefinedProperties: object;
}

/**
 * 点边组合
 */
interface MapVersionNodeEdgeGroup {
    /** 点边组合唯一id */
    id: string;
    /** 点边组合名称 */
    name: string;
    /** 点边组合包含的边id */
    edgeIds: string[];
    /** 点边组合包含的节点id */
    nodeIds: string[];
    /** 用户自定义属性 */
    userDefinedProperties: object;
}

/**
 * 地图版本JSON数据
 */
interface MapJson {
    /** 节点列表 */
    nodes: MapVersionNode[];
    /** 边列表 */
    edges: MapVersionEdge[];
    /** 区域列表 */
    zones: MapVersionZone[];
    /** 点边组合列表 */
    nodeEdgeGroups: MapVersionNodeEdgeGroup[];
}

/**
 * 更新地图版本json数据 - 请求参数
 */
export interface MapInfoVersionJsonParam {
    /** 地图版本id */
    mapVersionId: number;
    /** 编辑地图备注 */
    mapRemark: string;
    /** 是否保存并发布 */
    publish?: boolean;
    /** 节点列表 */
    nodes: MapVersionNode[];
    /** 边列表 */
    edges: MapVersionEdge[];
    /** 区域列表 */
    zones: MapVersionZone[];
    /** 点边组合列表 */
    nodeEdgeGroups: MapVersionNodeEdgeGroup[];
}

/**
 * 推送地图版本 - 请求参数
 */
export interface MapInfoVersionPushParam {
    /** 地图版本id */
    mapVersionId: number;
    /** 推送的车辆key */
    vehicleKeys: string[];
    /** 是否启用推送SLAM底图 */
    enabledPushSlamMap: boolean;
}

/**
 * 发布地图版本 - 请求参数
 */
export interface MapInfoVersionJsonPublishParam {
    /** 地图版本id */
    mapVersionId: number;
}

/**
 * 分页查询地图版本数据 - 请求参数
 */
export interface PageMapInfoVersionsParams {
    /** 每页的数量 */
    pageSize: number;
    /** 当前的页码 */
    pageNo: number;
    /** 查询关键字 */
    query?: string;
    /** 地图id */
    mapId?: string;
}

/**
 * 地图版本记录
 */
export interface MapInfoVersion {
    id: number;
    createTime: string;
    updateTime: string;
    createUser: string;
    updateUser: string;
    /** 地图id */
    mapId: string;
    /** 地图名称 */
    mapName: string;
    /** 地图备注 */
    mapRemark: string;
    /** 地图版本 */
    mapVersion: string;
    /** 父地图版本 */
    parentMapVersion: string;
    /** 地图JSON数据 */
    mapJson: MapJson;
    /** 地图图片 */
    mapImage: string;
    /**
     * 是否已发布（published 字段）
     * 后端返回的状态字段，true=已发布，false/undefined=未发布
     */
    published?: boolean;
    /**
     * 当前已发布版本标识
     * truthy 表示此版本为当前已发布版本
     * VersionModal 的"是否发布"列使用此字段判断
     */
    currentMapInfoVersion?: unknown;
}

//*********************************************************************车辆下载地图数据******************************************************//

/**
 * 车辆下载地图数据 - 车辆下载地图节点（响应）
 */
interface MapPushNode {
    /** 节点id */
    id: string;
    /** 节点名称 */
    name: string;
    /** 节点类型 */
    type: string;
    /** x坐标 */
    x: number;
    /** y坐标 */
    y: number;
    /** 角度 */
    angle: number;
}

/**
 * 车辆下载地图数据 - 车辆下载地图路线（响应）
 */
interface MapPushEdge {
    /** 路线id */
    id: string;
    /** 路线名称 */
    name: string;
    /** 路线类型 */
    type: string;
    /** 起点x坐标 */
    sx: number;
    /** 起点y坐标 */
    sy: number;
    /** 终点x坐标 */
    ex: number;
    /** 终点y坐标 */
    ey: number;
    /** 贝塞尔靠近起点的控制点x坐标 */
    cx: number;
    /** 贝塞尔靠近起点的控制点y坐标 */
    cy: number;
    /** 贝塞尔靠近终点的控制点x坐标 */
    dx: number;
    /** 贝塞尔靠近终点的控制点y坐标 */
    dy: number;
    /** 是否为倒退路径 */
    backward: boolean;
    /** 起点节点id */
    snodeId: string;
    /** 终点节点id */
    enodeId: string;
}

/**
 * 车辆下载地图数据 - 响应数据
 */
interface VehicleDownloadMapJson {
    /** 地图id */
    mapId: string;
    /** 地图名称 */
    mapName: string;
    /** 地图版本 */
    mapVersion: string;
    /** 点位信息 */
    nodes: MapPushNode[];
    /** 路线信息 */
    edges: MapPushEdge[];
    /** slam底图 */
    slamImage: string;
}

/**
 * 车辆下载地图数据 - 请求参数
 */
export interface VehicleDownloadMapParam {
    /** 地图名称 */
    mapName?: string;
    /** 地图版本 */
    mapVersion?: string;
    /** 是否下载slam底图 */
    enabledPushSlamMap?: boolean;
}

//*********************************************************************下载地图文件******************************************************//

/**
 * 下载地图文件 - 请求参数
 */
export interface MapDownloadParam {
    /** 地图版本id */
    mapInfoVersionId?: number;
}
