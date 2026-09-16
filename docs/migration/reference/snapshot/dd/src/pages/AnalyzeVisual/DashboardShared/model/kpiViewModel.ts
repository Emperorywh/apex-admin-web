/**
 * @description KPI 展示模型（§10）
 *
 * 领域数据只提供数值。展示层的 MetricDefinition 决定标签、单位、格式和业务变化语义。
 * 趋势颜色统一按数值涨跌决定：上升红色、下降绿色、持平中性色。
 * buildKpiViewModel 是纯函数，负责计算方向和变化幅度、生成 tone、按 format 把
 * 领域层毫秒/米/0–1 比例转换为本地化展示值。
 * KpiCard 不读取业务枚举、不计算公式、不访问 repository。
 */
import {
    formatDecimal,
    formatDecimalHours,
    formatDecimalMinutes,
    formatDistanceKm,
    formatDuration,
    formatInteger,
    formatPercentage,
} from "@/pages/AnalyzeVisual/DashboardShared/model/formatters";
import type { ComparableMetric } from "@/pages/AnalyzeVisual/DashboardShared/model/types";

export type MetricFormat =
    | "integer"
    | "percentage"
    | "duration"
    | "distance-km"
    | "decimal"
    | "decimal-hours"
    | "decimal-minutes";

export type MetricPolarity = "higher-is-better" | "lower-is-better" | "neutral";

/**
 * KPI 展示定义属于 UI 层，不由 mock 或后端返回。
 * polarity 保留指标的业务好坏语义，不参与趋势颜色判断。
 * 趋势颜色仅取决于当前值相对基准值的涨跌方向。
 */
export interface MetricDefinition {
    labelKey: string;
    format: MetricFormat;
    polarity: MetricPolarity;
}

export type KpiTone = "good" | "bad" | "neutral";

export interface KpiViewModel {
    /** 主值（已格式化的本地化字符串，或 "--"） */
    displayValue: string;
    /** 可选的单位（部分 format 已包含单位时为空） */
    unit?: string;
    /** 环比文案，例如 "↑ 5.2%"；无 baseline 时不显示 */
    changeText?: string;
    /**
     * 环比颜色沿用现有色调：上升用 bad（红色），下降用 good（绿色）。
     * 持平或缺少基准值用 neutral，与指标业务好坏无关。
     */
    changeTone: KpiTone;
    /** 强调色边框（danger / warn / 无） */
    accent?: "danger" | "warn";
}

/**
 * 把单个数值按 format 格式化为展示字符串。
 */
function formatValue(value: number | null, format: MetricFormat, locale: string): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    switch (format) {
        case "integer":
            return formatInteger(value, locale);
        case "percentage":
            return formatPercentage(value, locale, 1);
        case "duration":
            return formatDuration(value, locale);
        case "distance-km":
            return formatDistanceKm(value, locale, 2);
        // 无单位纯小数（如 平均每小时完成任务数）：保留 1 位小数
        case "decimal":
            return formatDecimal(value, locale, 1);
        case "decimal-hours":
            return formatDecimalHours(value, locale, 2);
        case "decimal-minutes":
            return formatDecimalMinutes(value, locale, 1);
        default:
            return String(value);
    }
}

/**
 * 计算环比变化：current 相对 baseline 的变化比例。
 * baseline 为 0 或 null 时不计算比例，只返回绝对差。
 */
function computeChange(current: number, baseline: number | null, locale: string): { text?: string; tone: KpiTone } {
    if (baseline === null || baseline === undefined) return { tone: "neutral" };
    // 两者都为 0
    if (baseline === 0 && current === 0) return { text: "0%", tone: "neutral" };
    let ratio: number | null;
    if (baseline === 0) {
        // baseline 为 0 但 current 非零：用绝对方向而非比例
        ratio = current > 0 ? 1 : -1;
    } else {
        ratio = (current - baseline) / Math.abs(baseline);
    }
    const pctText = formatPercentage(ratio, locale, 1);
    const up = current > baseline;
    const down = current < baseline;
    const arrow = up ? "↑" : down ? "↓" : "→";
    /**
     * 箭头与颜色使用相同的涨跌方向，所有环比字段统一上升红、下降绿。
     * 不按指标的业务好坏反转颜色，持平时继续使用中性色。
     */
    const tone: KpiTone = up ? "bad" : down ? "good" : "neutral";
    return { text: `${arrow} ${pctText}`, tone };
}

/**
 * 构建 KPI 视图模型。纯函数，可单元测试（§16.1）。
 * 处理 baseline 为 0、current 为 0 和 null（§10）。
 */
export function buildKpiViewModel(
    metric: ComparableMetric,
    definition: MetricDefinition,
    locale: string,
): KpiViewModel {
    const displayValue = formatValue(metric.current, definition.format, locale);
    const change = computeChange(metric.current ?? 0, metric.baseline, locale);
    return {
        displayValue,
        changeText: change.text,
        changeTone: change.tone,
    };
}

/**
 * 构建纯数值（非 ComparableMetric）的 KPI 视图模型。
 * 用于在线 AGV 等无环比指标的展示。
 */
export function buildScalarKpiViewModel(
    value: number | null,
    definition: MetricDefinition,
    locale: string,
): KpiViewModel {
    return {
        displayValue: formatValue(value, definition.format, locale),
        changeTone: "neutral",
    };
}
