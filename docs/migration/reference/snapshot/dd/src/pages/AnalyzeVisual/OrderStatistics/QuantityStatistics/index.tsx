import { useEffect, useState, useRef, memo, useCallback } from "react";
import { Form, DatePicker, Row, Col, Select, Button, message } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useLocalStorageState } from "ahooks";
import * as echarts from "echarts/core";
import { TitleComponent, ToolboxComponent, LegendComponent, TooltipComponent, GridComponent } from "echarts/components";
import { BarChart } from "echarts/charts";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { orderQuantityStatistics, getSimpleVehicles } from "@/api";
import { orderTypeOptions, orderStateOptions } from "@/constants/OrderRecord/orderRecord";
import type { OrderStatisticsParams } from "@/types/AnalyzeVisual/OrderStatistics";
import type { SimpleVehicle } from "@/types/VehicleDeploy/GroupType";
import type { DatePickerProps } from "antd";
import type { BarSeriesOption } from "echarts/charts";
import type { TitleComponentOption, TooltipComponentOption, ToolboxComponentOption, LegendComponentOption, GridComponentOption } from "echarts/components";
import type { ComposeOption } from "echarts/core";
import { useI18n } from "@/hooks/useI18n";

interface BarDataItem {
    number: number;
    orderState: string;
    orderType: string;
}

type OptionType = ComposeOption<
    | BarSeriesOption
    | TitleComponentOption
    | TooltipComponentOption
    | ToolboxComponentOption
    | LegendComponentOption
    | GridComponentOption
>;

echarts.use([
    TitleComponent,
    ToolboxComponent,
    LegendComponent,
    TooltipComponent,
    GridComponent,
    BarChart,
    CanvasRenderer,
    LabelLayout
]);

const stateMap = new Map(orderStateOptions?.map(o => [o!.value, o!.label]) || []);

const CHART_COLORS = ["#5B8FF9", "#5AD8A6", "#F6BD16", "#E86452", "#6DC8EC", "#945FB9", "#FF9845", "#5D7092"];

/**
 * 根据当前主题获取适配暗黑/默认模式的文字颜色
 * @param localTheme 当前主题算法名称
 * @returns 适配后的颜色配置
 */
const getThemeColors = (localTheme?: string) => {
    const isDark = localTheme === "darkAlgorithm";
    return {
        /** 主要文字颜色（标题、标签） */
        primary: isDark ? "#ffffff" : "#1f2937",
        /** 次要文字颜色（坐标轴标签） */
        secondary: isDark ? "#9ca3af" : "#4b5563",
        /** 分割线颜色 */
        splitLine: isDark ? "#374151" : "#f0f0f0",
        /** 坐标轴线颜色 */
        axisLine: isDark ? "#4b5563" : "#d1d5db",
        /** 提示框背景色 */
        tooltipBg: isDark ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)",
        /** 提示框边框色 */
        tooltipBorder: isDark ? "#4b5563" : "#e5e7eb",
        /** 图例文字颜色 */
        legendText: isDark ? "#d1d5db" : "#4b5563",
    };
};

const QuantityBar = memo((props: { height: number; data: BarDataItem[]; title: string; t: (id: string) => string }) => {
    const { height, data, title, t } = props;
    const chartRef = useRef<HTMLDivElement>(null);
    /* 从 localStorage 读取当前主题，监听同标签页内的变化 */
    const [localTheme] = useLocalStorageState<"defaultAlgorithm" | "darkAlgorithm">("theme", {
        listenStorageChange: true
    });

    useEffect(() => {
        if (!chartRef.current) return;
        const myChart = echarts.init(chartRef.current);
        /* 获取当前主题适配颜色 */
        const colors = getThemeColors(localTheme);

        let categories: string[] = [];
        let seriesData: number[] = [];

        if (data?.length) {
            const stateSumMap = new Map<string, number>();
            for (const d of data) {
                stateSumMap.set(d.orderState, (stateSumMap.get(d.orderState) || 0) + (d.number || 0));
            }
            const orderStates = [...stateSumMap.keys()];
            categories = orderStates.map(s => t((stateMap.get(s) || s) as string));
            seriesData = orderStates.map(s => stateSumMap.get(s) || 0);
        }

        const series: BarSeriesOption[] = [{
            name: t("任务数量"),
            type: "bar",
            barMaxWidth: 80,
            barGap: "20%",
            barCategoryGap: "40%",
            emphasis: { focus: "series" },
            itemStyle: {
                borderRadius: [4, 4, 0, 0],
                color: (params) => CHART_COLORS[params.dataIndex % CHART_COLORS.length]
            },
            label: {
                show: true,
                position: "top",
                formatter: (params) => {
                    const val = params.value as number;
                    return val ? `${val}` : "";
                },
                fontSize: 12,
                color: colors.primary
            },
            data: seriesData
        }];

        const option: OptionType = {
            color: CHART_COLORS,
            title: {
                text: title,
                left: "center",
                textStyle: { fontSize: 16, fontWeight: 600, color: colors.primary }
            },
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow" },
                backgroundColor: colors.tooltipBg,
                borderColor: colors.tooltipBorder,
                textStyle: { color: colors.primary }
            },
            legend: { top: "bottom", left: "center", icon: "roundRect", itemWidth: 14, itemHeight: 10, textStyle: { color: colors.legendText } },
            grid: { left: "3%", right: "4%", bottom: "10%", containLabel: true },
            xAxis: {
                type: "category",
                data: categories,
                axisLine: { lineStyle: { color: colors.axisLine } },
                axisTick: { show: false },
                axisLabel: { color: colors.secondary }
            },
            yAxis: {
                type: "value",
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: colors.secondary },
                splitLine: { lineStyle: { color: colors.splitLine, type: "dashed" } }
            },
            series
        };
        myChart.setOption(option, true);

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === chartRef.current) {
                    myChart.resize();
                }
            }
        });
        resizeObserver.observe(chartRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, [data, localTheme, title, t]);

    return <div ref={chartRef} style={{ height }} />;
});

