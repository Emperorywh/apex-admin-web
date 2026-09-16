/**
 * @description 节点夹角相关算法
 *  - buildAngleMarks: 用于在 AnglesLayer 上展示节点处相邻 edge 的夹角
 *  - snapNearRightAngles: 框选对齐后把"接近 90° 的夹角"自动吸附到 90°
 * @date 2026-04-27
 *
 * 名词约定：
 * - "leave angle"（离开角）：一条 edge 在某个节点处朝外离开的方向角，单位弧度，
 *   坐标系为业务侧的"地图坐标系"（+x 向右，+y 向上）。
 *   这意味着同一条 edge 在它的起点处和终点处的 leave angle 不同，且互为反方向（差 π）。
 * - "sweep"：将节点上的所有 edge 按 leave angle 升序排序后，相邻两条 edge 之间
 *   逆时针扫过的角度，单位弧度，恒在 (0, 2π] 区间。绕节点一圈所有 sweep 之和等于 2π。
 *
 * 渲染时（react-konva canvas 坐标系）需要把 y 取负，但本模块里所有角度都返回地图坐标系的值，
 * 由调用方负责转换。
 */
import type Konva from "konva";
import { computeCubicArrowPoints, computeLineArrowPoints, computeBezierLabelPoint, computeLinePoint } from "./math";
import type { BezierPoints, LinePoint } from "./typing";

const TAU = Math.PI * 2;

/**
 * @description 用于计算 leave angle 的最小化 edge 字段集
 * 故意只保留几何相关字段，避免与 typing.d.ts 里完整的 MapEdge 强耦合，
 * 这样既可以接受从 React state 拿到的原始 MapEdge，也可以接受从 Konva 节点
 * 实时读取的 attrs.data。
 */
export interface AngleEdgeLike {
    id: string;
    sx: number;
    sy: number;
    ex: number;
    ey: number;
    cx: number | null;
    cy: number | null;
    dx: number | null;
    dy: number | null;
    snodeId: string;
    enodeId: string;
}

/**
 * @description 用于定位节点位置的最小化 node 字段集
 */
export interface AngleNodeLike {
    id: string;
    x: number;
    y: number;
}

/**
 * @description 节点上某条 edge 的离开角描述
 */
export interface NodeLeaveEntry {
    edgeId: string;
    leaveAngle: number;
}

/**
 * @description 节点上相邻两条 edge 之间的夹角标记（用于 AnglesLayer 渲染）
 */
export interface AngleMark {
    /** 所在节点 id */
    nodeId: string;
    /** 节点的地图坐标 x */
    nodeX: number;
    /** 节点的地图坐标 y */
    nodeY: number;
    /** 排序后较小一侧的 edge id（沿 CCW 方向起始的那一条） */
    edgeIdA: string;
    /** 排序后较大一侧的 edge id（沿 CCW 方向终止的那一条） */
    edgeIdB: string;
    /** edgeA 的离开角（弧度，地图坐标系） */
    angleA: number;
    /** edgeB 的离开角（弧度，地图坐标系） */
    angleB: number;
    /** 从 angleA CCW 扫到 angleB 的角度（弧度，恒为正） */
    sweep: number;
    /** 同 sweep，但单位是度，方便 UI 展示 */
    degree: number;
}

/**
 * @description 计算一条 edge 在指定节点处朝外离开的方向角（弧度，地图坐标系）
 * 优先用几何（控制点 / 终点）计算切线方向，避免 sfacing/efacing 在控制点编辑过程中
 * 滞后导致的偏差。
 *
 * 规则：
 * - 节点是 edge 起点（snodeId === nodeId）：
 *     有控制点 → atan2(cy - sy, cx - sx)
 *     直线     → atan2(ey - sy, ex - sx)
 * - 节点是 edge 终点（enodeId === nodeId）：
 *     有控制点 → atan2(dy - ey, dx - ex)（从终点反方向看向第二控制点 D）
 *     直线     → atan2(sy - ey, sx - ex)
 * - 节点既非起点也非终点 → 返回 null（不应发生，容错）
 *
 * @param edge   只需提供几何字段的 edge
 * @param nodeId 想计算 leave angle 的目标节点 id
 * @returns 弧度值，或 null
 */
