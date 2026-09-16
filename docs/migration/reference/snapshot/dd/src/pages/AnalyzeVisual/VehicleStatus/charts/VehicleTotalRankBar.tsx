/**
 * @description 车辆状态统计：车辆总时长排行横向柱
 *
 * 每辆车全部状态时长之和（小时），降序 + inverse 使最大值在顶部。
 * 单系列（无状态维度），统一使用系列色第 1 槽；
 * 柱尾直接标注小时数，Tooltip 展示人性化时长。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import { formatDecimalHours, formatDuration } from "@/pages/AnalyzeVisual/DashboardShared/model/formatters";
import type { VehicleDurationGroup } from "@/pages/AnalyzeVisual/VehicleStatus/model/selectors";

export interface VehicleTotalRankBarProps {
    /** 按车辆分组的时长聚合 */
    data: VehicleDurationGroup[];
}

/**
 * 车辆总时长排行横向柱（单位：小时）。
 */
export function VehicleTotalRankBar({ data }: VehicleTotalRankBarProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();

    // 按总时长降序，总时长相同按展示名稳定排序
    const sorted = useMemo(
        () => [...data].sort((a, b) => b.totalSeconds - a.totalSeconds || a.vehicleName.localeCompare(b.vehicleName)),
        [data],
    );

    const containerRef = useECharts(
        useMemo(() => {
            return {
                aria: { enabled: true, label: { description: t("车辆总时长排行横向柱图") }, decal: { show: true } },
                tooltip: {
                    trigger: "axis",
                    axisPointer: { type: "shadow" },
                    backgroundColor: theme.tooltipBg,
                    borderColor: theme.tooltipBorder,
                    // 柱值为小时，Tooltip 换算回秒展示人性化时长
                    formatter: (params: { name: string; value: number }[]) => {
                        const p = params[0];
                        return `${p.name}<br/>${formatDuration(p.value * 3600 * 1000, locale)}`;
                    },
                },
                grid: { left: 8, right: 56, top: 16, bottom: 24, containLabel: true },
                xAxis: {
                    type: "value",
                    name: t("小时"),
                    axisLabel: { color: theme.colorTextSecondary },
                    splitLine: { lineStyle: { color: theme.splitLineColor } },
                },
                yAxis: {
                    type: "category",
                    inverse: true,
                    data: sorted.map((d) => d.vehicleName),
                    axisLabel: { color: theme.colorTextSecondary },
                    axisLine: { lineStyle: { color: theme.splitLineColor } },
                },
                series: [
                    {
                        type: "bar",
                        // 单系列无状态语义，统一使用系列色第 1 槽
                        data: sorted.map((d) => +(d.totalSeconds / 3600).toFixed(2)),
                        itemStyle: { color: theme.seriesColors[0], borderRadius: [0, 4, 4, 0] },
                        barMaxWidth: 18,
                        label: {
                            show: true,
                            position: "right",
                            color: theme.colorTextSecondary,
                            formatter: (p: { value: number }) => `${formatDecimalHours(p.value * 3600 * 1000, locale)} h`,
                        },
                    },
                ],
            };
        }, [sorted, t, locale, theme]),
    );

    if (!sorted.length) {
        return <Empty description={t("暂无数据")} />;
    }

    return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