/**
 * 任务数量统计
 */
export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const [quantityParams, setQuantityParams] = useState<OrderStatisticsParams>({
        startTime: "",
        endTime: ""
    });

    const [orderQuantity, setOrderQuantity] = useState<BarDataItem[]>([]);
    const [simpleVehicles, setSimpleVehicles] = useState<SimpleVehicle[]>([]);
    const [loading, setLoading] = useState(false);
    const heightRef = useRef<number>(window.innerHeight - 300);

    const onStartChange: DatePickerProps["onChange"] = (_date, dateString) => {
        setQuantityParams(prev => ({
            ...prev,
            startTime: dateString as string || ""
        }));
    };

    const onEndChange: DatePickerProps["onChange"] = (_date, dateString) => {
        setQuantityParams(prev => ({
            ...prev,
            endTime: dateString as string || ""
        }));
    };

    const onOrderTypesChange = (values: string[]) => {
        setQuantityParams(prev => ({ ...prev, orderTypes: values }));
    };

    const onOrderStatesChange = (values: string[]) => {
        setQuantityParams(prev => ({ ...prev, orderStates: values }));
    };

    const onVehicleKeysChange = (values: string[]) => {
        setQuantityParams(prev => ({ ...prev, vehicleKeys: values }));
    };

    const handleQuery = useCallback(() => {
        setLoading(true);
        orderQuantityStatistics(quantityParams).then(res => {
            if (res.code === 200 && res.message === "success") {
                setOrderQuantity(res?.data || []);
            } else {
                message.warning(t("查询任务数量统计出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询任务数量统计出错") + err?.message);
            }
        }).finally(() => {
            setLoading(false);
        });
    }, [quantityParams]);

    useEffect(() => {
        handleQuery();
        getSimpleVehicles().then(res => {
            if (res.code === 200 && res.message === "success") {
                setSimpleVehicles(res?.data || []);
            } else {
                message.warning(t("查询车辆出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆出错") + err?.message);
            }
        });
    }, []);

    return (
        <>
            <Form
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                autoComplete="off"
            >
                <Row gutter={2}>
                    <Col span={6}>
                        <Form.Item<OrderStatisticsParams>
                            label={t("开始时间")}
                            name="startTime"
                        >
                            <DatePicker
                                style={{ width: "100%" }}
                                placeholder={t("请选择开始时间")}
                                showTime
                                allowClear
                                needConfirm
                                preserveInvalidOnBlur
                                onChange={onStartChange}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item<OrderStatisticsParams>
                            label={t("结束时间")}
                            name="endTime"
                        >
                            <DatePicker
                                style={{ width: "100%" }}
                                placeholder={t("请选择结束时间")}
                                showTime
                                allowClear
                                needConfirm
                                preserveInvalidOnBlur
                                onChange={onEndChange}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item<OrderStatisticsParams>
                            label={t("任务类型")}
                            name="orderTypes"
                        >
                            <Select
                                mode="multiple"
                                allowClear
                                placeholder={t("请选择任务类型")}
                                options={orderTypeOptions?.map(o => ({ ...o, label: t(o.label as string) }))}
                                onChange={onOrderTypesChange}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item<OrderStatisticsParams>
                            label={t("任务状态")}
                            name="orderStates"
                        >
                            <Select
                                mode="multiple"
                                allowClear
                                placeholder={t("请选择任务状态")}
                                options={orderStateOptions?.map(o => ({ ...o, label: t(o.label as string) }))}
                                onChange={onOrderStatesChange}
                            />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={2}>
                    <Col span={6}>
                        <Form.Item<OrderStatisticsParams>
                            label={t("任务车辆")}
                            name="vehicleKeys"
                        >
                            <Select
                                mode="multiple"
                                allowClear
                                showSearch
                                optionFilterProp="name"
                                fieldNames={{ label: "name", value: "key" }}
                                placeholder={t("请选择任务车辆")}
                                options={simpleVehicles}
                                onChange={onVehicleKeysChange}
                                popupMatchSelectWidth={350}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item wrapperCol={{ offset: 6, span: 18 }}>
                            <Button
                                type="primary"
                                icon={<SearchOutlined />}
                                loading={loading}
                                onClick={handleQuery}
                            >
                                {t("查询")}
                            </Button>
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
            <QuantityBar
                height={heightRef.current}
                data={orderQuantity}
                title={t("任务数量统计")}
                t={t}
            />
        </>
    );
};
