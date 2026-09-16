/**
 * @description 故障告警：告警级别分布堆叠柱（§5.4）
 *
 * 严重、重要、一般、提示（按时间桶堆叠）。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { formatBucketLabel } from "@/pages/AnalyzeVisual/DashboardShared/model/businessTime";
import { ALERT_LEVEL_LABEL } from "@/pages/AnalyzeVisual/DashboardShared/model/enumLabels";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import { ALERT_LEVEL_ORDER } from "@/pages/AnalyzeVisual/FaultAlert/model/types";
import type { AlertLevel } from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type { TimeGranularity } from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type { AlertLevelPoint } from "@/pages/AnalyzeVisual/FaultAlert/model/types";

export interface AlertLevelStackedBarProps {
    data: AlertLevelPoint[];
    granularity: TimeGranularity;
}

/** 级别对应系列色（与 Tag 颜色语义一致） */
function levelColor(level: AlertLevel, theme: ReturnType<typeof useChartTheme>): string {
    switch (level) {
        case "critical":
            return theme.errorColor;
        case "major":
            return theme.warningColor;
        case "minor":
            return theme.infoColor;
        case "info":
            return theme.token.colorTextQuaternary;
    }
}

/**
 * 告警级别分布堆叠柱：严重/重要/一般/提示。
 */
export function AlertLevelStackedBar({ data, granularity }: AlertLevelStackedBarProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();
    const containerRef = useECharts(
        useMemo(() => {
            const xLabels = data.map((p) => formatBucketLabel(p.bucketStart, granularity, locale));
            const countField: Record<AlertLevel, "criticalCount" | "majorCount" | "minorCount" | "infoCount"> = {
                critical: "criticalCount",
                major: "majorCount",
                minor: "minorCount",
                info: "infoCount",
            };
            return {
                aria: { enabled: true, label: { description: t("告警级别分布堆叠柱图") }, decal: { show: true } },
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBorder },
                legend: {
                    bottom: 0,
                    data: ALERT_LEVEL_ORDER.map((l) => t(ALERT_LEVEL_LABEL[l])),
                    textStyle: { color: theme.colorTextSecondary },
                },
                grid: { left: 40, right: 16, top: 16, bottom: 40 },
                xAxis: {
                    type: "category",
                    data: xLabels,
                    axisLabel: { color: theme.colorTextSecondary, fontSize: 11 },
                    axisLine: { lineStyle: { color: theme.splitLineColor } },
                },
                yAxis: {
                    type: "value",
                    axisLabel: { color: theme.colorTextSecondary },
                    splitLine: { lineStyle: { color: theme.splitLineColor } },
                },
                series: ALERT_LEVEL_ORDER.map((level) => ({
                    name: t(ALERT_LEVEL_LABEL[level]),
                    type: "bar",
                    stack: "level",
                    itemStyle: { color: levelColor(level, theme) },
                    data: data.map((p) => p[countField[level]]),
                })),
            };
        }, [data, granularity, t, locale, theme]),
    );

    if (!data.length) {
        return <Empty description={t("暂无数据")} />;
    }

    return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
