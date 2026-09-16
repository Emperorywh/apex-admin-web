/**
 * @description 故障告警：故障趋势柱+折线（§5.4）
 *
 * 故障次数（柱）+ 归一化故障频率（次/天，折线，§6.4）。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { formatBucketLabel } from "@/pages/AnalyzeVisual/DashboardShared/model/businessTime";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import type { TimeGranularity } from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type { FaultTrendPoint } from "@/pages/AnalyzeVisual/FaultAlert/model/types";

export interface FaultTrendBarLineProps {
    data: FaultTrendPoint[];
    granularity: TimeGranularity;
}

/**
 * 故障趋势柱（次数）+ 折线（频率 = 次/天，§6.4）。
 */
export function FaultTrendBarLine({ data, granularity }: FaultTrendBarLineProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();
    const containerRef = useECharts(
        useMemo(() => {
            const xLabels = data.map((p) => formatBucketLabel(p.bucketStart, granularity, locale));
            return {
                aria: { enabled: true, label: { description: t("故障趋势柱状与频率折线图") }, decal: { show: true } },
                tooltip: { trigger: "axis", backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBorder },
                legend: {
                    bottom: 0,
                    data: [t("故障次数"), t("故障频率")],
                    textStyle: { color: theme.colorTextSecondary },
                },
                grid: { left: 48, right: 48, top: 16, bottom: 40 },
                xAxis: [
                    {
                        type: "category",
                        data: xLabels,
                        axisLabel: { color: theme.colorTextSecondary, fontSize: 11 },
                        axisLine: { lineStyle: { color: theme.splitLineColor } },
                    },
                ],
                yAxis: [
                    {
                        type: "value",
                        name: t("故障次数"),
                        position: "left",
                        axisLabel: { color: theme.colorTextSecondary },
                        splitLine: { lineStyle: { color: theme.splitLineColor } },
                    },
                    {
                        type: "value",
                        name: t("故障频率"),
                        position: "right",
                        axisLabel: {
                            color: theme.colorTextSecondary,
                            formatter: (v: number) => `${v}`,
                        },
                        splitLine: { show: false },
                    },
                ],
                series: [
                    {
                        name: t("故障次数"),
                        type: "bar",
                        yAxisIndex: 0,
                        itemStyle: { color: theme.errorColor },
                        barMaxWidth: 28,
                        data: data.map((p) => p.faultCount),
                    },
                    {
                        name: t("故障频率"),
                        type: "line",
                        yAxisIndex: 1,
                        smooth: true,
                        data: data.map((p) => p.frequencyPerDay),
                        itemStyle: { color: theme.seriesColors[3] },
                        lineStyle: { color: theme.seriesColors[3], width: 2 },
                    },
                ],
            };
        }, [data, granularity, t, locale, theme]),
    );

    if (!data.length) {
        return <Empty description={t("暂无数据")} />;
    }

    return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