export const computeNodeLeaveAngle = (edge: AngleEdgeLike, nodeId: string): number | null => {
    const { sx, sy, cx, cy, dx, dy, ex, ey, snodeId, enodeId } = edge;
    const isStart = snodeId === nodeId;
    const isEnd = enodeId === nodeId;
    if (!isStart && !isEnd) return null;
    const hasControl = cx !== null && cy !== null && dx !== null && dy !== null;
    if (isStart) {
        if (hasControl) return Math.atan2((cy as number) - sy, (cx as number) - sx);
        return Math.atan2(ey - sy, ex - sx);
    }
    if (hasControl) return Math.atan2((dy as number) - ey, (dx as number) - ex);
    return Math.atan2(sy - ey, sx - ex);
};

/**
 * @description 给定全部 nodes 和 edges，计算每个节点上相邻 edge 间的夹角标记
 *
 * 规则：
 * 1. 把每条 edge 按"它在 snodeId 处的 leave angle"和"在 enodeId 处的 leave angle"
 *    分别计入两个节点的 entry 列表。
 * 2. 节点上少于 2 条 edge 不生成标记。
 * 3. 节点上 N 条 edge 按 leave angle 升序排序后，依次取相邻对（含末尾绕回首项），
 *    计算 CCW sweep，并过滤掉 sweep > π 的"外角"，只保留较小的"内角"标记，
 *    避免 N=2 时画两个互补的弧、或交叉路口出现冗余。
 * 4. sweep 接近 0 的（重合方向）跳过，防止数值噪声。
 *
 * @returns 全部夹角标记，顺序按节点出现顺序
 */
export const buildAngleMarks = (
    nodes: AngleNodeLike[],
    edges: AngleEdgeLike[]
): AngleMark[] => {
    if (!nodes?.length || !edges?.length) return [];
    const nodeMap = new Map<string, AngleNodeLike>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const byNode = new Map<string, NodeLeaveEntry[]>();
    edges.forEach(edge => {
        ([edge.snodeId, edge.enodeId] as string[]).forEach(nodeId => {
            if (!nodeId || !nodeMap.has(nodeId)) return;
            const angle = computeNodeLeaveAngle(edge, nodeId);
            if (angle === null || !Number.isFinite(angle)) return;
            const list = byNode.get(nodeId) ?? [];
            list.push({ edgeId: edge.id, leaveAngle: angle });
            byNode.set(nodeId, list);
        });
    });

    const marks: AngleMark[] = [];
    const EPS = 1e-6;
    byNode.forEach((list, nodeId) => {
        if (list.length < 2) return;
        const node = nodeMap.get(nodeId);
        if (!node) return;
        const sorted = [...list].sort((a, b) => a.leaveAngle - b.leaveAngle);
        /**
         * 关键观察：同方向的两条边（如 forward+reverse 双向边对）leave angle 完全相等，
         * 对应相邻 sweep = 0。因此"非零 sweep 个数"= 节点上"独立离开方向"数。
         *
         * - 独立方向 = 2（"通过型"节点，无论物理边数是 2/3/4...）：
         *   两个非零 sweep 必然互补、和为 2π。两段都画，避免出现"180° 共线 → 完整圆，
         *   178.4° 几乎共线 → 半圆"的视觉不一致。
         * - 独立方向 >= 3（真三/四叉路口）：保留内角（sweep ≤ π），过滤外角，
         *   避免相邻区间重叠。
         *
         * 为何不能用 sorted.length === 2 判定：当节点同时挂着正反双向边时
         * （图里的 L1147 / L1147-1），物理边数已经 ≥ 3，但本质方向只有 2 个，
         * 仍需走"双侧都画"的分支。
         */
        const sweeps: number[] = sorted.map((_, i) => {
            const a = sorted[i];
            const b = sorted[(i + 1) % sorted.length];
            const raw = b.leaveAngle - a.leaveAngle;
            return ((raw % TAU) + TAU) % TAU;
        });
        const isTwoCluster = sweeps.filter(s => s > EPS).length === 2;

        for (let i = 0; i < sorted.length; i++) {
            const sweep = sweeps[i];
            if (sweep < EPS) continue;
            if (!isTwoCluster && sweep > Math.PI + EPS) continue;
            const a = sorted[i];
            const b = sorted[(i + 1) % sorted.length];
            marks.push({
                nodeId,
                nodeX: node.x,
                nodeY: node.y,
                edgeIdA: a.edgeId,
                edgeIdB: b.edgeId,
                angleA: a.leaveAngle,
                angleB: b.leaveAngle,
                sweep,
                degree: (sweep * 180) / Math.PI
            });
        }
    });
    return marks;
};

