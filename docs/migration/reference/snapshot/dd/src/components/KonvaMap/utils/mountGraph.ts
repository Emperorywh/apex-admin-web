/**
 * @description 将接口数据转换为渲染所需的 MountNode / MountEdge
 */
import type { MapEdge, MapNode, MountEdge, MountNode } from "../KonvaMap.types";
import {
  computeBezierLabelPoint,
  computeCubicArrowPoints,
  computeLineArrowPoints,
  computeLinePoint,
  computeRotateArrow,
} from "./math";
import { forwardPathStyle, getNodeStyle, reversePathStyle } from "./styles";

/**
 * 挂载所有节点：样式查找 + y 取反 + 方向箭头
 */
export const mountGraphNodes = (nodes: MapNode[]): MountNode[] => {
  const mountNodes: MountNode[] = [];
  nodes.forEach((node) => {
    const { id, x, y, type, angle, name, ...rest } = node;
    const style = getNodeStyle(type);
    // 方向箭头：showArrow 且 angle 不为 null 时才计算
    const arrowPoints =
      style.showArrow && angle !== null
        ? computeRotateArrow(style.radius, -angle)
        : undefined;

    mountNodes.push({
      id,
      x,
      y: -y, // y 轴取反
      shapeStyle: style,
      data: {
        ...rest,
        name,
        type,
        angle,
        arrowPoints,
      },
    });
  });
  return mountNodes;
};

/**
 * 挂载所有路径：样式查找 + y 取反 + 方向箭头 + 标签位置
 */
export const mountGraphEdges = (edges: MapEdge[]): MountEdge[] => {
  if (!edges?.length) return [];
  const mountEdges: MountEdge[] = [];

  edges.forEach((edge) => {
    const { id, sx, sy, cx, cy, dx, dy, ex, ey, isBackEdge, name, ...rest } =
      edge;

    const shapeStyle = isBackEdge ? reversePathStyle : forwardPathStyle;

    // 是否是贝塞尔曲线
    const isBezier = cx !== null && cy !== null && dx !== null && dy !== null;

    if (isBezier) {
      // 贝塞尔曲线：起点 y 取反
      const bezierPoints: [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ] = [sx, -sy, cx, -cy, dx, -dy, ex, -ey];
      const arrowPoints = computeCubicArrowPoints(bezierPoints);
      const labelPos = computeBezierLabelPoint(bezierPoints);

      mountEdges.push({
        id,
        shapeStyle,
        data: {
          ...rest,
          sx,
          sy,
          cx,
          cy,
          dx,
          dy,
          ex,
          ey,
          name,
          isBackEdge,
          labelX: labelPos.x,
          labelY: labelPos.y,
          arrowPoints,
        },
      });
    } else {
      // 直线：起点 y 取反
      const linePoints: [number, number, number, number] = [sx, -sy, ex, -ey];
      const arrowPoints = computeLineArrowPoints(linePoints);
      const labelPos = computeLinePoint(linePoints);

      mountEdges.push({
        id,
        shapeStyle,
        data: {
          ...rest,
          sx,
          sy,
          cx: null,
          cy: null,
          dx: null,
          dy: null,
          ex,
          ey,
          name,
          isBackEdge,
          labelX: labelPos.x,
          labelY: labelPos.y,
          arrowPoints,
        },
      });
    }
  });

  return mountEdges;
};
