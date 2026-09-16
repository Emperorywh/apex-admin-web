/**
 * @description 对选中的元素进行对齐单独提出来
 * @date 2025-7-28
 *
 * 2026-04-27 追加：
 *  - straightenSelectedCurves：对齐后把"两端都在选区里"的贝塞尔曲线拉直
 *
 * 2026-05-18 追加：
 *  - 常规对齐改为基于屏幕视觉坐标计算，再反解回 Stage 本地坐标写入节点。
 */
import type Konva from "konva";
import { getIntl } from "@umijs/max";
import { screenToWorld, worldToScreen } from "./bindStage";
import { computeCubicArrowPoints, computeBezierLabelPoint, pointInABline } from "./math";
import { syncNodePositionWithEdges } from "./nodeEdgeGeometry";
import { saveSnapshot } from "./undoHistory";
import { message } from "antd";
import type { BezierPoints } from "./typing";

/**
 * 非组件 util 内的翻译：每次调用现取当前 intl。
 * 不能用 useI18n()（React hook，仅组件内可用），这里用 Umi 提供的非 hook 版 getIntl()。
 * 现取（而非模块加载时取一次）是为了避免模块加载阶段 g_intl 尚未初始化、
 * 以及支持运行期切换语言后立刻生效。
 */
const t = (id: string): string => getIntl().formatMessage({ id });

type VisualAlignAxis = "x" | "y";

interface VisualPoint {
    x: number;
    y: number;
}

interface VisualNode {
    shape: Konva.Shape;
    point: VisualPoint;
}

const UNIFORM_SPACING_DISTANCE = 1;

/**
 * @description 把控制点放在 sx,sy → ex,ey 这条线段的 1/3 和 2/3 处
 * 退化为视觉上完全笔直的三次贝塞尔曲线，且任一端点处切线方向与连线方向一致，
 * 这样 angle.ts 里基于控制点计算的 leave angle 与直线情形保持一致。
 *
 * 对一些极端情况（sx===ex && sy===ey）依旧返回起点，调用方需保证两端点不同。
 */
export const computeStraightControlPoints = (sx: number, sy: number, ex: number, ey: number) => {
    const cx = sx + (ex - sx) / 3;
    const cy = sy + (ey - sy) / 3;
    const dx = sx + (ex - sx) * 2 / 3;
    const dy = sy + (ey - sy) * 2 / 3;
    return { cx, cy, dx, dy };
};

/**
 * 对齐命令只允许移动节点，路径通过节点端点同步派生更新。
 * 这里集中筛选节点，避免菜单选中了路径但没有节点时进入无效几何计算，
 * 也让每个导出函数保持单一职责：只描述自己的视觉对齐规则。
 */
const getSelectedNodeShapes = (shapes: Konva.Shape[]) => {
    return shapes.filter(shape => shape.attrs?.enableSelect === "node");
};

/**
 * 视觉对齐使用的是用户当前看到的屏幕坐标轴，而不是地图原始坐标轴。
 * 因此节点先从 Stage 本地坐标转成屏幕坐标，所有 min/max/average
 * 都在屏幕坐标系里计算，旋转后的地图才能做到所见即所得。
 */
const getVisualNodes = (nodeShapes: Konva.Shape[], stage: Konva.Stage): VisualNode[] => {
    return nodeShapes.map(shape => ({
        shape,
        point: worldToScreen(shape.x(), shape.y(), stage)
    }));
};

/**
 * 屏幕坐标只用于表达视觉目标位置，不能直接写回节点。
 * 写入前必须用 screenToWorld 反解回 Stage 本地坐标，再通过统一同步工具
 * 更新节点和关联路径，保证节点、路径端点、箭头、标签使用同一套数据。
 */
const applyVisualPointToNode = (stage: Konva.Stage, visualNode: VisualNode, targetPoint: VisualPoint) => {
    const nextPosition = screenToWorld(targetPoint.x, targetPoint.y, stage);
    syncNodePositionWithEdges(visualNode.shape, nextPosition);
};

