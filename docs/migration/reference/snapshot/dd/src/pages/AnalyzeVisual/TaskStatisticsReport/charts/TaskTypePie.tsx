/**
 * @description 任务统计：任务类型占比环形饼图（§5.2）
 *
 * 搬运、拣选、补货、盘点。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { TASK_TYPE_LABEL } from "@/pages/AnalyzeVisual/DashboardShared/model/enumLabels";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import { TASK_TYPE_ORDER } from "@/pages/AnalyzeVisual/TaskStatisticsReport/model/types";
import type { CategoryValue } from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type { TaskType } from "@/pages/AnalyzeVisual/DashboardShared/model/types";

export interface TaskTypePieProps {
    data: CategoryValue<TaskType>[];
}

/**
 * 任务类型占比环形饼图。
 */
export function TaskTypePie({ data }: TaskTypePieProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();
    const containerRef = useECharts(
        useMemo(() => {
            const seriesData = TASK_TYPE_ORDER.map((key, idx) => ({
                name: t(TASK_TYPE_LABEL[key]),
                value: data.find((d) => d.key === key)?.value ?? 0,
                itemStyle: { color: theme.seriesColors[idx % theme.seriesColors.length] },
            })).filter((d) => d.value > 0);

            return {
                aria: { enabled: true, label: { description: t("任务类型占比环形图") }, decal: { show: true } },
                tooltip: { trigger: "item", backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBorder },
                legend: { bottom: 0, textStyle: { color: theme.colorTextSecondary } },
                series: [
                    {
                        type: "pie",
                        radius: ["45%", "70%"],
                        center: ["50%", "45%"],
                        avoidLabelOverlap: true,
                        label: { color: theme.colorTextSecondary },
                        data: seriesData,
                    },
                ],
            };
        }, [data, t, locale, theme]),
    );

    if (!data.length || data.every((d) => d.value === 0)) {
        return <Empty description={t("暂无数据")} />;
    }

    return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
