/**
 * @description 框选同向路径核心算法（纯函数）。
 *              selectSameDirectionEdges：拓扑同向，以用户左键显式选中的基准边为起点，
 *              沿 snode→enode 行驶方向在「命中集合 ∪ {基准}」内做双向可达遍历（BFS）：
 *              下游顺流接续 + 上游反向回溯，返回基准簇（含基准自身）。
 *              遍历只看 snodeId/enodeId，与几何形状无关（直线/曲线统一处理）。
 *              全局折返守卫：维护已选中边的有向节点对集合，候选边的反向节点对已选中则跳过，
 *              使 A↔B 这类箭头相反的成对边不被同时选中（仍保留 ≥3 边的有向环）。
 *
 *              selectSameAngleEdges：方向同向（角度完全一致），以基准边的弦方向为基准，
 *              保留命中集合里弦方向与基准完全一致的边（不做连通性要求）。
 *              覆盖"平行车道/多楼层同向通道"这类拓扑不连但方向一致的边（v1 §10 的 U 形汇聚段回归）。
 *
 *              v2（SPEC_brush_same_direction_contextmenu §4.5 / §6.8）改动：
 *              - 基准与命中集合分离传入（v1 基准 = hitEdges[0] 内取）；
 *              - v1 的几何算法（selectSameVectorEdges，夹角 ≤ 90°）按决策移除；
 *                v3（SPEC_brush_same_direction_split）以"角度完全一致"的 selectSameAngleEdges 回归，
 *                作为独立的「框选方向同向路径」菜单，与拓扑模式并列。
 *
 *              纯函数说明：
 *              - 拓扑只读取 edge.attrs.data.snodeId / enodeId 与 edge.id()；
 *              - 方向同向额外读取 edge.attrs.data.sx/sy/ex/ey（不读控制点 cx/cy/dx/dy）；
 *              - 不依赖 stage、不做坐标变换（方向比较在数据坐标系下做，与 stage 缩放/旋转无关）；
 *              - 无副作用，可独立复用与单测。
 *              关联规格：docs/SPEC_brush_same_direction_contextmenu.md（§4.5 / §6.8）、
 *                        docs/SPEC_brush_same_direction_split.md（§3）
 */
import type Konva from "konva";

/**
 * 同向筛选主函数（v2：基准与命中集合分离传入）。
 * @param baseEdge 用户左键显式选中的基准边（可能不在框选区域内，须并入遍历图才能从它出发接续）
 * @param hitEdges 本次框选命中的边 Shape 数组（已过滤可见性）
 * @returns        基准簇：基准边双向可达集合（含基准自身），基准放数组首位、其余按命中顺序
 */
