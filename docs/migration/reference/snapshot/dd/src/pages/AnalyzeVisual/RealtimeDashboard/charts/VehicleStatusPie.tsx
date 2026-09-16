/**
 * @description 实时看板：AGV 状态分布环形饼图（§5.1）
 *
 * 运行、空闲、充电、故障、离线；中心显示在线数。
 * 在线数 = 运行 + 空闲 + 充电 + 故障（离线不计入在线，§6.1）。
 * 依赖 useChartTheme 派生系列色，locale 与数据驱动 option useMemo（§9.2）。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import { VEHICLE_STATUS_LABEL } from "@/pages/AnalyzeVisual/DashboardShared/model/enumLabels";
import { VEHICLE_STATUS_ORDER } from "@/pages/AnalyzeVisual/RealtimeDashboard/model/types";
import type { VehicleStatusItem } from "@/pages/AnalyzeVisual/RealtimeDashboard/model/types";

export interface VehicleStatusPieProps {
    data: VehicleStatusItem[];
    /** 中心展示的在线数 */
    onlineCount: number;
}

/**
 * 状态色：与告警/状态语义一致（§10.2 表格状态色规范）。
 * 运行=成功色、空闲=信息色、充电=警告色、故障=错误色、离线=次要色。
 */
function useStatusColors() {
    const theme = useChartTheme();
    return useMemo<Record<string, string>>(
        () => ({
            running: theme.successColor,
            idle: theme.infoColor,
            charging: theme.warningColor,
            fault: theme.errorColor,
            offline: theme.token.colorTextQuaternary,
        }),
        [theme],
    );
}

/**
 * AGV 状态分布环形饼图。
 */
export function VehicleStatusPie({ data, onlineCount }: VehicleStatusPieProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();
    const statusColors = useStatusColors();
    const containerRef = useECharts(
        useMemo(() => {
            // 保留全部 5 类状态（含 0 值）：0 值不渲染扇区，但图例仍需展示，
            // 让用户能看到完整的状态分类口径
            const seriesData = VEHICLE_STATUS_ORDER.map((status) => {
                const item = data.find((d) => d.status === status);
                return {
                    name: t(VEHICLE_STATUS_LABEL[status]),
                    value: item?.count ?? 0,
                    itemStyle: { color: statusColors[status] },
                };
            });

            return {
                aria: { enabled: true, label: { description: t("AGV 状态分布环形图") }, decal: { show: true } },
                tooltip: { trigger: "item", backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBorder },
                legend: {
                    bottom: 0,
                    // 显式指定图例项：固定展示 5 类状态，
                    // 同时排除中心文字叠加系列的占位数据项（name: "center"）
                    data: seriesData.map((d) => d.name),
                    textStyle: { color: theme.colorTextSecondary },
                },
                series: [
                    {
                        type: "pie",
                        radius: ["45%", "70%"],
                        center: ["50%", "45%"],
                        avoidLabelOverlap: true,
                        label: { show: false },
                        emphasis: { label: { show: true, fontSize: 14, fontWeight: 700, color: theme.colorText } },
                        data: seriesData,
                    },
                    {
                        // 中心文字：在线数（§5.1）
                        type: "pie",
                        silent: true,
                        radius: ["0%", "0%"],
                        center: ["50%", "45%"],
                        label: {
                            show: true,
                            position: "center",
                            formatter: () => `{a|${onlineCount}}\n{b|${t("在线 AGV")}}`,
                            rich: {
                                a: { fontSize: 28, fontWeight: 700, color: theme.colorText, lineHeight: 34 },
                                b: { fontSize: 12, color: theme.colorTextSecondary, lineHeight: 16 },
                            },
                        },
                        data: [{ value: 1, name: "center" }],
                    },
                ],
            };
        }, [data, onlineCount, t, locale, theme, statusColors]),
    );

    if (!data.length || data.every((d) => d.count === 0)) {
        return <Empty description={t("暂无数据")} />;
    }

    return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
