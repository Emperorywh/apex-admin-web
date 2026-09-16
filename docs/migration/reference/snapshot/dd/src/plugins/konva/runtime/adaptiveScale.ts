/**
 * @description 自适应视觉倍率纯函数（MapNestModify / Overlook 共用）
 * @date 2026-7-7
 *
 * 根据 stage 缩放倍率计算视觉补偿比例：
 * 缩放越大（zoom in），visualScale 越小，抵消 stage 放大，
 * 让节点 / 路径 / 字号的屏幕像素近似恒定，
 * 避免放大后元素撑满屏幕、缩小时元素糊成一团。
 * 对数插值锚点：stageScale=50 → 1.0（满血），stageScale=1000 → 0.05（最小）。
 */

/** 满血锚点 scale（对数下界） */
const LN_50 = Math.log(50);
/** 最小锚点 scale（对数上界） */
const LN_1000 = Math.log(1000);
/** 对数跨度 */
const LN_SPAN = LN_1000 - LN_50;

/**
 * 计算 visualScale：
 * stageScale <= 50 返回 1（满血）；
 * stageScale >= 1000 返回 0.05（最小）；
 * 50 ~ 1000 之间按自然对数线性插值。
 */
export const computeAdaptiveScale = (stageScale: number): number => {
    if (stageScale <= 50) return 1;
    if (stageScale >= 1000) return 0.05;
    return 1 - 0.95 * (Math.log(stageScale) - LN_50) / LN_SPAN;
};