export function selectSameDirectionEdges(
    baseEdge: Konva.Shape,
    hitEdges: Konva.Shape[]
): Konva.Shape[] {
    // 基准缺席（不应发生——调用方已做失效校验）防御性返回空
    if (!baseEdge) return [];

    // 1. 遍历图 = 命中集合 ∪ {基准}（基准可能不在框选区域内，必须并入才能从它出发接续）；
    //    基准被框进区域时按 id() 去重，保证索引与选中集合不重复计入
    const baseId = baseEdge.id();
    const traversalEdges = [baseEdge, ...hitEdges.filter(edge => edge.id() !== baseId)];

    // 2. 在遍历图内建立双向索引：
    //    - outgoingBySnode: snodeId → [edges] 出边索引，下游顺流接续用
    //    - incomingByEnode: enodeId → [edges] 入边索引，上游反向回溯用
    //    双向遍历能解决「基准落在中段导致上游同向段被整段丢弃」的问题（v1 §4.3 修正）
    const outgoingBySnode = new Map<string, Konva.Shape[]>();
    const incomingByEnode = new Map<string, Konva.Shape[]>();
    for (const edge of traversalEdges) {
        const s = edge.attrs.data?.snodeId || "";
        const e = edge.attrs.data?.enodeId || "";
        if (!outgoingBySnode.has(s)) outgoingBySnode.set(s, []);
        outgoingBySnode.get(s)!.push(edge);
        if (!incomingByEnode.has(e)) incomingByEnode.set(e, []);
        incomingByEnode.get(e)!.push(edge);
    }

    // 3. 双向 BFS：下游沿 snode→enode 顺流接续，上游沿 enode→snode 反向回溯。
    //    用 Shape 的 Konva id() 做去重 key（edge Shape id === edge.id，见 createEdgeShapeConfig）。
    //
    //    全局折返守卫（selectedPairs）：维护已选中边的有向节点对集合 "snodeId->enodeId"，
    //    候选边入选前检查其反向节点对 "enodeId->snodeId" 是否已在集合中——若是则跳过。
    //    这保证同一对节点 {X, Y} 的两个方向（X→Y 与 Y→X）永远不可能同时进入选中集，
    //    使 A↔B 这类箭头相反的成对边只保留基准方向（v1 规格 §4.7）。
    //
    //    相比旧版「局部守卫」（只检查候选是否为当前边的直接反向边），全局守卫额外堵死了
    //    「经第三条边绕行」的泄漏路径——当多对反向边共享同一个枢纽节点时
    //    （如 X↔Y、Y↔Z、Z↔X 三对双向边交于 Y），旧守卫只挡住紧邻的一步折返，
    //    BFS 可经第三对边绕回把所有方向的边都拉进来；全局守卫从选中集合维度切断此路径。
    //    ≥3 边的有向环（矩形环、三角环）相邻边节点对不重复，不受影响，仍可整圈选中。
    //
    //    历史：原方案只走下游不回溯上游，导致「双向段夹单向中段」拓扑（如 A↔B→C→D↔E）
    //    里基准落中段时上游同向段整段丢失——这是双向遍历的修复动因（见 v1 规格 §4.3 修正记录）。
    const selected = new Set<string>([baseId]);
    // 已选中边的有向节点对集合，用于全局折返守卫
    const selectedPairs = new Set<string>();
    const baseSnode = baseEdge.attrs.data?.snodeId || "";
    const baseEnode = baseEdge.attrs.data?.enodeId || "";
    selectedPairs.add(`${baseSnode}->${baseEnode}`);

    const queue: Konva.Shape[] = [baseEdge];
    while (queue.length) {
        const cur = queue.shift()!;
        const curSnode = cur.attrs.data?.snodeId || "";
        const curEnode = cur.attrs.data?.enodeId || "";

        // 下游：当前边的终点作为下一批边的起点，找遍历图内所有能接上的出边
        const nexts = outgoingBySnode.get(curEnode) || [];
        for (const next of nexts) {
            const nSnode = next.attrs.data?.snodeId || "";
            const nEnode = next.attrs.data?.enodeId || "";
            // 全局折返守卫：候选边的反向节点对已选中 → 跳过（防止同节点对两方向共存）
            if (selectedPairs.has(`${nEnode}->${nSnode}`)) continue;
            if (!selected.has(next.id())) {
                selected.add(next.id());
                selectedPairs.add(`${nSnode}->${nEnode}`);
                queue.push(next);
            }
        }

        // 上游：找遍历图内所有流向当前边起点的入边，反向接续到基准上游
        const prevs = incomingByEnode.get(curSnode) || [];
        for (const prev of prevs) {
            const pSnode = prev.attrs.data?.snodeId || "";
            const pEnode = prev.attrs.data?.enodeId || "";
            // 全局折返守卫：候选边的反向节点对已选中 → 跳过（防止同节点对两方向共存）
            if (selectedPairs.has(`${pEnode}->${pSnode}`)) continue;
            if (!selected.has(prev.id())) {
                selected.add(prev.id());
                selectedPairs.add(`${pSnode}->${pEnode}`);
                queue.push(prev);
            }
        }
    }

    // 4. 返回基准簇：基准放数组首位（v2 §4.4 约定确定性顺序），
    //    其余按命中顺序过滤（保持与 findShapesInRect 产出序一致）
    return [baseEdge, ...hitEdges.filter(edge => edge.id() !== baseId && selected.has(edge.id()))];
}

