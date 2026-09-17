/**
 * 只读地图组件的内部类型与缩放常量（T00.7，迁移自旧 KonvaMap 选点组件）。
 *
 * 边界（迁移规格 11.1 / D06）：本组件只承担「只读渲染、平移缩放、选点、
 * 高亮定位与回填」；不引入地图编辑、监控、回放与车辆图层（历史实现已剔除，
 * 车辆监控属于暂缓页 H01 的能力范围）。
 */

import type { MapEdgeDto, MapGraph, MapNodeDto } from '@/services/map/map.service.types'

/** 选中项联合：节点或路径（回填给上层时携带完整后端 DTO） */
export type MapSelectedItem =
  | { type: 'node'; data: MapNodeDto }
  | { type: 'edge'; data: MapEdgeDto }

/** 选择模式：仅节点 / 仅路径 / 全部（决定哪些图形可点击选中） */
export type MapSelectMode = 'node' | 'edge' | 'all'

/** 节点渲染样式（世界坐标尺度，随视口缩放） */
export interface MapNodeShapeStyle {
  fill: string
  stroke: string
  radius: number
  lineWidth: number
  labelFill: string
  /** 是否显示方向箭头（有朝向角的工作/充电/货架等节点） */
  showArrow?: boolean
}

/** 路径渲染样式 */
export interface MapEdgeShapeStyle {
  stroke: string
  labelFill: string
  lineWidth: number
}

/** 节点方向箭头三个顶点 [top, right, bottom]（画布坐标） */
export type MapRotateArrowPoints = [[number, number], [number, number], [number, number]]

/** 路径方向箭头顶点 [leftX, leftY, tipX, tipY, rightX, rightY]（画布坐标） */
export type MapDirectionArrowPoints = [number, number, number, number, number, number]

/** 挂载后的节点渲染模型：样式已解析、y 已取反、箭头已计算 */
export interface MapMountNode {
  id: string
  x: number
  y: number
  shapeStyle: MapNodeShapeStyle
  data: {
    name: string
    type: MapNodeDto['type']
    angle: number | null
    arrowPoints?: MapRotateArrowPoints
  }
}

/** 挂载后的路径渲染模型：线体/箭头/标签位置已就绪 */
export interface MapMountEdge {
  id: string
  shapeStyle: MapEdgeShapeStyle
  data: {
    sx: number
    sy: number
    cx: number | null
    cy: number | null
    dx: number | null
    dy: number | null
    ex: number
    ey: number
    name: string
    isBackEdge: boolean
    labelX: number
    labelY: number
    arrowPoints: MapDirectionArrowPoints
  }
}

/** 内容包围盒（画布坐标），用于 fitView 与初始视口 */
export interface MapBoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ReadOnlyMapProps {
  /**
   * 地图 ID：内部经 fetchMapGraph 拉取数据（加载/失败/空态组件内闭环）。
   * 与 graph 二选一；两者都缺省时显示提示。
   */
  mapId?: string
  /**
   * 外部直供的地图数据：传入后组件不再自行请求（草稿预览、
   * 已有上下文复用等场景）；数据准确性由调用方负责。
   */
  graph?: MapGraph
  /** 选择模式，默认仅节点（选点主场景） */
  selectMode?: MapSelectMode
  /** 是否允许多选，默认单选 */
  multiple?: boolean
  /** 选中变化回调：携带完整节点/路径对象（供回填坐标与名称） */
  onChange?: (selectedItems: MapSelectedItem[]) => void
  /** 画布宽度；缺省自适应父容器 */
  width?: number
  /** 画布高度；缺省自适应父容器 */
  height?: number
  /** 是否显示节点名称标签，默认显示 */
  showNodeLabels?: boolean
  /** 是否显示路径名称标签，默认隐藏 */
  showEdgeLabels?: boolean
  /** 是否显示方向箭头，默认显示 */
  showArrows?: boolean
  /** 初始选中 ID 列表（数据就绪后回显；失效 ID 静默忽略并在上层标注） */
  initialSelectedIds?: string[]
  /** 数据就绪后自动定位的目标，格式 `node:${id}` / `edge:${id}`（首次定位不闪烁） */
  defaultFocus?: string
  /** 禁选的节点类型列表（这些类型不可被点击选中，仍正常渲染） */
  disabledNodeTypes?: MapNodeDto['type'][]
  /** 点击画布空白回调（空白点击会清空选中） */
  onBlankClick?: () => void
  className?: string
  style?: React.CSSProperties
}

/** 命令式 API：ref 供选点弹窗/页面驱动视口、选中与重载 */
export interface ReadOnlyMapRef {
  fitView: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
  getSelectedItems: () => MapSelectedItem[]
  getSelectedIds: () => string[]
  clearSelection: () => void
  setSelectedIds: (ids: string[]) => void
  /** 定位到指定节点；blink 控制定位结束后是否闪烁高亮 */
  focusNode: (nodeId: string, blink?: boolean) => void
  focusEdge: (edgeId: string, blink?: boolean) => void
  clearFocus: () => void
  /** 重新拉取当前地图数据（失败重试入口） */
  reload: () => void
}

/* ------------------------------- 缩放常量 ------------------------------- */

/** 每级缩放倍率 */
export const SCALE_BY = 1.1
/** 缩放下限（与旧实现一致：仅由 MAX/MIN 约束滚轮步进） */
export const MIN_SCALE = 0
/** 缩放上限：地图为米制小坐标，需要很大的放大倍率观察局部 */
export const MAX_SCALE = 2000
/** 无内容时的兜底缩放 */
export const DEFAULT_SCALE = 60
