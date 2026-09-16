/**
 * @description KonvaMap 组件的类型定义
 */

// ===== 数据模型 =====

/** 地图节点类型 */
export type MapNodeType =
  | "node"
  | "work"
  | "shelf"
  | "charge"
  | "park"
  | "warehouse_front"
  | "warehouse_back";

/** 地图节点 */
export interface MapNode {
  id: string;
  name: string;
  type: MapNodeType;
  mapId: string;
  x: number; // 米为单位的世界坐标
  y: number; // 米为单位的世界坐标
  angle: number | null;
  allowVehicleGroups: string[] | null;
  enterChargeStationId: string | null;
  enableLimitForkLiftRotation: boolean;
  actions: any[];
  userDefinedProperties: any;
  addDis: number | null;
}

/** 路径类型 */
export type MapEdgeType = "LINE" | "BEZIER";

/** 地图路径 */
export interface MapEdge {
  id: string;
  name: string;
  mapId: string;
  edgeType: MapEdgeType;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  cx: number | null;
  cy: number | null;
  dx: number | null;
  dy: number | null;
  isBackEdge: boolean;
  cost: number;
  snodeId: string;
  enodeId: string;
  sfacing: number;
  efacing: number;
  loadType: number;
  enableLimitForkLiftReturn: boolean;
  allowVehicleGroups: string[];
  maxLoadSpeed: number;
  maxFreeSpeed: number;
  actions: any[];
  userDefinedProperties: any;
}

// ===== 选中模型 =====

/** 选中项联合类型 */
export type SelectedItem =
  | { type: "node"; data: MapNode }
  | { type: "edge"; data: MapEdge };

// ===== 选择模式 =====

export type SelectMode = "node" | "edge" | "all";

// ===== 内部渲染模型 =====

/** 节点样式 */
export interface NodeShapeStyle {
  fill: string;
  stroke: string;
  radius: number;
  lineWidth: number;
  labelFill: string;
  /** 是否显示方向箭头 */
  showArrow?: boolean;
}

/** 路径样式 */
export interface EdgeShapeStyle {
  stroke: string;
  labelFill: string;
  lineWidth: number;
}

/** 旋转箭头坐标 [top, right, bottom] */
export type RotateArrowPoints = [
  [number, number],
  [number, number],
  [number, number],
];

/** 路径方向箭头坐标 [leftX, leftY, tipX, tipY, rightX, rightY] */
export type DirectionArrowPoints = [
  number,
  number,
  number,
  number,
  number,
  number,
];

/** 挂载后的节点数据 */
export interface MountNode {
  id: string;
  x: number;
  y: number; // 已经取反后的画布坐标
  shapeStyle: NodeShapeStyle;
  data: {
    name: string;
    type: MapNodeType;
    angle: number | null;
    arrowPoints?: RotateArrowPoints;
    [key: string]: any;
  };
}

/** 挂载后的路径数据 */
export interface MountEdge {
  id: string;
  shapeStyle: EdgeShapeStyle;
  data: {
    sx: number;
    sy: number;
    cx: number | null;
    cy: number | null;
    dx: number | null;
    dy: number | null;
    ex: number;
    ey: number;
    name: string;
    isBackEdge: boolean;
    labelX: number;
    labelY: number;
    arrowPoints: DirectionArrowPoints;
    [key: string]: any;
  };
}

// ===== 组件 Props =====

export interface KonvaMapProps {
  /** 地图 ID */
  mapId: string;
  /** 选择模式 @default 'node' */
  selectMode?: SelectMode;
  /** 是否多选 @default false */
  multiple?: boolean;
  /** 选中变化回调 */
  onChange?: (selectedItems: SelectedItem[]) => void;
  /** 画布宽度 */
  width?: number;
  /** 画布高度 */
  height?: number;
  /** 是否显示节点名称 @default true */
  showNodeLabels?: boolean;
  /** 是否显示路径名称 @default false */
  showEdgeLabels?: boolean;
  /** 是否显示方向箭头 @default true */
  showArrows?: boolean;
  /** 初始选中 ID 列表（数据加载完成后自动应用） */
  initialSelectedIds?: string[];
  /** 默认聚焦目标，格式 `node:${id}` 或 `edge:${id}`，数据加载完成后自动定位并闪烁 */
  defaultFocus?: string;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 禁选的节点类型列表，这些类型的节点不可被鼠标左键选中 */
  disabledNodeTypes?: MapNodeType[];
  /** 点击画布空白处回调 */
  onBlankClick?: () => void;
  /** 地图数据加载失败回调 */
  onLoadError?: () => void;
}

// ===== 命令式 API =====

export interface KonvaMapRef {
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  getSelectedItems: () => SelectedItem[];
  getSelectedIds: () => string[];
  clearSelection: () => void;
  setSelectedIds: (ids: string[]) => void;
  /** 定位到指定节点 */
  focusNode: (nodeId: string, blink?: boolean) => void;
  /** 定位到指定路径 */
  focusEdge: (edgeId: string, blink?: boolean) => void;
  /** 清除定位/闪烁状态 */
  clearFocus: () => void;
  /** 重新加载当前地图数据 */
  reload: () => void;
}

// ===== 缩放常量 =====

export const SCALE_BY = 1.1;
export const MIN_SCALE = 0;
export const MAX_SCALE = 2000;
export const DEFAULT_SCALE = 60;