/**
 * @description 框选对齐后"近 90° 自动吸附"的容差，单位度
 */
const NEAR_RIGHT_ANGLE_TOLERANCE_DEG = 5;
/**
 * @description 吸附最大迭代次数：每次只处理一个角，处理后重新计算，避免相邻角连锁影响
 */
const SNAP_MAX_ITER = 30;
/**
 * @description 已经达到 90° 的判定阈值（度）；防止已吸附的角重复参与
 */
const SNAP_EPS_DEG = 1e-3;

interface SnapGeometry {
    nodes: AngleNodeLike[];
    edges: AngleEdgeLike[];
    nodeShapeMap: Map<string, Konva.Shape>;
    edgeShapeMap: Map<string, Konva.Shape>;
}

/**
 * @description 从 Konva stage 上把所有 node / edge 的实时几何收集起来，
 *              同时返回 id → shape 的映射，便于后续就地改写 attrs。
 *              坐标统一转回地图坐标系（y 取负），与 buildAngleMarks 输入保持一致。
 */
const collectStageGeometry = (stage: Konva.Stage): SnapGeometry => {
    const nodeShapes: Konva.Shape[] = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "node");
    const edgeShapes: Konva.Shape[] = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "edge");
    const nodeShapeMap = new Map<string, Konva.Shape>();
    const nodes: AngleNodeLike[] = [];
    nodeShapes.forEach((s: Konva.Shape) => {
        const id = s.attrs?.id;
        if (typeof id !== "string" || !id) return;
        nodeShapeMap.set(id, s);
        nodes.push({ id, x: s.x(), y: -s.y() });
    });
    const edgeShapeMap = new Map<string, Konva.Shape>();
    const edges: AngleEdgeLike[] = [];
    edgeShapes.forEach((s: Konva.Shape) => {
        const id = s.attrs?.id;
        const data = s.attrs?.data;
        if (typeof id !== "string" || !id || !data) return;
        edgeShapeMap.set(id, s);
        edges.push({
            id,
            sx: data.sx,
            sy: data.sy,
            cx: data.cx ?? null,
            cy: data.cy ?? null,
            dx: data.dx ?? null,
            dy: data.dy ?? null,
            ex: data.ex,
            ey: data.ey,
            snodeId: data.snodeId,
            enodeId: data.enodeId
        });
    });
    return { nodes, edges, nodeShapeMap, edgeShapeMap };
};

/**
 * @description 把一条 edge 绕"它在 pivotNodeId 处的端点"旋转 delta 弧度（CCW 为正，地图坐标系）
 * 旋转范围包含起点 / 终点 / 两个贝塞尔控制点。pivot 处的端点经过旋转后位置不变，
 * 远端端点则沿着 pivot 为圆心的圆弧移动。
 *
 * 副作用（保持画布几何一致性）：
 * - 写回 edge 的 attrs.data：sx/sy/cx/cy/dx/dy/ex/ey 以及 arrowPoints / labelX / labelY
 * - 把"远端节点"的 Konva shape 同步到旋转后的位置
 * - 与远端节点相连的所有"其它 edge"，把它们对应那一端的坐标同步到新位置（仅平移端点，不旋转控制点），
 *   并重算 arrow / label。这一步避免远端节点动了之后其它边出现"断头"。
 */
