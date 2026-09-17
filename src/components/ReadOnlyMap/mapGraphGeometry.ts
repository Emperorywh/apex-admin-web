/**
 * 地图几何纯函数（T00.7，迁移自旧 KonvaMap/utils/math，行为保持一致）。
 *
 * 坐标系约定：后端米制世界坐标 y 轴向上，画布 y 轴向下，
 * 所有取反（-y）在挂载层（mapGraphMount）完成；本模块只做
 * 纯几何计算，不感知数据来源，可在挂载层与渲染层之间复用。
 */

import type { MapDirectionArrowPoints, MapRotateArrowPoints } from '@/components/ReadOnlyMap/ReadOnlyMap.types'

/** 三次贝塞尔曲线 8 元组：[sx, sy, cx, cy, dx, dy, ex, ey] */
export type BezierPoints = [number, number, number, number, number, number, number, number]

/** 求三次贝塞尔曲线 t 处的点坐标 */
export function getBezierPoint(points: BezierPoints, t: number): { x: number; y: number } {
  const [sx, sy, cx, cy, dx, dy, ex, ey] = points
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  const x = mt2 * mt * sx + 3 * mt2 * t * cx + 3 * mt * t2 * dx + t * t2 * ex
  const y = mt2 * mt * sy + 3 * mt2 * t * cy + 3 * mt * t2 * dy + t * t2 * ey
  return { x, y }
}

/** 求三次贝塞尔曲线 t 处的切线方向 */
export function getBezierTangent(points: BezierPoints, t: number): { qx: number; qy: number } {
  const [sx, sy, cx, cy, dx, dy, ex, ey] = points
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  const qx = 3 * mt2 * (cx - sx) + 6 * mt * t * (dx - cx) + 3 * t2 * (ex - dx)
  const qy = 3 * mt2 * (cy - sy) + 6 * mt * t * (dy - cy) + 3 * t2 * (ey - dy)
  return { qx, qy }
}

/**
 * 计算直线上靠近终点 t 处的方向箭头三个顶点。
 * size 为箭头边长（世界坐标尺度），与路径线宽同数量级。
 */
export function computeLineArrowPoints(
  points: [number, number, number, number],
  t: number = 0.6,
  size: number = 0.3,
): MapDirectionArrowPoints {
  const arrowWidth = size / 2
  const [sx, sy, ex, ey] = points
  const pointX = sx + (ex - sx) * t
  const pointY = sy + (ey - sy) * t
  const angle = Math.atan2(ey - sy, ex - sx)
  const tipX = pointX
  const tipY = pointY
  const leftX = pointX - size * Math.cos(angle) + arrowWidth * Math.sin(angle)
  const leftY = pointY - size * Math.sin(angle) - arrowWidth * Math.cos(angle)
  const rightX = pointX - size * Math.cos(angle) - arrowWidth * Math.sin(angle)
  const rightY = pointY - size * Math.sin(angle) + arrowWidth * Math.cos(angle)
  return [leftX, leftY, tipX, tipY, rightX, rightY]
}

/** 计算三次贝塞尔曲线上 t 处的方向箭头三个顶点 */
export function computeCubicArrowPoints(
  points: BezierPoints,
  t: number = 0.4,
  size: number = 0.3,
): MapDirectionArrowPoints {
  const point = getBezierPoint(points, t)
  const tangent = getBezierTangent(points, t)
  const length = Math.sqrt(tangent.qx * tangent.qx + tangent.qy * tangent.qy)
  const nx = tangent.qx / length
  const ny = tangent.qy / length
  const perpX = -ny
  const perpY = nx
  const left = {
    x: point.x - size * nx + size * 0.6 * perpX,
    y: point.y - size * ny + size * 0.6 * perpY,
  }
  const right = {
    x: point.x - size * nx - size * 0.6 * perpX,
    y: point.y - size * ny - size * 0.6 * perpY,
  }
  return [left.x, left.y, point.x, point.y, right.x, right.y]
}

/** 计算直线 t 处的坐标（路径名称标签锚点） */
export function computeLinePoint(
  point: [number, number, number, number],
  t: number = 1 / 3,
): { x: number; y: number } {
  const [sx, sy, ex, ey] = point
  const dx = ex - sx
  const dy = ey - sy
  return { x: sx + dx * t, y: sy + dy * t }
}

/** 计算三次贝塞尔曲线 t 处的坐标（路径名称标签锚点） */
export function computeBezierLabelPoint(points: BezierPoints, t: number = 2 / 3): { x: number; y: number } {
  const [sx, sy, cx, cy, dx, dy, ex, ey] = points
  const ox = 3 * (cx - sx)
  const oy = 3 * (cy - sy)
  const bx = 3 * (dx - cx) - ox
  const by = 3 * (dy - cy) - oy
  const ax = ex - sx - ox - bx
  const ay = ey - sy - oy - by
  const tSquared = t * t
  const tCubed = tSquared * t
  const x = ax * tCubed + bx * tSquared + ox * t + sx
  const y = ay * tCubed + by * tSquared + oy * t + sy
  return { x, y }
}

/** 把点逆时针旋转 rad 弧度 */
function rotatePointByRad(point: [number, number], rad: number): [number, number] {
  const [x = 0, y = 0] = point
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [x * cos - y * sin, x * sin + y * cos]
}

/**
 * 根据节点半径与朝向角计算方向箭头三个顶点（[top, right, bottom] 旋转后）。
 * rad 非 number（后端未下发朝向）时返回 undefined，渲染层据此跳过箭头。
 */
export function computeRotateArrow(radius: number, rad: number | undefined): MapRotateArrowPoints | undefined {
  if (typeof rad !== 'number') return undefined
  const top: [number, number] = [0, -radius / 2]
  const right: [number, number] = [radius / 2, 0]
  const bottom: [number, number] = [0, radius / 2]
  return [top, right, bottom].map((p) => rotatePointByRad(p, rad)) as MapRotateArrowPoints
}
