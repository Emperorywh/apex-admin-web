/**
 * 只读地图的内置样式常量（T00.7，迁移自旧 KonvaMap/utils/styles）。
 *
 * 颜色语义与旧系统保持一致（用户已习惯的地图视觉语言）：
 * 工作点蓝、充电点绿、货架橙、停靠点红、库区前点紫、反向路径红。
 * 这些颜色是地图业务图形（节点类型辨识）而非主题皮肤，
 * 不随深浅色主题切换，也不走 --app-* 令牌（画布内容需与现场图纸一致）。
 */

import type { MapEdgeShapeStyle, MapNodeShapeStyle } from '@/components/ReadOnlyMap/ReadOnlyMap.types'

/**
 * 库区前点样式（紫色）。
 * 同一样式供多个 key 复用：warehouse_front（规范拼写）、warehouse_font
 * （后端历史拼写，运行时实际下发）、warehouse（库区站点兼容类型）；
 * 不复用会被 getNodeStyle 兜底成灰色普通节点，现场将无法辨识库区前点。
 */
const warehouseFrontStyle: MapNodeShapeStyle = {
  fill: 'transparent',
  stroke: '#EA80FC',
  radius: 0.15,
  lineWidth: 0.06,
  labelFill: '#EA80FC',
  showArrow: true,
}

/** 节点类型 → 渲染样式；key 含历史拼写与兼容类型（后端真实下发值） */
const mapNodeStyleMap: Record<string, MapNodeShapeStyle> = {
  node: {
    fill: '#78909C',
    stroke: 'transparent',
    radius: 0.1,
    lineWidth: 0,
    labelFill: '#78909C',
    showArrow: false,
  },
  work: {
    fill: 'transparent',
    stroke: '#2196F3',
    radius: 0.15,
    lineWidth: 0.06,
    labelFill: '#2196F3',
    showArrow: true,
  },
  charge: {
    fill: 'transparent',
    stroke: '#8BC34A',
    radius: 0.15,
    lineWidth: 0.06,
    labelFill: '#8BC34A',
    showArrow: true,
  },
  shelf: {
    fill: 'transparent',
    stroke: '#FA8C16',
    radius: 0.15,
    lineWidth: 0.06,
    labelFill: '#FA8C16',
    showArrow: true,
  },
  park: {
    fill: 'transparent',
    stroke: '#F44336',
    radius: 0.15,
    lineWidth: 0.06,
    labelFill: '#F44336',
    showArrow: true,
  },
  warehouse_front: warehouseFrontStyle,
  warehouse_font: warehouseFrontStyle,
  warehouse: warehouseFrontStyle,
  warehouse_back: {
    fill: 'transparent',
    stroke: '#616161',
    radius: 0.15,
    lineWidth: 0.06,
    labelFill: '#616161',
    showArrow: true,
  },
}

/**
 * 按节点类型取渲染样式：未知类型/缺省回退普通节点样式（灰），
 * 绝不为未知类型编造外观——形状可辨识即可，类型语义由文字标签呈现。
 */
export function getMapNodeStyle(type: string | undefined): MapNodeShapeStyle {
  if (type && type in mapNodeStyleMap) {
    return mapNodeStyleMap[type]
  }
  return mapNodeStyleMap.node
}

/** 正向路径（灰） */
export const forwardMapEdgeStyle: MapEdgeShapeStyle = {
  stroke: '#BDBDBD',
  lineWidth: 0.05,
  labelFill: '#BDBDBD',
}

/** 反向路径（红，用于辨识双向边方向） */
export const reverseMapEdgeStyle: MapEdgeShapeStyle = {
  stroke: '#E57373',
  lineWidth: 0.05,
  labelFill: '#E57373',
}

/** 选中态：HMI 青色脉冲双环（内环实线 + 外环虚线 + 辉光） */
export const selectedMapNodeStyle = {
  color: '#00E5FF',
  innerLineWidth: 0.04,
  outerLineWidth: 0.03,
  innerGap: 0.04,
  outerGap: 0.09,
  dashLength: 0.08,
  dashGap: 0.05,
  glowColor: 'rgba(0,229,255,0.35)',
  glowBlur: 0.4,
} as const

/** 节点 hover 态 */
export const hoverMapNodeStyle = {
  stroke: '#69B1FF',
  lineWidth: 0.08,
} as const

/** 路径选中态颜色（视觉层据此替代基础描边色） */
export const SELECTED_EDGE_COLOR = '#00E5FF'

/** 路径 hover 态颜色 */
export const HOVER_EDGE_COLOR = '#69B1FF'

/** 路径命中层的不可见加宽描边（世界坐标宽度，提高细线的可点击性） */
export const HIT_REGION_LINE_WIDTH = 0.5