const rotateEdgeAroundPivot = (
    edgeShape: Konva.Shape,
    pivotNodeId: string,
    pivotX: number,
    pivotY: number,
    delta: number,
    nodeShapeMap: Map<string, Konva.Shape>,
    edgeShapeMap: Map<string, Konva.Shape>
): void => {
    const data = edgeShape.attrs?.data;
    if (!data) return;
    const isStart = data.snodeId === pivotNodeId;
    const isEnd = data.enodeId === pivotNodeId;
    if (!isStart && !isEnd) return;
    const farId: string = isStart ? data.enodeId : data.snodeId;
    const cosD = Math.cos(delta);
    const sinD = Math.sin(delta);
    const rotMap = (px: number, py: number) => {
        const dxp = px - pivotX;
        const dyp = py - pivotY;
        return { x: pivotX + dxp * cosD - dyp * sinD, y: pivotY + dxp * sinD + dyp * cosD };
    };

    const { sx, sy, ex, ey } = data;
    const cx0 = data.cx ?? null;
    const cy0 = data.cy ?? null;
    const dx0 = data.dx ?? null;
    const dy0 = data.dy ?? null;
    const hasCtrl = cx0 !== null && cy0 !== null && dx0 !== null && dy0 !== null;
    const newS = rotMap(sx, sy);
    const newE = rotMap(ex, ey);
    const newC = hasCtrl ? rotMap(cx0 as number, cy0 as number) : null;
    const newD = hasCtrl ? rotMap(dx0 as number, dy0 as number) : null;

    const points = !hasCtrl
        ? ([newS.x, -newS.y, newE.x, -newE.y] as LinePoint)
        : ([
            newS.x, -newS.y,
            (newC as { x: number; y: number }).x, -(newC as { x: number; y: number }).y,
            (newD as { x: number; y: number }).x, -(newD as { x: number; y: number }).y,
            newE.x, -newE.y
        ] as BezierPoints);
    const arrowPoints = !hasCtrl
        ? computeLineArrowPoints(points as LinePoint)
        : computeCubicArrowPoints(points as BezierPoints);
    const label = !hasCtrl
        ? computeLinePoint(points as LinePoint)
        : computeBezierLabelPoint(points as BezierPoints);

    edgeShape.setAttrs({
        data: {
            ...data,
            sx: newS.x,
            sy: newS.y,
            cx: hasCtrl ? (newC as { x: number; y: number }).x : null,
            cy: hasCtrl ? (newC as { x: number; y: number }).y : null,
            dx: hasCtrl ? (newD as { x: number; y: number }).x : null,
            dy: hasCtrl ? (newD as { x: number; y: number }).y : null,
            ex: newE.x,
            ey: newE.y,
            arrowPoints,
            labelX: label.x,
            labelY: label.y
        }
    });

    const farPos = isStart ? newE : newS;
    const farShape = nodeShapeMap.get(farId);
    if (farShape) {
        farShape.setAttrs({ x: farPos.x, y: -farPos.y });
    }

    const movedEdgeId = edgeShape.attrs?.id;
    edgeShapeMap.forEach((otherEdge: Konva.Shape, otherId: string) => {
        if (otherId === movedEdgeId) return;
        const od = otherEdge.attrs?.data;
        if (!od) return;
        const isOStart = od.snodeId === farId;
        const isOEnd = od.enodeId === farId;
        if (!isOStart && !isOEnd) return;
        const oSx = isOStart ? farPos.x : od.sx;
        const oSy = isOStart ? farPos.y : od.sy;
        const oEx = isOEnd ? farPos.x : od.ex;
        const oEy = isOEnd ? farPos.y : od.ey;
        const oCx0 = od.cx ?? null;
        const oCy0 = od.cy ?? null;
        const oDx0 = od.dx ?? null;
        const oDy0 = od.dy ?? null;
        const oHasCtrl = oCx0 !== null && oCy0 !== null && oDx0 !== null && oDy0 !== null;
        /**
         * 远端节点平移向量 Δ（地图坐标）：把"贴近移动端"的那一侧控制点同步平移，
         * 这样靠近 farId 一侧的切线方向得以保留，曲线不会被撕裂；
         * 另一端锚定在不动的节点上，所以它的控制点保持原位。
         */
        const dxT = isOStart ? farPos.x - od.sx : farPos.x - od.ex;
        const dyT = isOStart ? farPos.y - od.sy : farPos.y - od.ey;
        let newOCx: number | null = oCx0;
        let newOCy: number | null = oCy0;
        let newODx: number | null = oDx0;
        let newODy: number | null = oDy0;
        if (oHasCtrl) {
            if (isOStart) {
                newOCx = (oCx0 as number) + dxT;
                newOCy = (oCy0 as number) + dyT;
            } else {
                newODx = (oDx0 as number) + dxT;
                newODy = (oDy0 as number) + dyT;
            }
        }
        const oPoints = !oHasCtrl
            ? ([oSx, -oSy, oEx, -oEy] as LinePoint)
            : ([
                oSx, -oSy,
                newOCx as number, -(newOCy as number),
                newODx as number, -(newODy as number),
                oEx, -oEy
            ] as BezierPoints);
        const oArrow = !oHasCtrl
            ? computeLineArrowPoints(oPoints as LinePoint)
            : computeCubicArrowPoints(oPoints as BezierPoints);
        const oLabel = !oHasCtrl
            ? computeLinePoint(oPoints as LinePoint)
            : computeBezierLabelPoint(oPoints as BezierPoints);
        otherEdge.setAttrs({
            data: {
                ...od,
                sx: oSx,
                sy: oSy,
                cx: oHasCtrl ? newOCx : null,
                cy: oHasCtrl ? newOCy : null,
                dx: oHasCtrl ? newODx : null,
                dy: oHasCtrl ? newODy : null,
                ex: oEx,
                ey: oEy,
                arrowPoints: oArrow,
                labelX: oLabel.x,
                labelY: oLabel.y
            }
        });
    });
};