const getAxisValues = (visualNodes: VisualNode[], axis: VisualAlignAxis) => {
    return visualNodes.map(node => node.point[axis]);
};

const getAverage = (values: number[]) => {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

/**
 * 轴向对齐只替换目标视觉轴的坐标，另一条视觉轴保持节点原位置。
 * 例如旋转 30° 后做左对齐，只统一屏幕 x，屏幕 y 不变；
 * 反解回 Stage 后本地 x/y 可能同时变化，这是旋转视图下的正确结果。
 */
const alignByVisualAxis = (
    shapes: Konva.Shape[],
    axis: VisualAlignAxis,
    getTargetValue: (values: number[]) => number
) => {
    const nodeShapes = getSelectedNodeShapes(shapes);
    if (!nodeShapes.length) return;
    const stage = nodeShapes[0]?.getStage();
    if (!stage) return;

    const visualNodes = getVisualNodes(nodeShapes, stage);
    const targetValue = getTargetValue(getAxisValues(visualNodes, axis));
    visualNodes.forEach(visualNode => {
        applyVisualPointToNode(stage, visualNode, {
            x: axis === "x" ? targetValue : visualNode.point.x,
            y: axis === "y" ? targetValue : visualNode.point.y
        });
    });
};

/**
 * 等间距分布保留旧逻辑的固定 1 地图单位步距，不改成首尾均分。
 * 因为视觉坐标是屏幕像素，这里用当前缩放值把 1 个地图单位转换成屏幕距离；
 * 旋转只改变方向，不改变这个单位距离在视觉轴上的目标步长。
 */
const distributeByVisualAxis = (shapes: Konva.Shape[], axis: VisualAlignAxis) => {
    const nodeShapes = getSelectedNodeShapes(shapes);
    if (!nodeShapes.length) return;
    const stage = nodeShapes[0]?.getStage();
    if (!stage) return;

    const visualNodes = getVisualNodes(nodeShapes, stage);
    const minValue = Math.min(...getAxisValues(visualNodes, axis));
    const visualDistance = Math.abs(axis === "x" ? stage.scaleX() : stage.scaleY()) * UNIFORM_SPACING_DISTANCE;

    visualNodes.forEach((visualNode, index) => {
        const targetValue = minValue + visualDistance * index;
        applyVisualPointToNode(stage, visualNode, {
            x: axis === "x" ? targetValue : visualNode.point.x,
            y: axis === "y" ? targetValue : visualNode.point.y
        });
    });
};

/**
 * @description 对选中的元素进行左对齐
 * @param shapes 所有选中的元素
 */
export const alignSelectLeft = (shapes: Konva.Shape[]) => {
    alignByVisualAxis(shapes, "x", values => Math.min(...values));
};

/**
 * @description 对选中的元素进行右对齐
 * @param shapes 所有选中的元素
 */
export const alignSelectRight = (shapes: Konva.Shape[]) => {
    alignByVisualAxis(shapes, "x", values => Math.max(...values));
};

/**
 * @description 对选中的元素进行顶部对齐
 * @param shapes 选中的元素
 */
export const alignSelectTop = (shapes: Konva.Shape[]) => {
    alignByVisualAxis(shapes, "y", values => Math.min(...values));
};

/**
 * @description 对选中的元素底部对齐
 * @param shapes 选中的元素
 */
export const alignSelectBottom = (shapes: Konva.Shape[]) => {
    alignByVisualAxis(shapes, "y", values => Math.max(...values));
};

/**
 * @description 对选中的元素在垂直的一条线上对齐
 * @param shapes 选中的元素
 */
export const alignVerticalCenter = (shapes: Konva.Shape[]) => {
    alignByVisualAxis(shapes, "x", getAverage);
};

/**
 * @description 对选中的元素在水平的一条线上对齐
 * @param shapes 选中的元素
 */
export const alignHorizontalCenter = (shapes: Konva.Shape[]) => {
    alignByVisualAxis(shapes, "y", getAverage);
};

/**
 * @description 对选中的元素水平等间距分布
 * @param shapes 选中的元素
 */
export const horizontalUniformSpacingDistribution = (shapes: Konva.Shape[]) => {
    distributeByVisualAxis(shapes, "x");
};

/**
 * @description 对选中的元素垂直等间距分布
 * @param shapes 选中的元素
 */
export const verticalEquidistantDistribution = (shapes: Konva.Shape[]) => {
    distributeByVisualAxis(shapes, "y");
};

/**
 * @description 对齐结束后，把"两端节点都在选区里"的贝塞尔曲线拉直
 *
 * 触发场景：
 *  - 用户框选若干节点 + 它们之间的贝塞尔曲线
 *  - 选了任何对齐方式（如左对齐 / 顶部对齐 / 等距分布等）
 *  - 节点位置已经对齐，但曲线的 cx/cy/dx/dy 还是原来的值，导致曲线仍有弧度，
 *    在节点处看到的"夹角"也不是用户预期的笔直走向
 *
 * 处理：
 *  - 仅处理 snodeId 和 enodeId 都在选区节点集合里的边
 *  - 仅处理 cx/cy/dx/dy 都不为空的曲线（即 edgeType === "BEZIER"）
 *  - 不把贝塞尔退化成直线（不清空 cx/cy/dx/dy），而是把控制点重置到 sx,sy → ex,ey
 *    线段的 1/3、2/3 处，让曲线"视觉上笔直"但仍然保留 BEZIER 类型，方便用户后续
 *    继续拖控制点恢复弧度。
 *  - 按贝塞尔曲线重算 arrowPoints / labelX / labelY，避免和直线公式混用导致箭头偏移。
 *  - 一端在选区外的曲线保持原样，避免误改没有参与对齐的路径
 *  - 起点和终点重合（sx===ex && sy===ey）的退化情况直接跳过，避免出现零向量
 */
export const straightenSelectedCurves = (shapes: Konva.Shape[]) => {
    if (!shapes?.length) return;
    const stage = shapes[0]?.getStage();
    if (!stage) return;
    const selectedNodeIds = new Set<string>();
    shapes.forEach(shape => {
        const id = shape.attrs?.id;
        if (typeof id !== "string" || !id) return;
        if (shape.attrs?.enableSelect === "node") selectedNodeIds.add(id);
    });
    if (selectedNodeIds.size < 2) return;
    const edgeShapes: Konva.Shape[] = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "edge");
    edgeShapes.forEach(edgeShape => {
        const data = edgeShape.attrs?.data;
        if (!data) return;
        const { snodeId, enodeId, sx, sy, ex, ey } = data;
        if (!selectedNodeIds.has(snodeId) || !selectedNodeIds.has(enodeId)) return;
        // 用 != null 同时排除 null 和 undefined，避免某些曲线字段意外为 undefined 时漏判
        const isCurve = data.cx != null && data.cy != null && data.dx != null && data.dy != null;
        if (!isCurve) return;
        if (sx === ex && sy === ey) return;
        const { cx, cy, dx, dy } = computeStraightControlPoints(sx, sy, ex, ey);
        const points: BezierPoints = [sx, -sy, cx, -cy, dx, -dy, ex, -ey];
        const arrowPoints = computeCubicArrowPoints(points);
        const label = computeBezierLabelPoint(points);
        edgeShape.setAttrs({
            data: {
                ...data,
                cx,
                cy,
                dx,
                dy,
                arrowPoints,
                labelX: label.x,
                labelY: label.y
            }
        });
    });
};

