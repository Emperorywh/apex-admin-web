/**
 * @description AGV 利用率排行横向柱（原效率分析页面迁入）
 *
 * 降序；<50% 红、50%–<70% 黄、≥70% 绿（阈值见 policy.ts）。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import type { BarSeriesOption, ComposeOption } from "echarts";
import type { AriaComponentOption, DataZoomComponentOption, GridComponentOption, TooltipComponentOption } from "echarts/components";
import { format } from "echarts/core";
import { useI18n } from "@/hooks/useI18n";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import { UTILIZATION_THRESHOLDS } from "@/pages/AnalyzeVisual/DashboardShared/model/policy";
import { formatPercentage } from "@/pages/AnalyzeVisual/DashboardShared/model/formatters";
import type { VehicleUtilizationItem } from "@/pages/AnalyzeVisual/TaskStatisticsReport/model/types";

export interface VehicleUtilizationBarProps {
    data: VehicleUtilizationItem[];
}

/*
 * 固定可视窗口最多十辆车，每行预留独立的柱体和数值空间。
 * 全量排行保留在图表中，通过纵向滑块或滚轮浏览后续车辆。
 */
const VISIBLE_VEHICLE_COUNT = 10;
export const VEHICLE_UTILIZATION_CHART_HEIGHT = 380;
type UtilizationBarOption = ComposeOption<BarSeriesOption | AriaComponentOption | DataZoomComponentOption | GridComponentOption | TooltipComponentOption>;

/**
 * 根据利用率映射颜色。
 */
function utilizationColor(ratio: number | null, theme: ReturnType<typeof useChartTheme>): string {
    if (ratio === null || Number.isNaN(ratio)) return theme.token.colorTextQuaternary;
    if (ratio < UTILIZATION_THRESHOLDS.LOW) return theme.errorColor;
    if (ratio < UTILIZATION_THRESHOLDS.HIGH) return theme.warningColor;
    return theme.successColor;
}

/**
 * AGV 利用率排行横向柱。
 */
export function VehicleUtilizationBar({ data }: VehicleUtilizationBarProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();

    const sorted = useMemo(
        () => [...data].sort((a, b) => (b.utilization ?? 0) - (a.utilization ?? 0)),
        [data],
    );

    const containerRef = useECharts(
        useMemo<UtilizationBarOption>(() => {
            const scrollable = sorted.length > VISIBLE_VEHICLE_COUNT;
            return {
                /*
                 * 单系列排行使用纯色柱体，避免密集纹理干扰数值阅读。
                 * 保留无障碍描述，百车以上关闭动画以降低滚动绘制开销。
                 */
                animation: sorted.length <= 100,
                aria: { enabled: true, label: { description: t("AGV 利用率排行横向柱图") }, decal: { show: false } },
                tooltip: {
                    trigger: "axis",
                    confine: true,
                    axisPointer: { type: "shadow" },
                    backgroundColor: theme.tooltipBg,
                    borderColor: theme.tooltipBorder,
                    textStyle: { color: theme.colorText },
                    extraCssText: "max-width: min(360px, 80vw); white-space: normal; overflow-wrap: anywhere;",
                    /*
                     * 按原始数据索引获取完整车名，滚动及重名时仍对应正确车辆。
                     * 车名经过转义再进入提示框；缺失利用率显示占位，区别于实际零值。
                     */
                    formatter: (params) => {
                        const item = Array.isArray(params) ? params[0] : params;
                        const vehicle = sorted[item?.dataIndex];
                        if (!vehicle) return "";
                        return `${format.encodeHTML(vehicle.vehicleId)}<br/>${item.marker ?? ""}${format.encodeHTML(t("利用率"))}: ${formatPercentage(vehicle.utilization, locale)}`;
                    },
                },
                /*
                 * 车名、百分比和滑块各自预留空间，绘图区不再被长车名挤压。
                 * 滑块锁定窗口大小，保证滚动到任意位置都不会重新堆叠全部标签。
                 */
                grid: { left: 156, right: scrollable ? 80 : 60, top: 12, bottom: 32, outerBoundsMode: "none" },
                dataZoom: scrollable ? [
                    {
                        type: "slider",
                        yAxisIndex: 0,
                        startValue: 0,
                        endValue: VISIBLE_VEHICLE_COUNT - 1,
                        zoomLock: true,
                        right: 4,
                        top: 12,
                        bottom: 32,
                        width: 12,
                        showDetail: false,
                        showDataShadow: false,
                        brushSelect: false,
                        borderColor: theme.splitLineColor,
                        fillerColor: theme.token.colorPrimaryBg,
                        filterMode: "filter",
                        throttle: 80,
                    },
                    {
                        type: "inside",
                        yAxisIndex: 0,
                        startValue: 0,
                        endValue: VISIBLE_VEHICLE_COUNT - 1,
                        zoomLock: true,
                        zoomOnMouseWheel: false,
                        moveOnMouseWheel: true,
                        moveOnMouseMove: true,
                        filterMode: "filter",
                        throttle: 80,
                    },
                ] : [],
                xAxis: {
                    type: "value",
                    max: 1,
                    axisLabel: {
                        color: theme.colorTextSecondary,
                        formatter: (v: number) => `${Math.round(v * 100)}%`,
                    },
                    splitLine: { lineStyle: { color: theme.splitLineColor } },
                },
                yAxis: {
                    type: "category",
                    inverse: true,
                    /*
                     * 类目使用排行索引，避免相同显示名称合并或定位混淆。
                     * 长名称保留首尾以区分测试车辆，完整名称留在悬浮提示中。
                     */
                    data: sorted.map((_vehicle, index) => String(index)),
                    axisLabel: {
                        color: theme.colorTextSecondary,
                        interval: 0,
                        width: 140,
                        overflow: "truncate",
                        margin: 12,
                        formatter: (value: string) => {
                            const name = sorted[Number(value)]?.vehicleId ?? value;
                            const characters = Array.from(name);
                            return characters.length > 16
                                ? `${characters.slice(0, 7).join("")}…${characters.slice(-8).join("")}`
                                : name;
                        },
                    },
                    axisTick: { show: false },
                    axisLine: { show: false },
                },
                series: [
                    {
                        type: "bar",
                        data: sorted.map((d) => ({
                            value: d.utilization ?? 0,
                            itemStyle: { color: utilizationColor(d.utilization, theme) },
                        })),
                        barMaxWidth: 18,
                        /*
                         * 每个可见条形独立显示数值，并为极端窄容器启用碰撞隐藏。
                         * 柱体按原始比例绘制，数值格式化复用报表统一规则。
                         */
                        labelLayout: { hideOverlap: true },
                        label: {
                            show: true,
                            position: "right",
                            distance: 8,
                            formatter: (params) => formatPercentage(sorted[params.dataIndex]?.utilization ?? null, locale),
                            color: theme.colorTextSecondary,
                        },
                    },
                ],
            };
        /*
         * 翻译随语言更新，避免父组件新建的翻译函数反复重置滚动位置。
         * 数据或主题真正变化时才重新应用图表配置。
         */
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [sorted, locale, theme]),
    );

    if (!data.length) {
        return <Empty description={t("暂无数据")} />;
    }

    /*
     * 使用实际内容高度撑开面板的弹性容器，修复绝对定位导致的高度收缩。
     * 图表高度与面板约定一致，车辆数量增加时通过内部滚动展示。
     */
    return <div ref={containerRef} style={{ width: "100%", height: VEHICLE_UTILIZATION_CHART_HEIGHT, minWidth: 0, flexShrink: 0 }} />;
}
