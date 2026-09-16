/**
 * @description 节点/路径动作角标插件模块统一出口
 * @date 2026-6-28
 *
 * 与 src/plugins/konva/devices/ 结构对齐，集中提供：
 *   - 动作摘要识别 resolveActionSummary（D3/D5：数量 + 最严重阻塞等级）
 *   - 角标配色 actionStyles（明/暗两套，D4/D5/D18）
 *   - 角标绘制 actionBadgeSceneFunc（染色圆 + 内嵌数字，D1/D3/D8）
 *   - 命令式全量刷新 refreshActionBadges（MapNestModify 专用，D23）
 *   - 详情浮层 ActionTooltip（HTML overlay，三画布共用，D9-D11）
 *   - 坐标转换 stageToScreen（画布坐标 → 屏幕坐标，三画布共用）
 */
import type Konva from "konva";
import type { ActionType } from "@/utils/typing";

export {
    actionStyles,
    getSeverityColor,
    actionStrokeColor,
    ACTION_NUMBER_COLOR,
    ACTION_SELECTED_RING,
} from "./actionStyles";
export type { ActionColorSet, ActionSeverityLiteral } from "./actionStyles";
export {
    actionBadgeSceneFunc,
    actionBadgeHitFunc,
    ACTION_BASE_RADIUS,
    ACTION_NODE_OFFSET,
    ACTION_EDGE_NORMAL_OFFSET,
    ACTION_EDGE_OFFSET_Y,
} from "./actionBadgeSceneFunc";
export { refreshActionBadges } from "./refreshActionBadges";
export type { ActionHoverPayload } from "./refreshActionBadges";
export { ActionTooltip } from "./ActionTooltip";
export type { ActionTooltipData } from "./ActionTooltip";

/**
 * 阻塞等级（D4）：三值语义
 *   - HARD：硬阻塞，必须等执行完（最严重）
 *   - SOFT：软阻塞
 *   - NONE：不阻塞（最轻）
 * 严重度优先级：HARD > SOFT > NONE（D5 染色依据）
 */
export type ActionSeverity = "HARD" | "SOFT" | "NONE";

/**
 * 动作角标摘要（SPEC §2）：数量 + 最严重阻塞等级
 */
export interface ActionSummary {
    /** 动作总数（圆心数字） */
    count: number;
    /** 最严重 blockingType（HARD > SOFT > NONE） */
    severity: ActionSeverity;
}

/**
 * 动作摘要识别（D3/D5/D22）：从 actions 数组计算 {count, severity}
 *
 * 1. actions 为 null/undefined/空数组 → 返回 null（不绘制，D22）
 * 2. count = actions.length（全部动作数，含 blockingType 非法者）
 * 3. severity = actions 中存在的最高优先级 blockingType（HARD > SOFT > NONE）
 * 4. 容错：单个 action 缺 blockingType 或值非法时，按 NONE 参与比较（不抛错，SPEC §2.3）
 *
 * 该函数与渲染机制无关，三画布共用；命令式/声明式均通过它得到 {count, severity} 后再绘制角标。
 *
 * @param actions 节点/路径的 actions 数组（可能为 null/undefined/空）
 */
export const resolveActionSummary = (
    actions: ActionType[] | null | undefined
): ActionSummary | null => {
    // 空数组 / null / undefined → 不绘制（D22）
    if (!actions || !Array.isArray(actions) || actions.length === 0) return null;

    // 过滤出合法的 blockingType（容错：缺失/非法值不参与，最终按 NONE 兜底）
    const validSeverities = actions
        .map(action => action?.blockingType)
        .filter((bt): bt is ActionSeverity => bt === "HARD" || bt === "SOFT" || bt === "NONE");

    // 最严重等级：HARD > SOFT > NONE；全 NONE 或全非法 → NONE（SPEC §2 / D5）
    let severity: ActionSeverity = "NONE";
    if (validSeverities.includes("HARD")) {
        severity = "HARD";
    } else if (validSeverities.includes("SOFT")) {
        severity = "SOFT";
    }

    return { count: actions.length, severity };
};

/**
 * 画布坐标 → 屏幕坐标转换（SPEC §12，三画布共用）
 *
 * 动作角标 hover tooltip 需贴锚点定位（不跟随鼠标，D11），
 * 需把角标锚点的画布坐标（stage 内部坐标）转为屏幕坐标（viewport）。
 *
 * 公式：screen = stage 容器 rect 左上角 + stage 平移 + canvas × stage 缩放
 * 注意：忽略 stage.rotation 的旋转影响（与设备 hover 的简单实现一致；
 *       旋转地图场景下浮层位置会有偏差，本期接受，SPEC §8「地图整体旋转」）。
 *
 * @param stage Konva.Stage
 * @param canvasX canvasY 锚点画布坐标（stage 内部坐标）
 */
export const stageToScreen = (
    stage: Konva.Stage | null | undefined,
    canvasX: number,
    canvasY: number
): { x: number; y: number } => {
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.container().getBoundingClientRect();
    return {
        x: rect.left + stage.x() + canvasX * stage.scaleX(),
        y: rect.top + stage.y() + canvasY * stage.scaleY(),
    };
};