/**
 * @description 框选对齐完成后，把选区内"接近 90°（默认 ±5°）"的相邻 edge 夹角自动吸附到 90°
 *
 * 算法（迭代式，单次最多 SNAP_MAX_ITER 轮，避免连锁）：
 * 1. 从 stage 拉一份当前几何，跑 buildAngleMarks
 * 2. 找第一个满足全部条件的角作为目标：
 *    - 角所在节点在 shapes 选区
 *    - 角的两条 edge 恰好一条远端在选区内、另一条在选区外
 *      （对齐刚把选区内节点精确放置到目标位置，吸附不得再移动它们，
 *       只允许旋转"远端在选区外"的那条边，掰正代价由选区外节点承担）
 *    - 1e-3° < |degree - 90°| <= toleranceDeg
 * 3. 把目标角中"远端在选区外"的那条 edge 绕节点 N 旋转，使夹角恰为 90°
 * 4. 旋转 → 远端节点跟着移动 → 与远端节点相连的其它边也跟着同步
 * 5. 没有候选时退出。整个过程结束后留给 Konva 自然 redraw（与 alignSelectXxx 行为一致）
 */
export const snapNearRightAngles = (
    shapes: Konva.Shape[],
    toleranceDeg: number = NEAR_RIGHT_ANGLE_TOLERANCE_DEG
): void => {
    if (!shapes?.length) return;
    const stage = shapes[0]?.getStage();
    if (!stage) return;
    const selectedNodeIds = new Set<string>();
    shapes.forEach((s: Konva.Shape) => {
        const id = s.attrs?.id;
        if (typeof id !== "string" || !id) return;
        if (s.attrs?.enableSelect === "node") selectedNodeIds.add(id);
    });
    if (selectedNodeIds.size < 2) return;

    for (let iter = 0; iter < SNAP_MAX_ITER; iter++) {
        const { nodes, edges, nodeShapeMap, edgeShapeMap } = collectStageGeometry(stage);
        const marks = buildAngleMarks(nodes, edges);
        const edgeMap = new Map<string, AngleEdgeLike>();
        edges.forEach(e => edgeMap.set(e.id, e));

        let target: {
            edgeId: string;
            pivotNodeId: string;
            pivotX: number;
            pivotY: number;
            delta: number;
        } | null = null;

        for (const mark of marks) {
            if (!selectedNodeIds.has(mark.nodeId)) continue;
            const diff = Math.abs(mark.degree - 90);
            if (diff <= SNAP_EPS_DEG) continue;
            if (diff > toleranceDeg) continue;
            const eA = edgeMap.get(mark.edgeIdA);
            const eB = edgeMap.get(mark.edgeIdB);
            if (!eA || !eB) continue;
            const farA = eA.snodeId === mark.nodeId ? eA.enodeId : eA.snodeId;
            const farB = eB.snodeId === mark.nodeId ? eB.enodeId : eB.snodeId;
            const node = nodes.find(n => n.id === mark.nodeId);
            if (!node) continue;
            /**
             * 选择哪条边来旋转：只允许旋转"远端在选区外"的那条边。
             *
             * 背景（bug 修复）：对齐命令刚把选区内全部节点精确放置到目标位置
             * （同一视觉轴线 / 等距目标步长），这是用户显式命令的结果，必须被尊重。
             * 旧策略"优先旋转远端在选区内的边"会把刚对齐好的节点掰离对齐线，
             * 典型现象：左对齐后最左侧基准节点的坐标出现 0.00x 量级漂移。
             *
             * 新策略：掰正 90° 的代价改由选区外的节点承担——
             * - farB 在选区外且 farA 在选区内：旋转 edgeB，delta = π/2 - sweep
             * - farA 在选区外且 farB 在选区内：旋转 edgeA，delta = sweep - π/2
             * - 两条远端都在选区内：跳过（旋转任何一条都会破坏对齐结果）
             * - 两条远端都在选区外：跳过（该角与本轮对齐无关，不擅自改动选区外结构）
             *（pivot = mark.nodeId 已经在选区，旋转只影响远端节点，pivot 不动）
             */
            let edgeIdToRotate: string;
            let delta: number;
            if (!selectedNodeIds.has(farB) && selectedNodeIds.has(farA)) {
                edgeIdToRotate = mark.edgeIdB;
                delta = Math.PI / 2 - mark.sweep;
            } else if (!selectedNodeIds.has(farA) && selectedNodeIds.has(farB)) {
                edgeIdToRotate = mark.edgeIdA;
                delta = mark.sweep - Math.PI / 2;
            } else {
                continue;
            }
            target = {
                edgeId: edgeIdToRotate,
                pivotNodeId: mark.nodeId,
                pivotX: node.x,
                pivotY: node.y,
                delta
            };
            break;
        }
        if (!target) break;
        const eshape = edgeShapeMap.get(target.edgeId);
        if (!eshape) break;
        rotateEdgeAroundPivot(
            eshape,
            target.pivotNodeId,
            target.pivotX,
            target.pivotY,
            target.delta,
            nodeShapeMap,
            edgeShapeMap
        );
    }
};

