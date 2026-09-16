/**
 * @description 任务统计：任务量趋势堆叠柱（§5.2）
 *
 * 完成、失败、取消；X 轴使用自适应时间桶（hour/day/week，§6.5）。
 * 依赖 useChartTheme + locale + 数据驱动 option useMemo（§9.2）。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { formatBucketLabel } from "@/pages/AnalyzeVisual/DashboardShared/model/businessTime";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import type { TimeGranularity } from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type { TaskVolumePoint } from "@/pages/AnalyzeVisual/TaskStatisticsReport/model/types";

export interface TaskVolumeStackedBarProps {
    data: TaskVolumePoint[];
    granularity: TimeGranularity;
}

/**
 * 任务量趋势堆叠柱：完成 / 失败 / 取消。
 */
export function TaskVolumeStackedBar({ data, granularity }: TaskVolumeStackedBarProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();
    const containerRef = useECharts(
        useMemo(() => {
            const xLabels = data.map((p) => formatBucketLabel(p.bucketStart, granularity, locale));
            return {
                aria: { enabled: true, label: { description: t("任务量趋势堆叠柱图") }, decal: { show: true } },
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBorder },
                legend: {
                    bottom: 0,
                    data: [t("完成"), t("失败"), t("取消")],
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
                series: [
                    {
                        name: t("完成"),
                        type: "bar",
                        stack: "total",
                        itemStyle: { color: theme.successColor },
                        data: data.map((p) => p.completedCount),
                    },
                    {
                        name: t("失败"),
                        type: "bar",
                        stack: "total",
                        itemStyle: { color: theme.errorColor },
                        data: data.map((p) => p.failedCount),
                    },
                    {
                        name: t("取消"),
                        type: "bar",
                        stack: "total",
                        itemStyle: { color: theme.token.colorTextQuaternary },
                        data: data.map((p) => p.canceledCount),
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
