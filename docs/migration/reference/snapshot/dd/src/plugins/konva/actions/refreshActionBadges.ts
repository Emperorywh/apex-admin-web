/**
 * @description 节点/路径动作角标 Layer 的命令式全量刷新（MapNestModify 专用）
 * @date 2026-6-28
 *
 * 与设备 refreshDeviceIcons 同源教训（D23）：MapNestModify 采用「React state 初始挂载 + 命令式运行时编辑」，
 * 拖动节点/控制点、修改 actions 属性都通过 shape.setAttrs 改 Konva attrs，不更新 React state。
 * 角标位置/数量若只在 React effect 快照一次，会与命令式编辑脱节
 * （拖动不跟随、改 actions 不立即增删/改色）。
 *
 * 本函数直接从 node/edge Shape 的实时 data 重建角标，作为运行时编辑点与
 * ActionBadgeLayer 初始挂载共用的统一刷新入口。
 *
 * 调用点（D23）：
 *   - ActionBadgeLayer 的 nodes/edges/isDark/visualScale effect（初始加载 / 地图切换 / 主题 / 缩放）
 *   - GraphStage.onStageDragMove（节点拖动，onNodeShapeDragMove 之后）
 *   - ControlPoints 两个控制点 DragMove（贝塞尔控制点拖动）
 *   - Actions 编辑面板写入 actions 后（修改动作后立即增删/改色角标）
 */
import Konva from "konva";
import type { ActionType } from "@/utils/typing";
import {
    resolveActionSummary,
    actionBadgeSceneFunc,
    actionBadgeHitFunc,
    ACTION_NODE_OFFSET,
    ACTION_EDGE_NORMAL_OFFSET,
    ACTION_EDGE_OFFSET_Y,
    stageToScreen,
} from "./index";
import type { ActionSeverity } from "./index";
import { computeEdgeTangentAngle } from "@/utils/math";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "../runtime/constants";

/**
 * hover 状态载荷：hover 角标时回传给 React 层渲染 ActionTooltip
 */
export interface ActionHoverPayload {
    /** 该元素的全部动作（tooltip 每动作一卡展示） */
    actions: ActionType[];
    /** 角标锚点屏幕坐标（tooltip 贴此定位，D11） */
    screenX: number;
    screenY: number;
}

/**
 * 命令式全量重建动作角标 Layer。
 *
 * 实现：
 *   1. 按 name 定位动作角标 Layer；
 *   2. 取 visualScale / isDark：优先 options 覆盖值，否则从 stage 自定义 attr 读取；
 *   3. 从 stage 实时读取当前选中的元素 id 集合以驱动角标联动高亮（D19）；
 *   4. 遍历所有 node/edge Shape 的实时 data，对 resolveActionSummary 命中的元素各重建一个角标 Shape，
 *      actions 被清空的元素自然不再创建（实现「取消动作后角标立即消失」）。
 *
 * 关于 options 覆盖参数（isDark/visualScale）：
 * React effect 子先于父执行，ActionBadgeLayer 的 isDark effect 早于 GraphStage 的 setAttr(isDark)，
 * 若总从 stage attr 读 isDark 主题切换瞬间会读到旧值。故 ActionBadgeLayer 调用时显式传入最新 prop 值；
 * 运行时编辑点（节点/控制点拖动、改 actions）调用时不传，此时主题与缩放均未变化，stage attr 即为稳定正确值。
 *
 * @param stage 当前 Konva.Stage
 * @param options 可选覆盖值；onActionHover 为 hover 回调，由 ActionBadgeLayer 传入驱动 React hover 状态
 */
