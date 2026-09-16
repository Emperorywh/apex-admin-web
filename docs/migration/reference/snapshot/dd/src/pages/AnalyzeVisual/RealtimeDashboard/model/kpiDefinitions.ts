/**
 * @description 实时看板 KPI 展示定义（§10 polarity 表）
 *
 * 实时 KPI 的 polarity 固定如下，不由 mock 或后端覆盖（§10）。
 * labelKey 为稳定的国际化 key，展示层通过 t(labelKey) 转换。
 */
import type { MetricDefinition } from "@/pages/AnalyzeVisual/DashboardShared/model/kpiViewModel";
import type { RealtimeKpis } from "@/pages/AnalyzeVisual/RealtimeDashboard/model/types";

/**
 * 实时 KPI 展示定义表。
 * key 与 RealtimeKpis 字段一一对应（§10）。
 * "在线 AGV / 总 AGV" 是复合展示，由组件单独处理。
 */
export const REALTIME_KPI_DEFINITIONS: Record<keyof Omit<RealtimeKpis, "onlineVehicleCount" | "totalVehicleCount">, MetricDefinition> = {
    todayTaskTotal: {
        labelKey: "今日任务总数",
        format: "integer",
        polarity: "neutral",
    },
    todayCompletionRate: {
        labelKey: "今日任务完成率",
        format: "percentage",
        polarity: "higher-is-better",
    },
    faultVehicleCount: {
        labelKey: "故障 AGV 数",
        format: "integer",
        polarity: "lower-is-better",
    },
    averageCompletedDurationMs: {
        labelKey: "今日已完成任务平均耗时",
        format: "duration",
        polarity: "lower-is-better",
    },
    averageHourlyCompletedCount: {
        labelKey: "今日平均每小时完成任务数",
        format: "decimal",
        polarity: "higher-is-better",
    },
    fleetUtilization: {
        labelKey: "AGV 综合利用率",
        format: "percentage",
        polarity: "higher-is-better",
    },
    backlogCount: {
        labelKey: "当前任务积压",
        format: "integer",
        polarity: "lower-is-better",
    },
};

/** 在线 AGV / 总 AGV 的展示定义（复合指标，单独处理） */
export const ONLINE_VEHICLE_DEFINITION: MetricDefinition = {
    labelKey: "在线 AGV / 总 AGV",
    format: "integer",
    polarity: "neutral",
};
