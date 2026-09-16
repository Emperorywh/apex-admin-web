/**
 * @description 故障告警：故障类型分布环形饼图（§5.4）
 *
 * 传感器、电池、通信、机械、软件。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { FAULT_TYPE_LABEL } from "@/pages/AnalyzeVisual/DashboardShared/model/enumLabels";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import { FAULT_TYPE_ORDER } from "@/pages/AnalyzeVisual/FaultAlert/model/types";
import type { CategoryValue, FaultType } from "@/pages/AnalyzeVisual/DashboardShared/model/types";

export interface FaultTypePieProps {
    data: CategoryValue<FaultType>[];
}

/**
 * 故障类型占比环形饼图。
 */
export function FaultTypePie({ data }: FaultTypePieProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();
    const containerRef = useECharts(
        useMemo(() => {
            const seriesData = FAULT_TYPE_ORDER.map((key, idx) => ({
                name: t(FAULT_TYPE_LABEL[key]),
                value: data.find((d) => d.key === key)?.value ?? 0,
                itemStyle: { color: theme.seriesColors[idx % theme.seriesColors.length] },
            })).filter((d) => d.value > 0);

            return {
                aria: { enabled: true, label: { description: t("故障类型分布环形图") }, decal: { show: true } },
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