/**
 * 方向同向筛选（纯函数，SPEC_brush_same_direction_split §3）。
 * 以基准边的「弦方向」为基准，保留命中集合里弦方向与基准**完全一致**（角度差为 0）的边，
 * 不做连通性要求——平行车道、多楼层同向通道这类拓扑不连的边也能被选中。
 *
 * 设计要点：
 * - 弦方向 = snode → enode 的直线向量，不读控制点 cx/cy/dx/dy，
 *   对贝塞尔/直线统一处理（与 v1 selectSameVectorEdges 同一口径）。
 * - 数据 y 与画布 y 反向（见 BrushSelect：`worldToScreen(sx, -sy, stage)`），
 *   视觉向量取 dy = sy - ey（不是 ey - sy）、dx = ex - sx。
 *   相对比较下取哪一侧只影响整体符号，但沿用 v1 口径保持注释一致。
 * - "完全一致"判定用归一化向量的叉积/点积，避免 atan2/acos 的数值噪声：
 *   |cross| < EPS 且 dot > 0 ⟺ 方向角差为 0（dot > 0 排除反向共线）。
 *   EPS = 1e-6（sin 值无量纲，约 0.00006°），用户视为完全一致，仅容忍浮点噪声。
 *   与 v1 的"夹角 ≤ 90°"（点积 > 0）不同：这里反向（dot < 0）与斜向（|cross| 大）都排除。
 *
 * 边界：
 * - 基准零长度边（sx==ex 且 sy==ey）→ 弦方向无法定义，返回仅基准
 *   （"完全一致"语义下没有可匹配的基准方向，后续走「未找到方向同向路径」提示）。
 * - 候选零长度边 → 弦方向无法定义，排除。
 *
 * @param baseEdge 用户左键显式选中的基准边
 * @param hitEdges 本次框选命中的边 Shape 数组（已过滤可见性）
 * @returns        [基准, ...弦方向与基准完全一致的命中边]，基准放首位、其余按命中顺序
 */
export function selectSameAngleEdges(
    baseEdge: Konva.Shape,
    hitEdges: Konva.Shape[]
): Konva.Shape[] {
    // 基准缺席（不应发生——调用方已做失效校验）防御性返回空
    if (!baseEdge) return [];

    const baseData = baseEdge.attrs?.data || {};
    // 数据 y 与画布 y 反向：视觉向量 dy = sy - ey
    const bDx = (baseData.ex ?? 0) - (baseData.sx ?? 0);
    const bDy = (baseData.sy ?? 0) - (baseData.ey ?? 0);
    // 基准零长度边：弦方向无法定义 → 仅返回基准自身
    if (bDx === 0 && bDy === 0) return [baseEdge];
    // 归一化基准向量：后续 cross/dot 都是无量纲的 sin/cos，与边长无关
    const bLen = Math.hypot(bDx, bDy);
    const bUx = bDx / bLen;
    const bUy = bDy / bLen;
    // sin 方向角差阈值（约 1e-6 rad）：仅容忍浮点噪声，用户感知为"角度完全一致"
    const EPS = 1e-6;

    const baseId = baseEdge.id();
    const matched = hitEdges.filter(edge => {
        if (edge.id() === baseId) return false;
        const d = edge.attrs?.data || {};
        const dx = (d.ex ?? 0) - (d.sx ?? 0);
        const dy = (d.sy ?? 0) - (d.ey ?? 0); // 数据 y 反向
        // 候选零长度边：弦方向无法定义，排除
        if (dx === 0 && dy === 0) return false;
        const len = Math.hypot(dx, dy);
        // |cross| = sin 方向角差（点积判同向：>0 排除反向共线）
        const cross = bUx * (dy / len) - bUy * (dx / len);
        const dot = bUx * (dx / len) + bUy * (dy / len);
        return Math.abs(cross) < EPS && dot > 0;
    });

    // 基准放首位（与拓扑模式产出约定一致），其余按命中顺序
    return [baseEdge, ...matched];
}