export const refreshActionBadges = (
    stage: Konva.Stage,
    options?: {
        isDark?: boolean;
        visualScale?: number;
        onActionHover?: (payload: ActionHoverPayload | null) => void;
    }
) => {
    if (!stage) return;
    // 按 layer name 定位动作角标图层（Konva find 接受函数谓词，返回 Collection，取首个）
    const layer = (
        stage.find(
            (node: Konva.Node) =>
                node instanceof Konva.Layer && node.name() === MAP_NEST_LAYER_NAME.actions
        ) as unknown as Konva.Layer[]
    )[0];
    if (!layer) return;

    /** 视觉倍率与暗黑主题：优先 options 覆盖值，否则回退 stage 自定义 attr（与 refreshDeviceIcons 同口径） */
    const visualScale: number = options?.visualScale ?? (stage.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1);
    const isDark: boolean = options?.isDark ?? (stage.getAttr(MAP_NEST_STAGE_ATTR.isDark) ?? false);
    // onActionHover：优先 options 覆盖值，否则回退 layer 自定义 attr
    // （ActionBadgeLayer 初始挂载时 setAttr 写入，供 ControlPoints/Actions 等无回调访问权的编辑点复用）
    const onActionHover = options?.onActionHover ?? layer.getAttr("onActionHover");

    /**
     * 当前选中的元素 id 集合：直接从 stage 实时读取（state === "selected"），
     * 覆盖 node 与 edge，保证运行时编辑后刷新仍保留正确的选中联动高亮（D19）。
     */
    const selectedIds = new Set<string>();
    (
        stage.find(
            (shape: Konva.Shape) =>
                (shape.attrs?.enableSelect === "node" || shape.attrs?.enableSelect === "edge") &&
                shape.attrs?.state === "selected"
        ) as unknown as Konva.Shape[]
    ).forEach(shape => {
        const id = shape.id();
        if (id) selectedIds.add(id);
    });

    /** 销毁旧角标，准备全量重建 */
    layer.destroyChildren();

    const scale = visualScale;
    // 路径角标法线偏移：落在设备图标外侧（更远离路径），与设备图标保持距离（SPEC §3.4/D16）
    const normalOffset = ACTION_EDGE_NORMAL_OFFSET * scale;

    /**
     * 为一个元素创建角标 Shape 并绑定 hover 事件。
     * @param elementType "node" | "edge"
     * @param elementId 归属元素 id（选中联动用）
     * @param actions 该元素的动作数组（hover tooltip 展示 + resolveSummary 判定）
     * @param anchorX anchorY 角标最终锚点（canvas 坐标）
     * @param severity 最严重阻塞等级
     * @param count 动作总数
     */
    const addBadge = (
        elementType: "node" | "edge",
        elementId: string,
        actions: ActionType[],
        anchorX: number,
        anchorY: number,
        severity: ActionSeverity,
        count: number
    ) => {
        const badgeShape = new Konva.Shape({
            sceneFunc: actionBadgeSceneFunc,
            // 命中区域限定为圆形本体（D12），listening=true 仅供 hover
            hitFunc: actionBadgeHitFunc,
            listening: true,
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false,
            data: {
                elementType,
                elementId,
                count,
                severity,
                anchorX,
                anchorY,
                scale,
                isDark,
                isSelected: selectedIds.has(elementId),
            },
        });
        // hover 进入：算锚点屏幕坐标，回传 React 层渲染 ActionTooltip（D11，定位贴锚点不跟随鼠标）
        badgeShape.on("mouseenter", () => {
            const screen = stageToScreen(stage, anchorX, anchorY);
            onActionHover?.({ actions, screenX: screen.x, screenY: screen.y });
        });
        // hover 离开：隐藏 tooltip
        badgeShape.on("mouseleave", () => {
            onActionHover?.(null);
        });
        layer.add(badgeShape);
    };

    // 1. 节点角标：锚点 = 节点 canvas 坐标（shape.x()/y()）右上角偏移（D6）
    const nodeShapes = stage.find(
        (shape: Konva.Shape) => shape.attrs?.enableSelect === "node"
    ) as unknown as Konva.Shape[];
    nodeShapes.forEach(nodeShape => {
        const data = nodeShape.getAttrs()?.data;
        if (!data) return;
        const summary = resolveActionSummary(data.actions);
        // 无动作节点不绘制（D22）；动作被清空后这里自然跳过 → 角标立即消失
        if (!summary) return;
        const anchorX = nodeShape.x() + ACTION_NODE_OFFSET * scale;
        // canvas 坐标右上 = x+ / y-（SPEC §3.1）
        const anchorY = nodeShape.y() - ACTION_NODE_OFFSET * scale;
        addBadge("node", nodeShape.id(), data.actions, anchorX, anchorY, summary.severity, summary.count);
    });

    // 2. 路径角标：锚点 = labelX/labelY「中点下方」+ 正反沿法线错开（D7/D13）
    const edgeShapes = stage.find(
        (shape: Konva.Shape) => shape.attrs?.enableSelect === "edge"
    ) as unknown as Konva.Shape[];
    edgeShapes.forEach(edgeShape => {
        const data = edgeShape.getAttrs()?.data;
        if (!data) return;
        const summary = resolveActionSummary(data.actions);
        if (!summary) return;
        const { sx, sy, cx, cy, dx, dy, ex, ey, labelX, labelY, isBackEdge } = data;
        // 切线角度（法线方向依据；角标本身不旋转 D8，仅位置用法线方向决定正反错开）
        const angle = computeEdgeTangentAngle(sx, sy, cx, cy, dx, dy, ex, ey);
        // 法线单位向量（canvas 坐标系，切线左侧），与设备图标法线偏移同口径
        const nx = -Math.sin(angle);
        const ny = Math.cos(angle);
        // 正向 +n 侧、反向 -n 侧（D13）
        const iconSign = isBackEdge ? -1 : 1;
        // 最终锚点 = 标签点 + 法线错开 + 中点下方（canvas 下 = y+，SPEC §3.1/D16）
        const anchorX = labelX + iconSign * nx * normalOffset;
        const anchorY = labelY + iconSign * ny * normalOffset + ACTION_EDGE_OFFSET_Y * scale;
        addBadge("edge", edgeShape.id(), data.actions, anchorX, anchorY, summary.severity, summary.count);
    });

    layer.batchDraw();
};
