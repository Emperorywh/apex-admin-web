/**
 * @description 故障告警：单机故障排行 TOP10 横向柱（§5.4）
 *
 * 按次数降序，次数相同按 AGV ID 升序（§5.4）。
 * mock 生成器已保证排序口径一致，此处再做一次稳定排序以兼容 HTTP 数据。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import type { VehicleFaultRankItem } from "@/pages/AnalyzeVisual/FaultAlert/model/types";

export interface VehicleFaultRankBarProps {
    data: VehicleFaultRankItem[];
}

/**
 * 单机故障排行 TOP10 横向柱。
 */
export function VehicleFaultRankBar({ data }: VehicleFaultRankBarProps) {
    const { t } = useI18n();
    const theme = useChartTheme();

    const sorted = useMemo(
        () =>
            [...data]
                .sort((a, b) => b.faultCount - a.faultCount || a.vehicleId.localeCompare(b.vehicleId))
                .slice(0, 10),
        [data],
    );

    const containerRef = useECharts(
        useMemo(() => {
            return {
                aria: { enabled: true, label: { description: t("单机故障排行 TOP10 横向柱图") }, decal: { show: true } },
                tooltip: {
                    trigger: "axis",
                    axisPointer: { type: "shadow" },
                    backgroundColor: theme.tooltipBg,
                    borderColor: theme.tooltipBorder,
                },
                grid: { left: 70, right: 24, top: 16, bottom: 24 },
                xAxis: {
                    type: "value",
                    axisLabel: { color: theme.colorTextSecondary },
                    splitLine: { lineStyle: { color: theme.splitLineColor } },
                },
                yAxis: {
                    type: "category",
                    inverse: true,
                    data: sorted.map((d) => d.vehicleId),
                    axisLabel: { color: theme.colorTextSecondary },
                    axisLine: { lineStyle: { color: theme.splitLineColor } },
                },
                series: [
                    {
                        type: "bar",
                        data: sorted.map((d) => d.faultCount),
                        itemStyle: { color: theme.warningColor },
                        barMaxWidth: 18,
                        label: { show: true, position: "right", color: theme.colorTextSecondary },
                    },
                ],
            };
        }, [sorted, t, theme]),
    );

    if (!data.length) {
        return <Empty description={t("暂无数据")} />;
    }

    return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
