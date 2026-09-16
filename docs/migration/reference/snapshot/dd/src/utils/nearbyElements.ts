/**
 * @description 「选择附近元素」配套纯函数：候选搜索 + 连通分量 BFS
 * @date 2026-8-3
 *
 * 两阶段候选搜索（AABB 粗筛 + 采样精筛，SPEC §3.4-§3.6）与
 * 无向 BFS 连通分量（SPEC §3.8）均为纯函数，便于复用与单测（§5.8）：
 * - 不修改 selectShapes、不调 setXxx；
 * - 所有坐标变换通过 worldToScreen（含 rotation/scale）；
 * - BFS 索引在函数内一次性建立，无全局状态。
 */
import type Konva from "konva";
import { worldToScreen } from "@/utils/bindStage";
import { bezierSamplePoints } from "@/utils/graph";
import type { NearbyCandidate } from "@/types/MapNestModify";

/** 默认搜索半径（屏幕像素，SPEC §3.4） */
const DEFAULT_RADIUS = 30;

/**
 * 点 P 到线段 AB 的最短距离（屏幕坐标系）。
 * 投影参数 t 钳制到 [0,1]，AB 退化（lenSq=0）时返回 PA 距离。
 */
function pointToSegmentDistance(
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number
): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    // AB 退化为点：直接返回 PA 距离
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // 投影钳制到 [0,1]
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
}

/**
 * 计算鼠标到一条路径的屏幕像素距离（直线 / 贝塞尔统一接口）。
 * 注意 edge 数据 y 与画布 y 反向（§2.8）：worldToScreen(sx, -sy, stage)。
 * BEZIER 控制点为 null 时退化为直线（防御性，§4 边界）。
 * 贝塞尔采样点已含 y 取反，worldToScreen 直接传 (p.x, p.y)，与 BrushSelect 同源。
 */
function edgeScreenDistance(
    shape: Konva.Shape,
    px: number, py: number,
    stage: Konva.Stage
): number {
    const d = shape.attrs.data || {};
    const { sx, sy, ex, ey, cx, cy, dx, dy } = d;
    // 直线 / 控制点缺失：用两端点
    if (cx == null || cy == null || dx == null || dy == null) {
        const a = worldToScreen(sx, -sy, stage);
        const b = worldToScreen(ex, -ey, stage);
        return pointToSegmentDistance(px, py, a.x, a.y, b.x, b.y);
    }
    // 贝塞尔：32 点采样（已含 y 取反）→ 逐段最短距离
    const worldPts = bezierSamplePoints(sx, sy, cx, cy, dx, dy, ex, ey, 32);
    let minDist = Infinity;
    for (let i = 0; i < worldPts.length - 1; i++) {
        const a = worldToScreen(worldPts[i].x, worldPts[i].y, stage);
        const b = worldToScreen(worldPts[i + 1].x, worldPts[i + 1].y, stage);
        const dist = pointToSegmentDistance(px, py, a.x, a.y, b.x, b.y);
        if (dist < minDist) minDist = dist;
    }
    return minDist;
}

/**
 * 候选搜索主函数（SPEC §5.4）。
 * 仅路径参与（节点不参与，SPEC §3.3），跳过已隐藏元素（SPEC §4 边界）。
 * 两阶段：AABB 粗筛（O(n)）→ 采样精筛（仅幸存者）。
 *
 * @param stage    Konva.Stage
 * @param pointerX 鼠标屏幕坐标 x（stage.getPointerPosition().x）
 * @param pointerY 鼠标屏幕坐标 y
 * @param radius   搜索半径（默认 30px）
 * @returns        按距离升序的候选列表（已过滤 > radius）
 */
export function findNearbyEdges(
    stage: Konva.Stage,
    pointerX: number,
    pointerY: number,
    radius: number = DEFAULT_RADIUS
): NearbyCandidate[] {
    // 仅路径（§3.3），跳过已隐藏元素（§4 边界）
    const allEdges = stage.find(
        (s: Konva.Shape) => s.attrs?.enableSelect === "edge" && s.isVisible()
    ) as Konva.Shape[];
    if (!allEdges.length) return [];

    // AABB 粗筛：以鼠标为圆心 radius 的外接正方形
    const minX = pointerX - radius;
    const maxX = pointerX + radius;
    const minY = pointerY - radius;
    const maxY = pointerY + radius;

    const survivors: Konva.Shape[] = [];
    for (const edge of allEdges) {
        const d = edge.attrs.data || {};
        const { sx, sy, ex, ey, cx, cy, dx, dy } = d;
        // 计算边的屏幕 AABB：端点 + 控制点（若 BEZIER）转屏幕后取 min/max
        const pts = [worldToScreen(sx, -sy, stage), worldToScreen(ex, -ey, stage)];
        if (cx != null && cy != null) pts.push(worldToScreen(cx, -cy, stage));
        if (dx != null && dy != null) pts.push(worldToScreen(dx, -dy, stage));
        let bbMinX = Infinity, bbMaxX = -Infinity, bbMinY = Infinity, bbMaxY = -Infinity;
        for (const p of pts) {
            if (p.x < bbMinX) bbMinX = p.x;
            if (p.x > bbMaxX) bbMaxX = p.x;
            if (p.y < bbMinY) bbMinY = p.y;
            if (p.y > bbMaxY) bbMaxY = p.y;
        }
        // AABB 与外接正方形不相交 → 剔除
        if (bbMaxX < minX || bbMinX > maxX || bbMaxY < minY || bbMinY > maxY) continue;
        survivors.push(edge);
    }

    // 精筛：对幸存者算精确距离，过滤 > radius
    const candidates: NearbyCandidate[] = [];
    for (const edge of survivors) {
        const dist = edgeScreenDistance(edge, pointerX, pointerY, stage);
        if (dist <= radius) {
            candidates.push({ shape: edge, distance: dist });
        }
    }
    // 距离升序
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates;
}

