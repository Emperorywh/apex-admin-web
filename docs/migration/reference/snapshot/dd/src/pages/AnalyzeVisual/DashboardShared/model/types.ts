/**
 * @description Dashboard 领域层共享类型（§7.1）
 *
 * 所有时间和单位在领域层保持稳定，不携带 React 节点或视觉色调。
 * 业务枚举保存稳定 code，展示层根据 code 查找翻译 key。
 */

export type TimeGranularity = "hour" | "day" | "week";

export type TaskStatus = "completed" | "failed" | "canceled";
export type TaskType = "transport" | "picking" | "replenishment" | "inventory";
export type AlertLevel = "critical" | "major" | "minor" | "info";
export type FaultType = "sensor" | "battery" | "communication" | "mechanical" | "software";
export type VehicleStatus = "running" | "idle" | "charging" | "fault" | "offline";
export type FaultStatus = "open" | "recovering" | "closed";

/**
 * 可比较指标：当前值与基线值。
 * 不包含 tone、颜色或已格式化字符串。
 * 指标的"越高越好/越低越好"由展示层的指标定义表决定。
 */
export interface ComparableMetric {
    current: number | null;
    baseline: number | null;
}

/**
 * 分类计数值。
 */
export interface CategoryValue<TKey extends string> {
    key: TKey;
    value: number;
}

/**
 * 本地化消息：只承载稳定翻译 key 和插值参数。
 * HTTP 适配器负责把后端未知 key 转换为领域错误，
 * 不允许把未受控 HTML 当作描述展示。
 */
export interface LocalizedMessage {
    key: string;
    values?: Record<string, string | number>;
}
