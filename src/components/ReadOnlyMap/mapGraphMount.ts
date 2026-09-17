/**
 * 地图数据 → 渲染模型的挂载转换（T00.7，迁移自旧 KonvaMap/utils/mountGraph）。
 *
 * 约定：后端米制世界坐标 y 轴向上，Konva 画布 y 轴向下，
 * 挂载时统一对 y 取反；线体坐标在渲染层 sceneFunc 内再次取反与旧实现一致
 * （挂载层 data 保留原始坐标，供命中层与聚焦计算复用）。
 */

import type { MapEdgeDto, MapNodeDto } from '@/services/map/map.service.types'
import type { MapMountEdge, MapMountNode } from '@/components/ReadOnlyMap/ReadOnlyMap.types'
import {
  computeBezierLabelPoint,
  computeCubicArrowPoints,
  computeLineArrowPoints,
  computeLinePoint,
  computeRotateArrow,
  type BezierPoints,
} from '@/components/ReadOnlyMap/mapGraphGeometry'
import {
  forwardMapEdgeStyle,
  getMapNodeStyle,
  reverseMapEdgeStyle,
} from '@/components/ReadOnlyMap/mapGraphStyles'

/**
 * 挂载所有节点：解析样式、y 取反、计算方向箭头。
 * 无朝向（angle 为 null）或样式不显示箭头时 arrowPoints 为 undefined。
 */
export function mountGraphNodes(nodes: MapNodeDto[]): MapMountNode[] {
  return nodes.map((node) => {
    const { id, x, y, type, angle, name } = node
    const style = getMapNodeStyle(type)
    // 仅"样式要求箭头且后端下发了朝向角"时计算（angle !== null 先行判定，
    // 避免 -null === 0 的隐式数值化，与旧实现语义一致）
    const arrowPoints =
      style.showArrow && angle !== null
        ? computeRotateArrow(style.radius, -angle)
        : undefined

    return {
      id,
      x,
      y: -y,
      shapeStyle: style,
      data: { name, type, angle, arrowPoints },
    }
  })
}

/**
 * 挂载所有路径：正/反向样式、贝塞尔与直线的箭头及标签锚点。
 * 贝塞尔判定沿用旧实现：cx/cy/dx/dy 四个控制点全部非空才按曲线处理，
 * 否则一律按直线渲染（部分控制点缺失的畸形数据不会崩溃）。
 */
export function mountGraphEdges(edges: MapEdgeDto[]): MapMountEdge[] {
  if (!edges?.length) return []
  return edges.map((edge) => {
    const { id, sx, sy, cx, cy, dx, dy, ex, ey, isBackEdge, name } = edge
    const shapeStyle = isBackEdge ? reverseMapEdgeStyle : forwardMapEdgeStyle
    const isBezier = cx !== null && cy !== null && dx !== null && dy !== null

    if (isBezier) {
      // 贝塞尔：四个控制点参与 y 取反后计算箭头与标签位置
      const bezierPoints: BezierPoints = [sx, -sy, cx, -cy, dx, -dy, ex, -ey]
      const arrowPoints = computeCubicArrowPoints(bezierPoints)
      const labelPos = computeBezierLabelPoint(bezierPoints)
      return {
        id,
        shapeStyle,
        data: {
          sx, sy, cx, cy, dx, dy, ex, ey,
          name,
          isBackEdge,
          labelX: labelPos.x,
          labelY: labelPos.y,
          arrowPoints,
        },
      }
    }

    // 直线：仅端点参与，控制点归一为 null（渲染层据此走直线分支）
    const linePoints: [number, number, number, number] = [sx, -sy, ex, -ey]
    const arrowPoints = computeLineArrowPoints(linePoints)
    const labelPos = computeLinePoint(linePoints)
    return {
      id,
      shapeStyle,
      data: {
        sx, sy, cx: null, cy: null, dx: null, dy: null, ex, ey,
        name,
        isBackEdge,
        labelX: labelPos.x,
        labelY: labelPos.y,
        arrowPoints,
      },
    }
  })
}