/**
 * 两点对齐查找的简单路径数量上限。
 * 只需判定「唯一 / 多条」两种语义，因此只要找到第 2 条路径即可立即停止，
 * 避免在稠密/环形图上做全量枚举导致指数级开销。
 */
const TWO_POINTS_ALIGN_MAX_PATHS = 2;

/**
 * 单次 DFS 的最大访问深度（边跳数），作为环形/超大图下的兜底保护，
 * 防止因数据异常或环路过深导致递归不可终止。
 */
const TWO_POINTS_ALIGN_MAX_DEPTH = 200;

/**
 * @description 在 stage 上构建无向邻接表，并枚举 startId → endId 的简单路径
 *              （不重复访问节点的路径）。边视为无向：snodeId↔enodeId 互通。
 *              命中第 {@link TWO_POINTS_ALIGN_MAX_PATHS} 条即提前返回，
 *              因为上层只需判断「唯一」还是「多条」。
 * @returns 找到的简单路径数组（每条为节点 id 序列，含起止端点）；找不到时为空数组
 */
export const findSimplePaths = (stage: Konva.Stage, startId: string, endId: string): string[][] => {
    // 构建邻接表：节点 id → 相邻节点 id 集合（去重，忽略自环与空 id）
    const adjacency = new Map<string, Set<string>>();
    const edgeShapes: Konva.Shape[] = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "edge");
    edgeShapes.forEach(edgeShape => {
        const data = edgeShape.attrs?.data;
        if (!data) return;
        const { snodeId, enodeId } = data;
        if (!snodeId || !enodeId || snodeId === enodeId) return;
        if (!adjacency.has(snodeId)) adjacency.set(snodeId, new Set());
        if (!adjacency.has(enodeId)) adjacency.set(enodeId, new Set());
        adjacency.get(snodeId)!.add(enodeId);
        adjacency.get(enodeId)!.add(snodeId);
    });

    const paths: string[][] = [];
    const visited = new Set<string>([startId]);

    const dfs = (currentId: string, route: string[]) => {
        // 已收集到足以判定「多条」，立即剪枝终止
        if (paths.length >= TWO_POINTS_ALIGN_MAX_PATHS) return;
        if (currentId === endId) {
            paths.push([...route]);
            return;
        }
        // 深度兜底，防止异常数据导致递归过深
        if (route.length > TWO_POINTS_ALIGN_MAX_DEPTH) return;
        const neighbors = adjacency.get(currentId);
        if (!neighbors) return;
        neighbors.forEach(nextId => {
            if (visited.has(nextId)) return;
            visited.add(nextId);
            route.push(nextId);
            dfs(nextId, route);
            route.pop();
            visited.delete(nextId);
        });
    };

    dfs(startId, [startId]);
    return paths;
};

