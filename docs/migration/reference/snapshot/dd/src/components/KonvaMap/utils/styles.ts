/**
 * @description KonvaMap 内建样式常量
 * 节点样式、路径样式、选中态样式
 */
import type {
  EdgeShapeStyle,
  MapNodeType,
  NodeShapeStyle,
} from "../KonvaMap.types";

// ===== 节点样式 =====

/**
 * 库区前点样式（紫色 #EA80FC）。
 * 同一份样式供三个 key 复用：
 * - warehouse_front：MapNodeType 联合里的规范拼写
 * - warehouse_font：后端历史拼写（font≠front），运行时实际下发的值
 * - warehouse：库区站点（constants/mapStationTypeOptions 的第 8 类）
 * 不复用会被 getNodeStyle 兜底成灰色普通节点。
 */
const warehouseFrontStyle: NodeShapeStyle = {
  fill: "transparent",
  stroke: "#EA80FC",
  radius: 0.15,
  lineWidth: 0.06,
  labelFill: "#EA80FC",
  showArrow: true,
};

// satisfies 的 key 类型放宽到兼容拼写：warehouse_font（后端历史拼写）与
// warehouse（库区站点第 8 类）不在 MapNodeType 联合内，但运行时实际会下发
const nodeStyleMap = {
  node: {
    fill: "#78909C",
    stroke: "transparent",
    radius: 0.1,
    lineWidth: 0,
    labelFill: "#78909C",
    showArrow: false,
  },
  work: {
    fill: "transparent",
    stroke: "#2196F3",
    radius: 0.15,
    lineWidth: 0.06,
    labelFill: "#2196F3",
    showArrow: true,
  },
  charge: {
    fill: "transparent",
    stroke: "#8BC34A",
    radius: 0.15,
    lineWidth: 0.06,
    labelFill: "#8BC34A",
    showArrow: true,
  },
  shelf: {
    fill: "transparent",
    stroke: "#FA8C16",
    radius: 0.15,
    lineWidth: 0.06,
    labelFill: "#FA8C16",
    showArrow: true,
  },
  park: {
    fill: "transparent",
    stroke: "#F44336",
    radius: 0.15,
    lineWidth: 0.06,
    labelFill: "#F44336",
    showArrow: true,
  },
  // 三个 key 共用紫色库区前点样式，见 warehouseFrontStyle 注释
  warehouse_front: warehouseFrontStyle,
  warehouse_font: warehouseFrontStyle,
  warehouse: warehouseFrontStyle,
  warehouse_back: {
    fill: "transparent",
    stroke: "#616161",
    radius: 0.15,
    lineWidth: 0.06,
    labelFill: "#616161",
    showArrow: true,
  },
} satisfies Record<MapNodeType | "warehouse_font" | "warehouse", NodeShapeStyle>;

/**
 * 获取节点样式：按 type 直接查 nodeStyleMap，
 * 未命中（undefined 或未知类型）时回退到 node 兜底，避免解构 undefined 崩溃。
 * 入参放宽到 string|undefined 是为了容纳后端历史拼写（warehouse_font）
 * 与未在 MapNodeType 联合内的兼容类型（warehouse）。
 */
export const getNodeStyle = (type: string | undefined): NodeShapeStyle => {
  if (type && type in nodeStyleMap) {
    return nodeStyleMap[type as keyof typeof nodeStyleMap];
  }
  return nodeStyleMap.node;
};

// ===== 路径样式 =====

/** 正向路径 */
export const forwardPathStyle: EdgeShapeStyle = {
  stroke: "#BDBDBD",
  lineWidth: 0.05,
  labelFill: "#BDBDBD",
};

/** 反向路径 */
export const reversePathStyle: EdgeShapeStyle = {
  stroke: "#E57373",
  lineWidth: 0.05,
  labelFill: "#E57373",
};

// ===== 选中态 =====

/** 方案 A：HMI 青色脉冲双环 */
export const selectedNodeStyleA = {
  /** 选中环颜色 */
  color: "#00E5FF",
  /** 内环线宽 */
  innerLineWidth: 0.04,
  /** 外环线宽 */
  outerLineWidth: 0.03,
  /** 内环距节点边缘的距离 */
  innerGap: 0.04,
  /** 外环距节点边缘的距离 */
  outerGap: 0.09,
  /** 虚线段长度 */
  dashLength: 0.08,
  /** 虚线间隔 */
  dashGap: 0.05,
  /** 外发光颜色 */
  glowColor: "rgba(0,229,255,0.35)",
  /** 外发光模糊半径 */
  glowBlur: 0.4,
};

export const hoverNodeStyle = {
  stroke: "#69B1FF",
  lineWidth: 0.08,
};

export const selectedEdgeStyle = {
  stroke: "#00E5FF",
  lineWidth: 0.1,
};

export const hoverEdgeStyle = {
  stroke: "#69B1FF",
};

// ===== hitRegion =====

/** 不可见 hitRegion 的宽度 */
export const HIT_REGION_LINE_WIDTH = 0.5;