/**
 * @description 拖动节点时投影出的最小偏差吸附位置（地图坐标）
 * 给定被拖动节点 N 的"当前鼠标位置"`(currentMapX, currentMapY)`，遍历 N 所连每条
 * 直线 edge 的"对端节点 M"，对每个 M 上的其它 edge e2 做候选评估：
 *   - 当前 e 在 M 处的 leave angle β = atan2(currentY - M.y, currentX - M.x)
 *   - α = e2 在 M 处的 leave angle（用 computeNodeLeaveAngle，含贝塞尔切线）
 *   - signed = ((β - α + π) mod 2π) - π，∈ (-π, π]
 *   - diff = |(|signed| × 180/π) - 90|
 *   - 0 < diff ≤ NEAR_RIGHT_ANGLE_TOLERANCE_DEG 即收为候选，目标方向为
 *     α + (π/2) × sign(signed)，与 β 同侧避免镜像翻边
 * 候选按 diff 升序，把鼠标位置投影到目标 90° 射线，t ≤ 0 视为反方向跳过。
 * 全部失败返回 null（保持鼠标自由跟手）。
 *
 * 贝塞尔 edge：M 处 leave angle 由控制点 cx,cy/dx,dy 决定，与 N 位置无关，
 * 拖动 N 不可能让它变化，因此被排除在候选 edge 外（避免假吸附），但 M 上的"其它 edge e2"
 * 是否贝塞尔不影响判定，仍参与 α 计算。
 */