/**
 * @description 两点对齐（右键菜单）
 *              选中恰好两个节点 A、B → 沿边连通性找出 A→B 之间唯一路径上的中间节点，
 *              把它们垂直投影到 A→B 直线上（保留彼此疏密，A、B 不动），
 *              节点移动后同步关联路径；再把两端都在路径上的贝塞尔边视觉拉直。
 *
 * 边界处理（任一命中即 message.warning 并 return，不做任何移动）：
 *  - 选中不足两个节点 / 含非节点元素：忽略（菜单层已 disabled，此为防御）
 *  - A、B 之间无边连通：「两点间无可达路径」
 *  - A、B 之间存在多条简单路径：「两点间存在多条路径，无法确定唯一对齐目标」
 *  - 唯一路径无中间节点（A、B 直连）：「两点间无中间节点需对齐」
 *  - A、B 视觉位置重合（线段退化为点）：「起点和终点的视觉位置不能重合」
 *
 * 坐标空间：投影在屏幕坐标（兼容地图旋转），写回时反解为 Stage 本地坐标，
 * 与现有轴向对齐、AlignModal 保持一致的「所见即所得」约定。
 *
 * @param shapes 当前选中的元素（取前两个节点为 A、B，按选中顺序）
 */
export const alignTwoPointsLine = (shapes: Konva.Shape[]) => {
    const nodeShapes = (shapes || []).filter(shape => shape.attrs?.enableSelect === "node");
    if (nodeShapes.length < 2) return;
    const aShape = nodeShapes[0];
    const bShape = nodeShapes[1];
    const stage = aShape?.getStage();
    if (!stage) return;
    const aId = aShape.attrs?.id;
    const bId = bShape.attrs?.id;
    if (!aId || !bId || aId === bId) return;

    // 1. 沿边连通性找唯一简单路径
    const paths = findSimplePaths(stage, aId, bId);
    if (paths.length === 0) {
        message.warning(t("两点间无可达路径"));
        return;
    }
    if (paths.length >= 2) {
        message.warning(t("两点间存在多条路径，无法确定唯一对齐目标"));
        return;
    }
    // 唯一路径上的中间节点（去掉首尾端点 A、B）
    const pathNodeIds: string[] = paths[0];
    const middleIds = pathNodeIds.slice(1, -1);
    if (middleIds.length === 0) {
        message.warning(t("两点间无中间节点需对齐"));
        return;
    }

    // 2. 屏幕（视觉）坐标系下的基准线段，A、B 作为基准不移动
    const sourceVisualPoint = worldToScreen(aShape.x(), aShape.y(), stage);
    const targetVisualPoint = worldToScreen(bShape.x(), bShape.y(), stage);
    const visualLineLength = Math.hypot(
        sourceVisualPoint.x - targetVisualPoint.x,
        sourceVisualPoint.y - targetVisualPoint.y
    );
    if (visualLineLength < 1e-6) {
        message.warning(t("起点和终点的视觉位置不能重合"));
        return;
    }

    // 3. 取中间节点 Shape（按路径顺序），逐个投影到 A→B 直线并同步连边
    const middleShapes: Konva.Shape[] = [];
    middleIds.forEach(id => {
        const found = stage.findOne((s: Konva.Shape) => s.attrs?.enableSelect === "node" && s.attrs?.id === id);
        if (found) middleShapes.push(found as Konva.Shape);
    });
    if (middleShapes.length === 0) {
        message.warning(t("两点间无中间节点需对齐"));
        return;
    }

    saveSnapshot();

    const sourcePoint: [number, number] = [sourceVisualPoint.x, sourceVisualPoint.y];
    const targetPoint: [number, number] = [targetVisualPoint.x, targetVisualPoint.y];
    middleShapes.forEach(shape => {
        const shapeVisualPoint = worldToScreen(shape.x(), shape.y(), stage);
        const shapePoint: [number, number] = [shapeVisualPoint.x, shapeVisualPoint.y];
        const projectedPoint = pointInABline(sourcePoint, targetPoint, shapePoint);
        const nextPosition = screenToWorld(projectedPoint.x, projectedPoint.y, stage);
        syncNodePositionWithEdges(shape, nextPosition);
    });

    // 4. 拉直：两端节点都在路径上（A、B + 中间节点）的贝塞尔边视觉拉直，
    //    控制点重置到端点连线的 1/3、2/3 处，复用 straightenSelectedCurves 的判定与几何
    const pathNodeSet = new Set<string>(pathNodeIds);
    const allEdgeShapes: Konva.Shape[] = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "edge");
    allEdgeShapes.forEach(edgeShape => {
        const data = edgeShape.attrs?.data;
        if (!data) return;
        const { snodeId, enodeId, sx, sy, ex, ey } = data;
        if (!pathNodeSet.has(snodeId) || !pathNodeSet.has(enodeId)) return;
        const isCurve = data.cx != null && data.cy != null && data.dx != null && data.dy != null;
        if (!isCurve) return;
        if (sx === ex && sy === ey) return;
        const { cx, cy, dx, dy } = computeStraightControlPoints(sx, sy, ex, ey);
        const points: BezierPoints = [sx, -sy, cx, -cy, dx, -dy, ex, -ey];
        const arrowPoints = computeCubicArrowPoints(points);
        const label = computeBezierLabelPoint(points);
        edgeShape.setAttrs({
            data: {
                ...data,
                cx,
                cy,
                dx,
                dy,
                arrowPoints,
                labelX: label.x,
                labelY: label.y
            }
        });
    });

    // 5. 整个流程都是直接 setAttrs，没有触发 Konva drag/mouse 事件，
    //    AnglesLayer 监听不到几何变化；主动派发一次 angles:refresh 让夹角层立刻重算
    stage.fire("angles:refresh", {} as any);
};
