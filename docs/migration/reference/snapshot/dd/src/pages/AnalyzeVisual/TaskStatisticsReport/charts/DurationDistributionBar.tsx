/**
 * @description 任务统计：任务执行时长分布柱（§5.2）
 *
 * 区间桶：<1m、1–2m、2–3m、3–5m、5–10m、>10m。
 * 判空与 markLine 显隐统一以分布桶计数总和为依据
 * （真实接口仅提供分桶计数，没有原始耗时样本，不能再用样本数判空）。
 * P50/P90 需要原始样本：mock 明细可算出精确值，真实接口无样本时传 null，不显示标线（§5.2）。
 */
import { Empty } from "antd";
import { useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import { formatDuration } from "@/pages/AnalyzeVisual/DashboardShared/model/formatters";
import { useECharts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useECharts";
import { useChartTheme } from "@/pages/AnalyzeVisual/DashboardShared/echarts/useChartTheme";
import {
    DURATION_BUCKET_BOUNDS_MS,
    DURATION_BUCKET_ORDER,
    type DurationBucket,
} from "@/pages/AnalyzeVisual/TaskStatisticsReport/model/types";

export interface DurationDistributionBarProps {
    distribution: DurationBucket[];
    /** P50/P90 精确值（毫秒）；无原始耗时样本时传 null，对应标线不显示 */
    p50Ms: number | null;
    p90Ms: number | null;
}

/**
 * 找到数值落入的桶 index（左闭右开）。
 */
function findBucketIndex(valueMs: number): number {
    for (let i = 0; i < DURATION_BUCKET_ORDER.length; i++) {
        const bounds = DURATION_BUCKET_BOUNDS_MS[DURATION_BUCKET_ORDER[i]];
        if (valueMs >= bounds.min && valueMs < bounds.max) return i;
    }
    return DURATION_BUCKET_ORDER.length - 1;
}

/**
 * 时长分布柱 + P50/P90 markline。
 */
export function DurationDistributionBar({ distribution, p50Ms, p90Ms }: DurationDistributionBarProps) {
    const { t, locale } = useI18n();
    const theme = useChartTheme();

    const bucketLabels = useMemo(
        () => [t("<1m"), t("1–2m"), t("2–3m"), t("3–5m"), t("5–10m"), t(">10m")],
        [t],
    );

    // 分布桶计数总和：判空与 markLine 显隐的统一依据
    const totalCount = useMemo(() => distribution.reduce((sum, d) => sum + d.count, 0), [distribution]);

    const containerRef = useECharts(
        useMemo(() => {
            const markLines = [
                { name: "P50", valueMs: p50Ms },
                { name: "P90", valueMs: p90Ms },
            ].filter((m): m is { name: string; valueMs: number } => m.valueMs !== null && m.valueMs !== undefined);

            return {
                aria: { enabled: true, label: { description: t("任务执行时长分布柱图") }, decal: { show: true } },
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBorder },
                grid: { left: 40, right: 16, top: 24, bottom: 24 },
                xAxis: {
                    type: "category",
                    data: bucketLabels,
                    axisLabel: { color: theme.colorTextSecondary, fontSize: 11 },
                    axisLine: { lineStyle: { color: theme.splitLineColor } },
                },
                yAxis: {
                    type: "value",
                    axisLabel: { color: theme.colorTextSecondary },
                    splitLine: { lineStyle: { color: theme.splitLineColor } },
                },
                series: [
                    {
                        type: "bar",
                        itemStyle: { color: theme.seriesColors[0] },
                        barMaxWidth: 40,
                        data: DURATION_BUCKET_ORDER.map((key) => distribution.find((d) => d.bucket === key)?.count ?? 0),
                        // 仅在有分布数据且拿到 P50/P90 精确值时显示标线（§5.2）
                        markLine: totalCount > 0 && markLines.length
                            ? {
                                  symbol: ["none", "none"],
                                  label: {
                                      formatter: (params: { name: string; data: { valueMs?: number } }) => {
                                          const match = markLines.find((m) => m.name === params.name);
                                          return match ? formatDuration(match.valueMs, locale) : "";
                                      },
                                      color: theme.colorText,
                                  },
                                  lineStyle: { type: "dashed" },
                                  data: markLines.map((m) => ({
                                      name: m.name,
                                      // 标线落在包含该值的区间桶的 xAxis index（§5.2）
                                      xAxis: findBucketIndex(m.valueMs),
                                  })),
                              }
                            : undefined,
                    },
                ],
            };
        }, [distribution, totalCount, p50Ms, p90Ms, t, locale, theme, bucketLabels]),
    );

    if (!totalCount) {
        return <Empty description={t("暂无数据")} />;
    }

    return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
