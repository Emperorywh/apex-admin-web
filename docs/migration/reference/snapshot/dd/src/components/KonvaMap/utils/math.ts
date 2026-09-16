/**
 * @description 数学工具函数
 * 箭头计算、贝塞尔曲线、标签位置、旋转箭头
 */

import type {
  DirectionArrowPoints,
  RotateArrowPoints,
} from "../KonvaMap.types";

// ===== 贝塞尔曲线 =====

/**
 * 求三次贝塞尔曲线 t 处的点坐标
 */
export const getBezierPoint = (
  points: [number, number, number, number, number, number, number, number],
  t: number,
) => {
  const [sx, sy, cx, cy, dx, dy, ex, ey] = points;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const x = mt2 * mt * sx + 3 * mt2 * t * cx + 3 * mt * t2 * dx + t * t2 * ex;
  const y = mt2 * mt * sy + 3 * mt2 * t * cy + 3 * mt * t2 * dy + t * t2 * ey;
  return { x, y };
};

/**
 * 求三次贝塞尔曲线 t 处的切线方向
 */
export const getBezierTangent = (
  points: [number, number, number, number, number, number, number, number],
  t: number,
) => {
  const [sx, sy, cx, cy, dx, dy, ex, ey] = points;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const qx = 3 * mt2 * (cx - sx) + 6 * mt * t * (dx - cx) + 3 * t2 * (ex - dx);
  const qy = 3 * mt2 * (cy - sy) + 6 * mt * t * (dy - cy) + 3 * t2 * (ey - dy);
  return { qx, qy };
};

// ===== 路径方向箭头 =====

/**
 * 计算直线上靠近终点 t 处的方向箭头坐标
 * @returns [leftX, leftY, tipX, tipY, rightX, rightY]
 */
export const computeLineArrowPoints = (
  points: [number, number, number, number],
  t: number = 0.6,
  size: number = 0.3,
): DirectionArrowPoints => {
  const arrowWidth = size / 2;
  const [sx, sy, ex, ey] = points;
  const pointX = sx + (ex - sx) * t;
  const pointY = sy + (ey - sy) * t;
  const angle = Math.atan2(ey - sy, ex - sx);
  const tipX = pointX;
  const tipY = pointY;
  const leftX = pointX - size * Math.cos(angle) + arrowWidth * Math.sin(angle);
  const leftY = pointY - size * Math.sin(angle) - arrowWidth * Math.cos(angle);
  const rightX = pointX - size * Math.cos(angle) - arrowWidth * Math.sin(angle);
  const rightY = pointY - size * Math.sin(angle) + arrowWidth * Math.cos(angle);
  return [leftX, leftY, tipX, tipY, rightX, rightY];
};

/**
 * 计算三次贝塞尔曲线上 t 处的方向箭头坐标
 * @returns [leftX, leftY, tipX, tipY, rightX, rightY]
 */
export const computeCubicArrowPoints = (
  points: [number, number, number, number, number, number, number, number],
  t: number = 0.4,
  size: number = 0.3,
): DirectionArrowPoints => {
  const point = getBezierPoint(points, t);
  const tangent = getBezierTangent(points, t);
  const length = Math.sqrt(tangent.qx * tangent.qx + tangent.qy * tangent.qy);
  const nx = tangent.qx / length;
  const ny = tangent.qy / length;
  const perpX = -ny;
  const perpY = nx;
  const tip = { x: point.x, y: point.y };
  const left = {
    x: point.x - size * nx + size * 0.6 * perpX,
    y: point.y - size * ny + size * 0.6 * perpY,
  };
  const right = {
    x: point.x - size * nx - size * 0.6 * perpX,
    y: point.y - size * ny - size * 0.6 * perpY,
  };
  return [left.x, left.y, tip.x, tip.y, right.x, right.y];
};

// ===== 标签位置 =====

/**
 * 计算直线 t 处的坐标（用于标签位置）
 */
export const computeLinePoint = (
  point: [number, number, number, number],
  t: number = 1 / 3,
) => {
  const [sx, sy, ex, ey] = point;
  const dx = ex - sx;
  const dy = ey - sy;
  const tx = sx + dx * t;
  const ty = sy + dy * t;
  return { x: tx, y: ty };
};

/**
 * 计算三次贝塞尔曲线 t 处的坐标（用于标签位置）
 */
export const computeBezierLabelPoint = (
  points: [number, number, number, number, number, number, number, number],
  t: number = 2 / 3,
) => {
  const [sx, sy, cx, cy, dx, dy, ex, ey] = points;
  const ox = 3 * (cx - sx);
  const oy = 3 * (cy - sy);
  const bx = 3 * (dx - cx) - ox;
  const by = 3 * (dy - cy) - oy;
  const ax = ex - sx - ox - bx;
  const ay = ey - sy - oy - by;
  const tSquared = t * t;
  const tCubed = tSquared * t;
  const x = ax * tCubed + bx * tSquared + ox * t + sx;
  const y = ay * tCubed + by * tSquared + oy * t + sy;
  return { x, y };
};

// ===== 节点方向箭头 =====

/**
 * 将点逆时针旋转 rad 弧度
 */
const rotatePointByRad = (
  point: [number, number],
  rad: number,
): [number, number] => {
  const [x = 0, y = 0] = point;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [x * cos - y * sin, x * sin + y * cos];
};

/**
 * 根据节点半径和角度计算方向箭头坐标
 * @param radius 节点半径
 * @param rad 旋转弧度（已取反）
 * @returns 箭头三个顶点 [top, right, bottom]
 */
export const computeRotateArrow = (
  radius: number,
  rad: number | undefined,
): RotateArrowPoints | undefined => {
  if (typeof rad !== "number") return undefined;
  const top: [number, number] = [0, -radius / 2];
  const right: [number, number] = [radius / 2, 0];
  const bottom: [number, number] = [0, radius / 2];
  const points = [top, right, bottom].map((p) =>
    rotatePointByRad(p, rad),
  ) as RotateArrowPoints;
  return points;
};
