/**
 * @description 车辆状态统计：车辆 × 状态 时长堆叠柱
 *
 * 每辆车一根柱，按状态堆叠（小时），状态顺序固定为枚举语义顺序
 * （VEHICLE_STATISTIC_STATE_ORDER），跨图表保持一致认知。
 * 系列色取自状态固定语义映射；Tooltip 逐状态展示人性化时长（不展示合计行）。
 * 默认展示全部车辆，横轴自动抽稀标签；底部滑块可缩放、平移查看局部车辆。
 * 固定绘图区与标签区的空间，避免长车名和大量车辆挤压柱体。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import type { BarSeriesOption, ComposeOption } from "echarts";
import type { AriaComponentOption, DataZoomComponentOption, GridComponentOption, LegendComponentOption, TooltipComponentOption } from "echarts/components";
import { format } from "echarts/core";
import { useI18n } from "@/hooks/useI18n";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import { formatDuration } from "@/pages/AnalyzeVisual/DashboardShared/model/formatters";
import { VEHICLE_STATISTIC_STATE_ORDER, stateColor, stateLabelKey } from "@/pages/AnalyzeVisual/VehicleStatus/model/states";
import type { VehicleDurationGroup } from "@/pages/AnalyzeVisual/VehicleStatus/model/selectors";

export interface VehicleStateStackedBarProps {
    /** 按车辆分组的时长聚合 */
    data: VehicleDurationGroup[];
}

/**
 * 声明本图实际使用的组件，缩放配置与按需注册保持一致。
 * 使用精确类型检查坐标轴、堆叠系列和缩放交互配置。
 */
type StackedBarOption = ComposeOption<BarSeriesOption | AriaComponentOption | DataZoomComponentOption | GridComponentOption | LegendComponentOption | TooltipComponentOption>;

/**
 * 车辆 × 状态 时长堆叠柱（单位：小时）。
 */
