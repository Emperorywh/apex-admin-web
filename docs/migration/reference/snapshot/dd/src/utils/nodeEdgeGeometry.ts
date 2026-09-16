/**
 * @description 节点与关联路径的几何同步工具
 * @date 2026-05-18
 */
import type Konva from "konva";
import { computeCubicArrowPoints, computeLineArrowPoints, computeBezierLabelPoint, computeLinePoint } from "./math";
import type { BezierPoints, LinePoint } from "./typing";

export interface StagePoint {
    x: number;
    y: number;
}

type EdgeGeometryData = Record<string, any> & {
    sx: number;
    sy: number;
    cx: number | null;
    cy: number | null;
    dx: number | null;
    dy: number | null;
    ex: number;
    ey: number;
    snodeId: string;
    enodeId: string;
};

/**
 * 这里集中判断路径是否为贝塞尔曲线，避免各个业务入口重复写
 * cx/cy/dx/dy 的空值判断。只要任一控制点缺失，就按直线处理，
 * 和现有渲染层、拖拽层的判定规则保持一致。
 */
const isBezierEdge = (data: EdgeGeometryData) => (
    data.cx != null &&
    data.cy != null &&
    data.dx != null &&
    data.dy != null
);

/**
 * 路径数据保存的是地图坐标，Canvas 绘制时 y 需要取反。
 * 该函数只负责根据最新端点/控制点重算 arrowPoints 与 label，
 * 不决定节点如何移动，从而把“几何派生数据”与“交互意图”隔离开。
 */
const computeEdgeGeometryData = (data: EdgeGeometryData): EdgeGeometryData => {
    if (isBezierEdge(data)) {
        const points: BezierPoints = [
            data.sx,
            -data.sy,
            data.cx as number,
            -(data.cy as number),
            data.dx as number,
            -(data.dy as number),
            data.ex,
            -data.ey
        ];
        const arrowPoints = computeCubicArrowPoints(points);
        const label = computeBezierLabelPoint(points);
        return {
            ...data,
            arrowPoints,
            labelX: label.x,
            labelY: label.y
        };
    }

    const points: LinePoint = [data.sx, -data.sy, data.ex, -data.ey];
    const arrowPoints = computeLineArrowPoints(points);
    const label = computeLinePoint(points);
    return {
        ...data,
        cx: null,
        cy: null,
        dx: null,
        dy: null,
        arrowPoints,
        labelX: label.x,
        labelY: label.y
    };
};

/**
 * 节点 Shape 的 y 是 Konva 本地坐标，路径 data 的 sy/ey 是地图坐标。
 * 因此同步端点时必须写成 sy/ey = -position.y，保证保存数据、
 * 渲染数据和后续夹角计算继续使用同一套坐标约定。
 */
const syncEdgeEndpointByNode = (edgeShape: Konva.Shape, nodeId: string, position: StagePoint) => {
    const data = edgeShape.attrs?.data as EdgeGeometryData | undefined;
    if (!data) return;

    let changed = false;
    let nextData: EdgeGeometryData = { ...data };

    if (data.snodeId === nodeId) {
        changed = true;
        nextData = {
            ...nextData,
            sx: position.x,
            sy: -position.y
        };
    }

    if (data.enodeId === nodeId) {
        changed = true;
        nextData = {
            ...nextData,
            ex: position.x,
            ey: -position.y
        };
    }

    if (!changed) return;
    edgeShape.setAttrs({
        data: computeEdgeGeometryData(nextData)
    });
};

/**
 * 所有“移动节点并同步关联路径”的入口都应走这里：
 * 先写节点本地坐标，再扫描当前 Stage 上引用该节点的路径，
 * 最后统一重算路径端点、箭头和标签，减少对齐/弹窗等模块的耦合。
 */
export const syncNodePositionWithEdges = (nodeShape: Konva.Shape, position: StagePoint) => {
    nodeShape.setAttrs({
        x: position.x,
        y: position.y
    });

    const stage = nodeShape.getStage();
    const nodeId = nodeShape.attrs?.id || nodeShape.id();
    if (!stage || !nodeId) return;

    const relatedEdgeShapes: Konva.Shape[] = stage.find((shape: Konva.Shape) => (
        shape.attrs?.enableSelect === "edge" &&
        (
            shape.attrs?.data?.snodeId === nodeId ||
            shape.attrs?.data?.enodeId === nodeId
        )
    ));
    relatedEdgeShapes.forEach(edgeShape => {
        syncEdgeEndpointByNode(edgeShape, nodeId, position);
    });
};