/**
 * 连通分量 BFS 结果（SPEC §5.5）。
 */
export interface ConnectedComponent {
    nodes: Konva.Shape[];
    edges: Konva.Shape[];
    /** 是否因超 limit 中止 */
    truncated: boolean;
    /** 中止前的计数（truncated=true 时为 limit+1） */
    count: number;
}

/**
 * 从选中路径出发，无向 BFS 收集整个连通分量的节点与路径（SPEC §5.5）。
 *
 * 与 SPEC_brush_same_direction 的有向同向遍历不同：本功能是纯连通分量，
 * 正反向边都纳入，不带折返守卫。
 *
 * 支持计数上限：BFS 过程中超 limit 立即中止并返回 { truncated: true }，
 * 供调用方弹确认框（SPEC §3.9）。
 *
 * 隐藏路径不参与连通分量（§3.7）：避免批量改静默修改不可见路径，
 * 与候选搜索 / BrushSelect 框选同口径。
 *
 * 被点选路径始终纳入 edges（防御数据缺端点 id，§4 边界：data 缺 snodeId/enodeId
 * 时 BFS 无起点，至少选中该路径本身，避免 applyConnectedSelection 静默清空现有选中）。
 *
 * @param selectedEdge  起点：用户从候选列表点选的路径 Shape
 * @param stage         Konva.Stage（用于 find 全部 edge/node Shape）
 * @param limit         计数上限（默认 500）；超限中止
 * @returns             { nodes, edges, truncated, count }
 */
export function collectConnectedComponent(
    selectedEdge: Konva.Shape,
    stage: Konva.Stage,
    limit: number = 500
): ConnectedComponent {
    // 预收集全部 edge/node Shape，建 id→Shape 索引（O(n) 一次，避免 BFS 内反复 findOne）
    // 隐藏路径不参与连通分量（§3.7）
    const allEdges = stage.find(
        (s: Konva.Shape) => s.attrs?.enableSelect === "edge" && s.isVisible()
    ) as Konva.Shape[];
    const allNodes = stage.find(
        (s: Konva.Shape) => s.attrs?.enableSelect === "node"
    ) as Konva.Shape[];

    // nodeId → 节点 Shape
    const nodeById = new Map<string, Konva.Shape>();
    for (const n of allNodes) {
        const id = n.attrs?.id;
        if (typeof id === "string") nodeById.set(id, n);
    }
    // nodeId → 关联路径（无向：snodeId / enodeId 都索引）
    const edgesByNode = new Map<string, Konva.Shape[]>();
    for (const e of allEdges) {
        const s = e.attrs?.data?.snodeId;
        const en = e.attrs?.data?.enodeId;
        if (typeof s === "string") {
            if (!edgesByNode.has(s)) edgesByNode.set(s, []);
            edgesByNode.get(s)!.push(e);
        }
        if (typeof en === "string") {
            if (!edgesByNode.has(en)) edgesByNode.set(en, []);
            edgesByNode.get(en)!.push(e);
        }
    }

    const selectedNodeId = selectedEdge.attrs?.data?.snodeId as string | undefined;
    const selectedEnodeId = selectedEdge.attrs?.data?.enodeId as string | undefined;
    const startNodeIds = [selectedNodeId, selectedEnodeId].filter((x): x is string => !!x);

    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    const resultNodes: Konva.Shape[] = [];
    const resultEdges: Konva.Shape[] = [];
    let count = 0;
    let truncated = false;

    // 防御：被点选路径始终纳入结果（§4 边界）
    const selectedEdgeId = selectedEdge.attrs?.id;
    if (typeof selectedEdgeId === "string") {
        visitedEdges.add(selectedEdgeId);
        resultEdges.push(selectedEdge);
        count++;
    }

    const queue: string[] = [...startNodeIds];
    for (const id of startNodeIds) visitedNodes.add(id);

    while (queue.length) {
        const nodeId = queue.shift()!;
        const nodeShape = nodeById.get(nodeId);
        if (nodeShape) {
            resultNodes.push(nodeShape);
            count++;
            if (count > limit) { truncated = true; break; }
        }
        // 枚举该节点的所有关联路径（无向）
        const relEdges = edgesByNode.get(nodeId) || [];
        for (const e of relEdges) {
            const eid = e.attrs?.id;
            if (typeof eid !== "string" || visitedEdges.has(eid)) continue;
            visitedEdges.add(eid);
            resultEdges.push(e);
            count++;
            if (count > limit) { truncated = true; break; }
            // 把路径另一端节点入队
            const s = e.attrs?.data?.snodeId as string | undefined;
            const en = e.attrs?.data?.enodeId as string | undefined;
            const other = s === nodeId ? en : s;
            if (other && !visitedNodes.has(other)) {
                visitedNodes.add(other);
                queue.push(other);
            }
        }
        if (truncated) break;
    }

    return { nodes: resultNodes, edges: resultEdges, truncated, count };
}