export function VehicleStateStackedBar({ data }: VehicleStateStackedBarProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();

    // 本次数据中实际出现过的状态（保持枚举语义顺序），只为出现过的状态建系列
    const presentStates = useMemo(
        () =>
            VEHICLE_STATISTIC_STATE_ORDER.filter((state) =>
                data.some((group) => (group.stateSeconds[state] ?? 0) > 0),
            ),
        [data],
    );

    const containerRef = useECharts(
        useMemo<StackedBarOption>(() => {
            /*
             * 缩放后的标签索引从可见范围重新计数，不能用它访问原始数组。
             * 按唯一车辆标识查找名称，保证平移后标签始终对应当前柱体。
             */
            const vehicleNames = new Map(data.map((group) => [group.vehicleKey, group.vehicleName]));
            return {
                /*
                 * 百车以上关闭过渡动画，减少批量柱体更新的绘制开销。
                 * 保留所有车辆与状态数据，不进行截断或抽样。
                 */
                animation: data.length <= 100,
                aria: { enabled: true, label: { description: t("车辆状态时长堆叠柱图") }, decal: { show: true } },
                tooltip: {
                    trigger: "axis",
                    confine: true,
                    axisPointer: { type: "shadow" },
                    backgroundColor: theme.tooltipBg,
                    borderColor: theme.tooltipBorder,
                    textStyle: { color: theme.colorText },
                    extraCssText: "max-width: min(360px, 80vw); white-space: normal; overflow-wrap: anywhere;",
                    /*
                     * 根据数据索引读取完整车名，重名车辆也能分别展示。
                     * 外部文本转义后插入提示框，时长保留原始秒数精度。
                     */
                    formatter: (params) => {
                        const items = Array.isArray(params) ? params : [params];
                        const group = data[items[0]?.dataIndex];
                        if (!group) return "";
                        const lines = items.map(
                            (p) => `${p.marker ?? ""}${format.encodeHTML(p.seriesName ?? "")}: ${formatDuration(Number(p.value) * 3600 * 1000, locale)}`,
                        );
                        return [format.encodeHTML(group.vehicleName), ...lines].join("<br/>");
                    },
                },
                legend: {
                    type: "scroll",
                    bottom: 0,
                    data: presentStates.map((s) => t(stateLabelKey(s))),
                    textStyle: { color: theme.colorTextSecondary },
                },
                /*
                 * 分别为轴标签、缩放条和图例预留空间，不让长车名参与无限扩张。
                 * 默认全量展示，缩放条两端可调节范围，中间区域可拖动浏览。
                 */
                grid: { left: 12, right: 20, top: 36, bottom: 100, containLabel: true },
                dataZoom: [
                    {
                        type: "slider",
                        xAxisIndex: 0,
                        start: 0,
                        end: 100,
                        minValueSpan: Math.min(4, Math.max(0, data.length - 1)),
                        bottom: 40,
                        height: 24,
                        showDetail: false,
                        brushSelect: false,
                        borderColor: theme.splitLineColor,
                        textStyle: { color: theme.colorTextSecondary },
                        filterMode: "filter",
                        throttle: 80,
                    },
                    {
                        type: "inside",
                        xAxisIndex: 0,
                        zoomOnMouseWheel: "ctrl",
                        moveOnMouseWheel: false,
                        moveOnMouseMove: true,
                        filterMode: "filter",
                        throttle: 80,
                    },
                ],
                xAxis: {
                    type: "category",
                    /*
                     * 使用唯一标识作为类目，避免同名车辆在缩放定位时混淆。
                     * 标签自动间隔并截断，完整名称通过悬浮提示查看。
                     */
                    data: data.map((group) => group.vehicleKey),
                    axisLabel: {
                        color: theme.colorTextSecondary,
                        fontSize: 11,
                        interval: "auto",
                        hideOverlap: true,
                        width: 112,
                        overflow: "truncate",
                        rotate: 0,
                        margin: 12,
                        /*
                         * 长车名保留开头和末尾，避免相同前缀遮住用于区分车辆的编号。
                         * 先缩短文本再交给自动间隔计算，使缩放后能显示更多有效标签。
                         */
                        formatter: (value) => {
                            const name = vehicleNames.get(value) ?? value;
                            const characters = Array.from(name);
                            return characters.length > 10
                                ? `${characters.slice(0, 4).join("")}…${characters.slice(-5).join("")}`
                                : name;
                        },
                    },
                    axisTick: { alignWithLabel: true },
                    axisLine: { lineStyle: { color: theme.splitLineColor } },
                },
                yAxis: {
                    type: "value",
                    name: t("小时"),
                    /*
                     * 单位文字跟随主题，保证深色背景下仍清晰可读。
                     * 数值轴保持较少分段，为全量车辆提供稳定的比较基准。
                     */
                    nameTextStyle: { color: theme.colorTextSecondary },
                    splitNumber: 4,
                    axisLabel: { color: theme.colorTextSecondary },
                    splitLine: { lineStyle: { color: theme.splitLineColor } },
                },
                series: presentStates.map((state) => ({
                    name: t(stateLabelKey(state)),
                    type: "bar",
                    stack: "total",
                    barMaxWidth: 36,
                    barCategoryGap: "25%",
                    itemStyle: { color: stateColor(state) },
                    emphasis: { focus: "series" },
                    /*
                     * 小时数不提前四舍五入，避免短时状态变成零而消失。
                     * 提示框负责时长格式化，柱体保持原始数值比例。
                     */
                    data: data.map((group) => (group.stateSeconds[state] ?? 0) / 3600),
                })),
            };
        /*
         * 翻译由语言变化驱动，避免每次父组件渲染产生的新翻译函数重置图表。
         * 因此表格筛选等无关操作不会清空用户已调整的缩放范围和图例选择。
         */
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [data, presentStates, locale, theme]),
    );

    if (!data.length) {
        return <Empty description={t("暂无数据")} />;
    }

    /*
     * 提供真实内容高度，避免绝对定位子节点使面板的弹性容器收缩。
     * 百车全景下仍为柱体保留足够高度，宽度随面板自适应。
     */
    return <div ref={containerRef} style={{ width: "100%", height: 460, minWidth: 0 }} />;
}