export const computeRightAngleDragSnap = (
    stage: Konva.Stage,
    draggedShape: Konva.Shape,
    currentMapX: number,
    currentMapY: number
): { x: number; y: number } | null => {
    const draggedId = draggedShape?.attrs?.id;
    if (typeof draggedId !== "string" || !draggedId) return null;
    const { nodes, edges } = collectStageGeometry(stage);
    if (!nodes.length || !edges.length) return null;
    const nodeMap = new Map<string, AngleNodeLike>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const incident = edges.filter(e => e.snodeId === draggedId || e.enodeId === draggedId);
    if (!incident.length) return null;

    const PROJECT_EPS = 1e-6;
    interface Candidate {
        mx: number;
        my: number;
        targetDir: number;
        diff: number;
    }
    const candidates: Candidate[] = [];

    incident.forEach(e => {
        const isStraight = e.cx === null && e.cy === null && e.dx === null && e.dy === null;
        if (!isStraight) return;
        const otherId = e.snodeId === draggedId ? e.enodeId : e.snodeId;
        const m = nodeMap.get(otherId);
        if (!m) return;
        const beta = Math.atan2(currentMapY - m.y, currentMapX - m.x);
        edges.forEach(other => {
            if (other.id === e.id) return;
            if (other.snodeId !== otherId && other.enodeId !== otherId) return;
            const alpha = computeNodeLeaveAngle(other, otherId);
            if (alpha === null || !Number.isFinite(alpha)) return;
            const signed = ((beta - alpha + Math.PI) % TAU + TAU) % TAU - Math.PI;
            const interiorDeg = Math.abs(signed) * 180 / Math.PI;
            const diff = Math.abs(interiorDeg - 90);
            if (diff <= SNAP_EPS_DEG) return;
            if (diff > NEAR_RIGHT_ANGLE_TOLERANCE_DEG) return;
            const sign = signed >= 0 ? 1 : -1;
            const targetDir = alpha + sign * Math.PI / 2;
            candidates.push({ mx: m.x, my: m.y, targetDir, diff });
        });
    });

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.diff - b.diff);
    for (const c of candidates) {
        const cosT = Math.cos(c.targetDir);
        const sinT = Math.sin(c.targetDir);
        const t = (currentMapX - c.mx) * cosT + (currentMapY - c.my) * sinT;
        if (t <= PROJECT_EPS) continue;
        return { x: c.mx + t * cosT, y: c.my + t * sinT };
    }
    return null;
};

