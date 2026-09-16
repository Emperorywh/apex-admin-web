/**
 * @description 节点/路径动作角标配色（明/暗两套）
 * @date 2026-6-28
 *
 * 配色来自 SPEC §3.5：按最严重 blockingType 染色
 *   HARD 红（硬阻塞）/ SOFT 黄（软阻塞）/ NONE 中性灰（不阻塞）
 * 圆内数字统一白色，保证三色底上都可读。
 * 描边与设备图标一致：亮色半透明白 / 暗色半透明黑，保证在彩色路径/节点上可辨。
 *
 * 此处独立声明 ActionSeverityLiteral，避免与 index.ts 形成 import 循环
 * （index.ts 反向 re-export 本模块的配色函数）。
 */

/** 阻塞等级字面量类型（与 index.ts 的 ActionSeverity 同源） */
export type ActionSeverityLiteral = "HARD" | "SOFT" | "NONE";

/** 单套主题下的三档阻塞配色 */
export interface ActionColorSet {
    /** 硬阻塞：警示红 */
    HARD: string;
    /** 软阻塞：黄 */
    SOFT: string;
    /** 不阻塞：中性灰 */
    NONE: string;
}

/**
 * 明/暗两套阻塞配色
 * 取色规则与设备图标配色一致（SPEC §3.5 / D18，复用设备规格引入的 isDark 机制）
 */
export const actionStyles = {
    /** 亮色主题配色 */
    light: {
        HARD: "#E53935",
        SOFT: "#FB8C00",
        NONE: "#9E9E9E",
    },
    /** 暗色主题配色 */
    dark: {
        HARD: "#EF5350",
        SOFT: "#FFA726",
        NONE: "#BDBDBD",
    },
} as const;

/** 圆内数字统一白色，保证三色底上都可读（SPEC §3.5） */
export const ACTION_NUMBER_COLOR = "#FFFFFF";

/**
 * 角标描边色：亮色半透明白 / 暗色半透明黑
 * 与设备图标描边口径一致，保证角标在彩色路径/节点上可辨（SPEC §3.5）
 */
export const actionStrokeColor = (isDark: boolean): string =>
    isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.85)";

/** 选中联动高亮环颜色（SPEC D19，与设备图标选中态一致） */
export const ACTION_SELECTED_RING = "rgba(255,235,59,0.55)";

/**
 * 按阻塞等级取色（明/暗）
 * @param severity 阻塞等级
 * @param isDark 是否暗黑主题
 */
export const getSeverityColor = (
    severity: ActionSeverityLiteral,
    isDark: boolean
): string => {
    const set = isDark ? actionStyles.dark : actionStyles.light;
    return set[severity];
};
