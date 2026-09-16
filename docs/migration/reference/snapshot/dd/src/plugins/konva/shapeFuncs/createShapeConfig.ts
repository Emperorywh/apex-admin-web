/**
 * @description 节点和路径 Shape 配置的纯函数工厂
 * @date 2026-5-27
 *
 * 集中管理节点/路径的样式、arrowPoints、labelX/Y 计算，
 * 供 NodesLayer/EdgesLayer 初始挂载、新建、复制、右键菜单复用。
 */
import { getNodeStyle } from "../nodes";
import { forwardPath } from "../path/forwardPath";
import { reversePath } from "../path/reversePath";
import { computeRotateArrow, mountGraphEdges } from "@/utils/graph";
import { computeLineArrowPoints, computeCubicArrowPoints, computeBezierLabelPoint, computeLinePoint } from "@/utils/math";
import type { MapNode, MapEdge, LinePoint, BezierPoints } from "@/utils/typing";
import type Konva from "konva";

/**
 * 根据节点数据 + visualScale 生成 Konva.Shape 构造参数（不含 sceneFunc/hitFunc）。
 * 用于 NodesLayer 初始挂载、AddNode 预览、ContextMenu/createNodeByRobot、CopyModal 复制节点。
 */
export const createNodeShapeConfig = (
    node: MapNode,
    visualScale: number = 1
): Konva.ShapeConfig => {
    const { id, x, y, type, angle, ...rest } = node;
    const { radius, showArrow, fill, stroke, lineWidth, labelFill } = getNodeStyle(type);
    const scaledRadius = radius * visualScale;
    const scaledLineWidth = lineWidth * visualScale;
    const arrowPoints = showArrow && angle !== null
        ? computeRotateArrow(scaledRadius, -angle)
        : undefined;

    return {
        id,
        x,
        y: -y,
        shapeStyle: {
            radius: scaledRadius,
            fill,
            stroke,
            lineWidth: scaledLineWidth,
            labelFill,
        },
        data: {
            ...rest,
            type,
            angle,
            arrowPoints,
        },
        state: "",
        draggable: true,
        enableSelect: "node",
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
    };
};

/**
 * 根据路径数据 + visualScale 生成 Konva.Shape 构造参数（不含 sceneFunc/hitFunc）。
 * 用于 EdgesLayer 初始挂载、AddEdge、ContextMenu 添加反向路径、CopyModal 复制路径。
 */
export const createEdgeShapeConfig = (
    edge: MapEdge,
    visualScale: number = 1
): Konva.ShapeConfig => {
    const { id, sx, sy, cx, cy, dx, dy, ex, ey, isBackEdge, ...rest } = edge;
    const stroke = isBackEdge ? reversePath.stroke : forwardPath.stroke;
    const labelFill = isBackEdge ? reversePath.labelFill : forwardPath.labelFill;
    const lineWidth = (isBackEdge ? reversePath.lineWidth : forwardPath.lineWidth) * visualScale;

    let arrowPoints;
    let labelX: number;
    let labelY: number;

    if (cx === null || cy === null || dx === null || dy === null) {
        const points: LinePoint = [sx, -sy, ex, -ey];
        arrowPoints = computeLineArrowPoints(points);
        const label = computeLinePoint(points);
        labelX = label.x;
        labelY = label.y;
    } else {
        const points: BezierPoints = [sx, -sy, cx, -cy, dx, -dy, ex, -ey];
        arrowPoints = computeCubicArrowPoints(points);
        const label = computeBezierLabelPoint(points);
        labelX = label.x;
        labelY = label.y;
    }

    return {
        id,
        shapeStyle: { labelFill, stroke, lineWidth },
        data: {
            ...rest,
            id,
            sx, sy, cx, cy, dx, dy, ex, ey,
            isBackEdge,
            labelX,
            labelY,
            arrowPoints,
        },
        state: "",
        enableSelect: "edge",
        hitStrokeWidth: Math.max(lineWidth * 3, 0.1),
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
    };
};
