/**
 * @description 车辆状态统计：各状态总时长排行横向柱
 *
 * 跨车辆聚合后按状态时长排行（小时），升序排列使最大值在顶部。
 * 每根柱使用状态固定语义色；柱尾直接标注小时数（selective direct label），
 * Tooltip 展示人性化时长（小时值 ×3600 换算回秒再格式化）。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import { formatDecimalHours, formatDuration } from "@/pages/AnalyzeVisual/DashboardShared/model/formatters";
import { stateColor, stateLabelKey } from "@/pages/AnalyzeVisual/VehicleStatus/model/states";
import type { StateDurationItem } from "@/pages/AnalyzeVisual/VehicleStatus/model/selectors";

export interface StateDurationRankBarProps {
    /** 按状态聚合的时长项（秒） */
    data: StateDurationItem[];
}

/**
 * 各状态总时长排行横向柱（单位：小时）。
 */
export function StateDurationRankBar({ data }: StateDurationRankBarProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();

    // 升序排列：ECharts 类目轴自下而上渲染，升序使最长状态显示在顶部
    const sorted = useMemo(
        () => data.filter((d) => d.seconds > 0).sort((a, b) => a.seconds - b.seconds),
        [data],
    );

    const containerRef = useECharts(
        useMemo(() => {
            return {
                aria: { enabled: true, label: { description: t("各状态总时长排行横向柱图") }, decal: { show: true } },
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
                grid: { left: 8, right: 56, top: 28, bottom: 24, containLabel: true },
                xAxis: {
                    type: "value",
                    name: t("小时"),
                    axisLabel: { color: theme.colorTextSecondary },
                    splitLine: { lineStyle: { color: theme.splitLineColor } },
                },
                yAxis: {
                    type: "category",
                    data: sorted.map((d) => t(stateLabelKey(d.state))),
                    axisLabel: { color: theme.colorTextSecondary },
                    axisLine: { lineStyle: { color: theme.splitLineColor } },
                },
                series: [
                    {
                        type: "bar",
                        data: sorted.map((d) => ({
                            value: +(d.seconds / 3600).toFixed(2),
                            itemStyle: { color: stateColor(d.state), borderRadius: [0, 4, 4, 0] },
                        })),
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