/**
 * 把候选路径按所属「连通分量」聚拢分组。
 *
 * 背景：候选菜单原本按"到鼠标距离"升序平铺。但典型重叠场景（SPEC §1.2）下，
 * 附近半径内常含多个互不连通的子图（如 3 组叠合节点构成 3 个独立分量），
 * 平铺时同属一个分量的路径会被其他分量的路径穿插，用户难以判断
 * 「点这条会一起选中哪些」。按连通分量聚拢后，组内即"一起被选中"的那批。
 *
 * 与 collectConnectedComponent 同口径：仅基于可见路径（SPEC §3.7）、
 * 无向连通（正反向边都纳入）、不区分方向。
 *
 * 为什么用并查集而不是对每个候选项各跑一次 collectConnectedComponent：
 * 候选最多 30 条，逐个 BFS 会做 30 次全图扫描（O(30 × (V+E))）；
 * 并查集只需一次全图扫描（O(V + E × α(V))），再把候选按 root 归类。
 *
 * @param stage      Konva.Stage（用于 find 全部 edge Shape 建并查集）
 * @param candidates 候选列表（已按 distance 升序）
 * @returns          分组结果：每个子数组是同一连通分量内的候选，
 *                   组内按 distance 升序；组间按"组内最小 distance"升序。
 *                   候选为空返回 []。
 */
export function groupCandidatesByComponent(
    stage: Konva.Stage,
    candidates: NearbyCandidate[]
): NearbyCandidate[][] {
    if (!candidates.length) return [];

    // 仅可见路径参与连通关系（与 collectConnectedComponent 同口径，§3.7）
    const allEdges = stage.find(
        (s: Konva.Shape) => s.attrs?.enableSelect === "edge" && s.isVisible()
    ) as Konva.Shape[];

    // —— 并查集：按 nodeId union，连通节点最终落到同一 root ——
    const parent = new Map<string, string>();
    const find = (x: string): string => {
        if (!parent.has(x)) parent.set(x, x);
        let root = x;
        while (parent.get(root) !== root) {
            root = parent.get(root)!;
        }
        // 路径压缩：把链上节点直接挂到 root，后续查询摊还 O(α)
        while (parent.get(x)! !== root) {
            const next = parent.get(x)!;
            parent.set(x, root);
            x = next;
        }
        return root;
    };
    const union = (a: string, b: string) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
    };

    for (const e of allEdges) {
        const s = e.attrs?.data?.snodeId;
        const en = e.attrs?.data?.enodeId;
        // 两端 id 都有效才 union；孤儿边（缺端点 id）不参与，其候选会落到下面的兜底分支
        if (typeof s === "string" && typeof en === "string") {
            union(s, en);
        }
    }

    // 按 root 把候选归组；缺端点 id 的候选用自身 shape id 兜底，独立成一组
    const groups = new Map<string, NearbyCandidate[]>();
    for (const c of candidates) {
        const s = c.shape.attrs?.data?.snodeId;
        const en = c.shape.attrs?.data?.enodeId;
        let root: string;
        if (typeof s === "string") root = find(s);
        else if (typeof en === "string") root = find(en);
        else root = (c.shape.attrs?.id as string | undefined) ?? `__orphan_${groups.size}`;

        if (!groups.has(root)) groups.set(root, []);
        groups.get(root)!.push(c);
    }

    // 组内按 distance 升序（候选入组前可能未在同组内有序，统一排一次）
    // 组间按"组内最小 distance"升序——因入参 candidates 已按 distance 升序，
    // 各组首项即该组最小 distance，直接比较组首即可
    const groupArr = Array.from(groups.values());
    groupArr.forEach(g => g.sort((a, b) => a.distance - b.distance));
    groupArr.sort((a, b) => a[0].distance - b[0].distance);
    return groupArr;
}
