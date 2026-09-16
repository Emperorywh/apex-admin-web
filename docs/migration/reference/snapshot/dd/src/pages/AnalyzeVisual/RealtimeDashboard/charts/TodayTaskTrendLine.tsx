/**
 * @description 实时看板：今日任务完成趋势双折线（§5.1）
 *
 * 今日与昨日按小时对比；只展示截至当前小时的数据（§5.1）。
 * 依赖 useChartTheme + locale + 数据驱动 option useMemo（§9.2）。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { formatBucketLabel } from "@/pages/AnalyzeVisual/DashboardShared/model/businessTime";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import type { HourlyComparisonPoint } from "@/pages/AnalyzeVisual/RealtimeDashboard/model/types";

export interface TodayTaskTrendLineProps {
    data: HourlyComparisonPoint[];
}

/**
 * 今日 vs 昨日按小时对比折线。
 */
export function TodayTaskTrendLine({ data }: TodayTaskTrendLineProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();
    const containerRef = useECharts(
        useMemo(() => {
            const xLabels = data.map((p) => formatBucketLabel(p.bucketStart, "hour", locale));
            return {
                aria: { enabled: true, label: { description: t("今日任务完成趋势对比折线图") }, decal: { show: true } },
                tooltip: { trigger: "axis", backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBorder },
                legend: {
                    bottom: 0,
                    data: [t("今日"), t("昨日")],
                    textStyle: { color: theme.colorTextSecondary },
                },
                grid: { left: 40, right: 16, top: 16, bottom: 40 },
                xAxis: {
                    type: "category",
                    boundaryGap: false,
                    data: xLabels,
                    axisLabel: { color: theme.colorTextSecondary, fontSize: 11 },
                    axisLine: { lineStyle: { color: theme.splitLineColor } },
                },
                yAxis: {
                    type: "value",
                    axisLabel: { color: theme.colorTextSecondary },
                    splitLine: { lineStyle: { color: theme.splitLineColor } },
                },
                series: [
                    {
                        name: t("今日"),
                        type: "line",
                        smooth: true,
                        symbol: "circle",
                        symbolSize: 6,
                        data: data.map((p) => p.todayCompleted),
                        itemStyle: { color: theme.seriesColors[0] },
                        lineStyle: { color: theme.seriesColors[0], width: 2 },
                        areaStyle: { opacity: 0.08 },
                    },
                    {
                        name: t("昨日"),
                        type: "line",
                        smooth: true,
                        symbol: "circle",
                        symbolSize: 5,
                        data: data.map((p) => p.yesterdayCompleted),
                        itemStyle: { color: theme.seriesColors[2] },
                        lineStyle: { color: theme.seriesColors[2], width: 2, type: "dashed" },
                    },
                ],
            };
        }, [data, t, locale, theme]),
    );

    if (!data.length) {
        return <Empty description={t("暂无数据")} />;
    }

    return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