/**
 * @description 拖动贝塞尔曲线 A/B 控制点时的近 90° 自动吸附（地图坐标）
 *
 * 由 computeNodeLeaveAngle 的几何定义：
 *   - 起点 S 处 leave angle = atan2(cy - sy, cx - sx) → 仅由 A(cx,cy) 决定
 *   - 终点 E 处 leave angle = atan2(dy - ey, dx - ex) → 仅由 B(dx,dy) 决定
 * 因此 A/B 各自只控制"自身一端"的 leave 方向，两个控制点方向不一致这一点
 * 自然分解为两个独立的"单 pivot 吸附"问题：
 *   - 拖 A：pivot = S，候选点 = A 的当前位置，参考 α = S 上其它 edge 的 leave 角
 *   - 拖 B：pivot = E，候选点 = B 的当前位置，参考 α = E 上其它 edge 的 leave 角
 *
 * 算法与 computeRightAngleDragSnap 一致：
 *   β = atan2(curY - Py, curX - Px)
 *   signed = ((β - α + π) mod 2π) - π
 *   diff = | |signed|·180/π - 90 |
 *   命中容差则把候选点投影到目标 90° 射线 (P + t·targetDir)，t ≤ 0 视为反向跳过
 *
 * 与节点拖拽不同：A/B 移动只改 cx/cy 或 dx/dy，端点节点不动、与端点相连的其它 edge
 * 几何也保持不变，故这里只返回坐标，不需要 rotateEdgeAroundPivot 之类的级联同步。
 *
 * @param stage         konva stage
 * @param edgeShape     正在被编辑的贝塞尔 edge
 * @param controlKind   "A" → pivot 为起点 S；"B" → pivot 为终点 E
 * @param currentMapX   控制点拖拽的当前位置 x（地图坐标）
 * @param currentMapY   控制点拖拽的当前位置 y（地图坐标）
 * @param toleranceDeg  近 90° 容差，默认 NEAR_RIGHT_ANGLE_TOLERANCE_DEG
 * @returns 吸附后的地图坐标，或 null（没有合适候选时保持自由跟手）
 */
export const computeBezierControlPointSnap = (
    stage: Konva.Stage,
    edgeShape: Konva.Shape,
    controlKind: "A" | "B",
    currentMapX: number,
    currentMapY: number,
    toleranceDeg: number = NEAR_RIGHT_ANGLE_TOLERANCE_DEG
): { x: number; y: number } | null => {
    const selfId = edgeShape?.attrs?.id;
    const data = edgeShape?.attrs?.data;
    if (typeof selfId !== "string" || !selfId || !data) return null;
    const { sx, sy, ex, ey, snodeId, enodeId } = data;
    const pivotNodeId: string = controlKind === "A" ? snodeId : enodeId;
    const pivotX: number = controlKind === "A" ? sx : ex;
    const pivotY: number = controlKind === "A" ? sy : ey;
    if (typeof pivotNodeId !== "string" || !pivotNodeId) return null;
    if (!Number.isFinite(pivotX) || !Number.isFinite(pivotY)) return null;

    const { edges } = collectStageGeometry(stage);
    if (!edges.length) return null;

    const PROJECT_EPS = 1e-6;
    interface Candidate {
        targetDir: number;
        diff: number;
    }
    const candidates: Candidate[] = [];

    const beta = Math.atan2(currentMapY - pivotY, currentMapX - pivotX);
    edges.forEach(other => {
        if (other.id === selfId) return;
        if (other.snodeId !== pivotNodeId && other.enodeId !== pivotNodeId) return;
        const alpha = computeNodeLeaveAngle(other, pivotNodeId);
        if (alpha === null || !Number.isFinite(alpha)) return;
        const signed = ((beta - alpha + Math.PI) % TAU + TAU) % TAU - Math.PI;
        const interiorDeg = Math.abs(signed) * 180 / Math.PI;
        const diff = Math.abs(interiorDeg - 90);
        if (diff <= SNAP_EPS_DEG) return;
        if (diff > toleranceDeg) return;
        const sign = signed >= 0 ? 1 : -1;
        const targetDir = alpha + sign * Math.PI / 2;
        candidates.push({ targetDir, diff });
    });

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.diff - b.diff);
    for (const c of candidates) {
        const cosT = Math.cos(c.targetDir);
        const sinT = Math.sin(c.targetDir);
        const t = (currentMapX - pivotX) * cosT + (currentMapY - pivotY) * sinT;
        if (t <= PROJECT_EPS) continue;
        return { x: pivotX + t * cosT, y: pivotY + t * sinT };
    }
    return null;
};
