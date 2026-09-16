/**
 * @description 车辆状态统计：状态时长占比环形饼图
 *
 * 同时服务于两个面板：
 *   - 各状态总时长占比（跨车辆聚合，aggregateByState 的结果）
 *   - 单车辆状态分布（筛选单车后的同一数据结构）
 *
 * 状态色取自 STATE_COLOR 固定语义映射（颜色跟随状态实体，不随排名变化）；
 * 仅展示时长 > 0 的状态，避免 13 种状态全量进图例造成噪音。
 * 图例纵向滚动置于右侧，兼容状态数较多（最多 13 种）的场景。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import { formatDuration } from "@/pages/AnalyzeVisual/DashboardShared/model/formatters";
import { stateColor, stateLabelKey } from "@/pages/AnalyzeVisual/VehicleStatus/model/states";
import type { StateDurationItem } from "@/pages/AnalyzeVisual/VehicleStatus/model/selectors";

export interface StateSharePieProps {
    /** 按状态聚合的时长项（秒） */
    data: StateDurationItem[];
    /** aria 可访问描述（两个使用场景文案不同，由调用方传入） */
    ariaDescription: string;
}

/**
 * 状态时长占比环形饼图。
 */
export function StateSharePie({ data, ariaDescription }: StateSharePieProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();

    // 仅保留时长 > 0 的状态，按时长降序（大扇区在前，图例同序）
    const items = useMemo(
        () => data.filter((d) => d.seconds > 0).sort((a, b) => b.seconds - a.seconds),
        [data],
    );

    const containerRef = useECharts(
        useMemo(() => {
            const seriesData = items.map((d) => ({
                name: t(stateLabelKey(d.state)),
                value: d.seconds,
                itemStyle: { color: stateColor(d.state) },
            }));
            return {
                aria: { enabled: true, label: { description: ariaDescription }, decal: { show: true } },
                tooltip: {
                    trigger: "item",
                    backgroundColor: theme.tooltipBg,
                    borderColor: theme.tooltipBorder,
                    // 值域为秒，Tooltip 展示人性化时长 + 百分比
                    formatter: (p: { name: string; value: number; percent: number }) =>
                        `${p.name}<br/>${formatDuration(p.value * 1000, locale)} (${p.percent}%)`,
                },
                legend: {
                    type: "scroll",
                    orient: "vertical",
                    right: 8,
                    top: "center",
                    textStyle: { color: theme.colorTextSecondary, fontSize: 12 },
                },
                series: [
                    {
                        type: "pie",
                        radius: ["38%", "68%"],
                        // 左侧给饼、右侧给纵向图例
                        center: ["38%", "50%"],
                        avoidLabelOverlap: true,
                        label: { show: false },
                        emphasis: {
                            label: { show: true, fontSize: 13, fontWeight: 700, color: theme.colorText },
                        },
                        data: seriesData,
                    },
                ],
            };
        }, [items, ariaDescription, t, locale, theme]),
    );

    if (!items.length) {
        return <Empty description={t("暂无数据")} />;
    }

    return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
