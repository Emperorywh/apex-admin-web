import type Konva from "konva";
export interface StageSize {
    width: number;
    height: number;
}

interface NodeItem {
    id: string;
    name: string;
    type: string;
    areaId: string;
    mapId: string;
    allowVehicleGroup?: string[],
    enterChargeStationId: string;
    x: number;
    y: number;
    angle: number;
    /**
     * 是否限制叉车在节点处旋转。
     * 保存地图资源时随节点属性一起提交给后端。
     */
    enableLimitForkLiftRotation: boolean;
    userDefinedProperties: object;
}

interface EdgeItem {
    id: string;
    name: string;
    mapId: string;
    reverseEdgeId: string;
    edgeType: string;
    sx: number;
    sy: number;
    ex: number;
    ey: number;
    cx: number;
    cy: number;
    dx: number;
    dy: number;
    isBackEdge: boolean;
    enableLimitForkLiftReturn: boolean;
    limitV: number;
    cost: number;
    loadType: number;
    allowVehicleGroup?: string[];
    userDefinedProperties: object;
    enodeId: string;
    snodeId: string;
    sfacing: number;
    efacing: number;
}

export interface AreaItem {
    id: string;
    name: string;
    type: string;
    paX?: number | null;
    paY?: number | null;
    pbX?: number | null;
    pbY?: number | null;
    pcX?: number | null;
    pcY?: number | null;
    pdX?: number | null;
    pdY?: number | null;
    userDefinedProperties: { [key: string]: any };
    cx?: number | null;
    cy?: number | null;
}

interface NodeEdgeGroup {
    id: string;
    name: string;
    edgeIds: string[];
    nodeIds: string[];
    userDefinedProperties?: { 
        [key: string]: any // nodeEdgeGroupType = SINGLE_VEHICLE（独占区）TRIPARTITE_TRAFFIC（三方交管区）
    };
}

export interface UpdateMapResourceType {
    mapKey: string;
    nodes: NodeItem[];
    edges: EdgeItem[];
    areas?: AreaItem[];
    nodeEdgeGroups?: NodeEdgeGroup[];
}

/**
 * 「选择附近元素」候选项：路径 Shape + 到鼠标的屏幕像素距离。
 * 右键时一次性计算并暂存入 ContextMenuType.nearbyCandidates，
 * 供 ContextMenu 直接消费（避免菜单渲染时鼠标已移走导致 getPointerPosition 失真，SPEC §5.2）。
 */
export interface NearbyCandidate {
    /** 路径 Konva.Shape（enableSelect === "edge"） */
    shape: Konva.Shape;
    /** 鼠标到该路径的屏幕像素距离（用于升序排序与截断） */
    distance: number;
}

export interface ContextMenuType {
    open?: boolean;
    left?: number;
    top?: number;
    event?: Konva.KonvaEventObject<MouseEvent>;
    /** 「选择附近元素」候选列表（右键时计算，ContextMenu 直接消费，避免菜单渲染时鼠标已移走导致 getPointerPosition 失真） */
    nearbyCandidates?: NearbyCandidate[];
}

export interface AvoidType {
    as_index: number;
    as_install_used?: boolean;
    id: string;
    install_used?: boolean;
    on_off: boolean;
    name?: string;
}

export interface AvoidMap {
    name: string;
    id: string;
    sensor_index: number;
}
