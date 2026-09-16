/**
 * @description 利用率趋势折线（原效率分析页面迁入）
 *
 * 利用率单 Y 轴折线，0–100%。
 * 空跑率因接口无空载行驶距离数据，暂不展示。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { formatBucketLabel } from "@/pages/AnalyzeVisual/DashboardShared/model/businessTime";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import type { TimeGranularity } from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type { EfficiencyTrendPoint } from "@/pages/AnalyzeVisual/TaskStatisticsReport/model/types";

export interface EfficiencyTrendLineProps {
    data: EfficiencyTrendPoint[];
    granularity: TimeGranularity;
}

/**
 * 利用率趋势折线（单 Y 轴）。
 */
export function EfficiencyTrendLine({ data, granularity }: EfficiencyTrendLineProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();
    const containerRef = useECharts(
        useMemo(() => {
            const xLabels = data.map((p) => formatBucketLabel(p.bucketStart, granularity, locale));
            const percentFormatter = (v: number) => `${Math.round(v * 100)}%`;
            return {
                aria: { enabled: true, label: { description: t("利用率趋势折线图") }, decal: { show: true } },
                tooltip: {
                    trigger: "axis",
                    backgroundColor: theme.tooltipBg,
                    borderColor: theme.tooltipBorder,
                    valueFormatter: (v: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(v),
                },
                legend: {
                    bottom: 0,
                    data: [t("利用率")],
                    textStyle: { color: theme.colorTextSecondary },
                },
                grid: { left: 48, right: 48, top: 16, bottom: 40 },
                xAxis: {
                    type: "category",
                    boundaryGap: false,
                    data: xLabels,
                    axisLabel: { color: theme.colorTextSecondary, fontSize: 11 },
                    axisLine: { lineStyle: { color: theme.splitLineColor } },
                },
                yAxis: {
                    type: "value",
                    name: t("利用率"),
                    min: 0,
                    max: 1,
                    axisLabel: { color: theme.colorTextSecondary, formatter: percentFormatter },
                    splitLine: { lineStyle: { color: theme.splitLineColor } },
                },
                series: [
                    {
                        name: t("利用率"),
                        type: "line",
                        smooth: true,
                        data: data.map((p) => p.utilization),
                        itemStyle: { color: theme.seriesColors[0] },
                        lineStyle: { color: theme.seriesColors[0], width: 2 },
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
