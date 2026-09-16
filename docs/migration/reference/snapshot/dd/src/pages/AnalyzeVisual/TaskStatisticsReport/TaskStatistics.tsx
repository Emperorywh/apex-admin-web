/**
 * @description 任务统计报表（§5.2）
 *
 *   - 4 KPI：总任务数、完成数和完成率、失败数与取消数、已完成任务平均执行时长
 *   - 4 图：任务量趋势堆叠柱、时长分布柱(P50/P90)、
 *     AGV 利用率排行横向柱、利用率趋势折线（后两图从效率分析页面迁入）
 *
 * 请求策略：
 *   - 全部 KPI / 图表共用页面上方工具栏：TimeRangePicker 选统计区间（默认近 7 天）、
 *     车辆多选（仅任务统计接口消费，空 = 全部车辆）、查询按钮。
 *     工具栏为草稿态编辑，点「查询」才把草稿应用为生效条件并触发请求；
 *     挂载时按默认条件自动查询一次。
 *   - 任务统计 KPI / 图表（任务量趋势、时长分布）请求 taskStatistics（区间 + 车辆）；
 *     AGV 利用率排行 + 利用率趋势按同一区间请求 agvStateStatistics / agvExecutingTimeStatistics。
 *
 * 数据源（§7.3）：已联调真实接口（HttpDashboardRepository）。
 * 任务统计接口按天返回窗口内数据，趋势桶恒为自然日；
 * 利用率两图按同一所选区间请求。
 * 接口不提供任务类型分布与任务明细，页面不展示对应区域（明细表已移除）。
 * 请求失败时整页不阻断（§15 降级）：KPI 显示 "--"、图表展示空状态，仅留受控日志。
 */
import dayjs from "dayjs";
import { useRequest } from "ahooks";
import { ClockCircleOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { Button, Select } from "antd";
import { useI18n } from "@/hooks/useI18n";
import { agvExecutingTimeStatistics, agvStateStatistics, getSimpleVehicles } from "@/api";
import { BUSINESS_TIMEZONE } from "@/pages/AnalyzeVisual/DashboardShared/model/businessTime";
import { ChartPanel } from "@/pages/AnalyzeVisual/DashboardShared/components/ChartPanel";
import { KpiCard } from "@/pages/AnalyzeVisual/DashboardShared/components/KpiCard";
import { dashboardRepository } from "@/pages/AnalyzeVisual/DashboardShared/data/HttpDashboardRepository";
import { formatInteger, formatPercentage } from "@/pages/AnalyzeVisual/DashboardShared/model/formatters";
import { buildScalarKpiViewModel } from "@/pages/AnalyzeVisual/DashboardShared/model/kpiViewModel";
import { TASK_STATISTICS_REPORT_DAYS } from "@/pages/AnalyzeVisual/DashboardShared/model/policy";
import type { TaskStatisticsData } from "@/pages/AnalyzeVisual/TaskStatisticsReport/model/types";
import { TaskVolumeStackedBar } from "@/pages/AnalyzeVisual/TaskStatisticsReport/charts/TaskVolumeStackedBar";
import { DurationDistributionBar } from "@/pages/AnalyzeVisual/TaskStatisticsReport/charts/DurationDistributionBar";
// 以下两图从效率分析页面迁入：AGV 利用率排行 + 利用率与空跑率趋势
import type { EfficiencyTrendPoint, VehicleUtilizationItem } from "@/pages/AnalyzeVisual/TaskStatisticsReport/model/types";
/*
 * 排行图与面板共享固定高度，车辆数量增加时在图内滚动浏览。
 * 避免按全量车辆拉长面板，同时保证每一行都有足够的阅读空间。
 */
import { VehicleUtilizationBar, VEHICLE_UTILIZATION_CHART_HEIGHT } from "@/pages/AnalyzeVisual/TaskStatisticsReport/charts/VehicleUtilizationBar";
import { EfficiencyTrendLine } from "@/pages/AnalyzeVisual/TaskStatisticsReport/charts/EfficiencyTrendLine";
import type { DailyStateDuration, VehicleExecutingDuration, VehicleStatisticState } from "@/types/AnalyzeVisual/VehicleStateStatistics";
import type { SimpleVehicle } from "@/types/VehicleDeploy/GroupType";
import TimeRangePicker, { type TimeRangeValue } from "@/components/TimeRangePicker";

/**
 * AGV 利用率排行统计的状态集合：
 * 执行作业 + 执行充电 + 执行停靠（三类时长之和 / 统计窗口 = 利用率）
 */
const VEHICLE_UTILIZATION_STATES: VehicleStatisticState[] = [
    "EXECUTING_WORK",
    "EXECUTING_CHARGE",
    "EXECUTING_PARK",
];

/**
 * AGV 各状态总时长统计 → 利用率排行数据。
 * 按车辆分组累加各状态时长（秒），除以有效统计窗口秒数得到利用率（0–1 小数）；
 * windowSeconds 由调用方按 min(区间终点, 当前时刻) 截断后传入，不计入未来时间。
 * 展示名优先 vehicleName，空时回退 vehicleKey。
 */
function mapExecutingTimeToVehicleRanking(
    durations: VehicleExecutingDuration[],
    windowSeconds: number,
): VehicleUtilizationItem[] {
    // 按车辆分组，累加各状态时长（秒）
    const byVehicle = new Map<string, { vehicleId: string; activeSeconds: number }>();
    for (const item of durations) {
        const entry = byVehicle.get(item.vehicleKey);
        if (entry) {
            entry.activeSeconds += item.totalDurationSeconds ?? 0;
        } else {
            byVehicle.set(item.vehicleKey, {
                vehicleId: item.vehicleName || item.vehicleKey,
                activeSeconds: item.totalDurationSeconds ?? 0,
            });
        }
    }
    return Array.from(byVehicle.values()).map(({ vehicleId, activeSeconds }) => ({
        vehicleId,
        activeDurationMs: activeSeconds * 1000,
        availableDurationMs: windowSeconds * 1000,
        utilization: windowSeconds > 0 ? activeSeconds / windowSeconds : null,
    }));
}

/** 业务时区自然日（yyyy-MM-dd）格式校验：非法日期防御性跳过，避免产生 Invalid 桶边界 */
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * AGV 状态每日时长 → 利用率趋势（按天）。
 * 每天利用率 = 当天三种有效状态总时长 /（当天计入统计的秒数 × 当天车辆数）；
 * 接口已按天汇总有效状态时长，车辆数使用同一天返回的 vehicleCount。
 * 每车统计秒数为当天自然日桶与有效窗口 [start, min(end, now)] 的交集秒数：
 * 整天在窗口内为 86400 秒；首末非整天只算区间实际覆盖部分；
 * 今天只算到当前时刻（接口无未来数据，不把未过完的时间计入分母），
 * 时间窗口与 AGV 利用率排行图口径一致，趋势额外按当天车辆数计算平均利用率。
 * 从 start 到 end 按天升序，缺失天按 0 补齐（与任务量趋势口径一致）；
 * 整天都在有效窗口之外（如未来天），或已有记录但车辆数无效时，返回 null 断开折线。
 */
function mapStateDurationsToUtilizationTrend(
    durations: DailyStateDuration[],
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    now: dayjs.Dayjs,
): EfficiencyTrendPoint[] {
    /*
     * 新接口每天返回一条汇总记录，包含有效状态总时长和当天车辆数。
     * 按日期保留完整记录，确保分子与分母使用同一天的数据。
     */
    const dailyDurations = new Map<string, DailyStateDuration>();
    for (const item of durations) {
        const dateStr = typeof item.date === "string" ? item.date.slice(0, 10) : "";
        if (!BUSINESS_DATE_PATTERN.test(dateStr)) continue;
        dailyDurations.set(dateStr, item);
    }
    // 有效统计终点：接口不含未来数据，区间终点超过当前时刻时按当前时刻截断
    const effectiveEnd = end.isBefore(now) ? end : now;
    // 从 start 到 end 按天升序，缺失天按 0 补齐
    const trend: EfficiencyTrendPoint[] = [];
    const startDay = start.startOf("day");
    const totalDays = end.startOf("day").diff(startDay, "day") + 1;
    for (let i = 0; i < totalDays; i++) {
        const dayStart = startDay.add(i, "day");
        const dayEnd = dayStart.add(1, "day");
        /*
         * 当天自然日与有效窗口的交集秒数乘以当天车辆数，得到车队总可用秒数。
         * 缺失日期延续补零逻辑；已有记录但车辆数无效时不计算，避免除零或误按单车计算。
         */
        const overlapStart = dayStart.isAfter(start) ? dayStart : start;
        const overlapEnd = dayEnd.isBefore(effectiveEnd) ? dayEnd : effectiveEnd;
        const overlapSeconds = overlapEnd.diff(overlapStart, "second");
        const dailyDuration = dailyDurations.get(dayStart.format("YYYY-MM-DD"));
        let utilization: number | null = null;
        if (overlapSeconds > 0) {
            if (!dailyDuration) {
                utilization = 0;
            } else if (Number.isFinite(dailyDuration.vehicleCount) && dailyDuration.vehicleCount > 0) {
                utilization = (dailyDuration.totalDurationSeconds ?? 0) / (overlapSeconds * dailyDuration.vehicleCount);
            }
        }
        trend.push({
            bucketStart: dayStart.toISOString(),
            bucketEnd: dayEnd.toISOString(),
            utilization,
        });
    }
    return trend;
}

/**
 * 初始统计区间：近 TASK_STATISTICS_REPORT_DAYS 个自然日
 * [今天-(N-1)天 00:00:00, 今天 23:59:59]，与 TimeRangePicker 的 lastNDays(N) 口径一致。
 */
function initialStatRange(): [dayjs.Dayjs, dayjs.Dayjs] {
    const now = dayjs.tz(Date.now(), BUSINESS_TIMEZONE);
    return [now.subtract(TASK_STATISTICS_REPORT_DAYS - 1, "day").startOf("day"), now.endOf("day")];
}

/**
 * 任务统计报表主组件。
 * 计算方式说明统一从语言文件读取，中文文案使用业务名称、中文状态和单位。
 * 说明中保留最终状态与创建时间的统计口径区别，百分位耗时使用中文名称。
 */
export function TaskStatistics() {
    const { t, locale } = useI18n();
    const [data, setData] = useState<TaskStatisticsData | null>(null);
    /*
     * 工具栏草稿态：统计区间与车辆筛选。
     * 草稿变更不触发请求，点「查询」才应用为生效条件（与故障明细筛选区交互约定一致）。
     */
    const [rangeDraft, setRangeDraft] = useState<TimeRangeValue>(() => initialStatRange());
    // 车辆筛选草稿（vehicleKey 集合）；空数组 = 全部车辆（任务统计请求时不传该参数）
    const [vehicleDraft, setVehicleDraft] = useState<string[]>([]);
    /*
     * 生效查询条件：点「查询」时由草稿应用而来，其变化统一驱动任务统计与
     * AGV 利用率（排行 + 趋势）全部请求；初值即默认条件（近 7 天、全部车辆），
     * 挂载时由下方 effect 自动查询一次。
     */
    const [appliedQuery, setAppliedQuery] = useState<{ start: dayjs.Dayjs; end: dayjs.Dayjs; vehicleKeys: string[] }>(() => {
        const [start, end] = initialStatRange();
        return { start, end, vehicleKeys: [] };
    });
    // 车辆筛选选项：简单车辆列表（key/name），挂载时拉取一次
    const [vehicleOptions, setVehicleOptions] = useState<SimpleVehicle[]>([]);
    /*
     * 利用率趋势使用接口按天汇总的有效状态时长。
     * 分母为当天计入统计的秒数乘以当天车辆数。
     */
    const [utilizationTrend, setUtilizationTrend] = useState<EfficiencyTrendPoint[] | null>(null);
    // AGV 利用率排行数据（agvExecutingTimeStatistics 接口：按车辆累加指定状态时长 / 有效统计窗口秒数）
    const [vehicleRanking, setVehicleRanking] = useState<VehicleUtilizationItem[] | null>(null);

    // 用 run 而非 runAsync：runAsync 会把错误再次抛出，调用方不 catch 会产生 Unhandled Rejection
    // start/end/vehicleKeys 由调用方传入（而非闭包捕获 state），避免闭包捕获过期值
    const { run, loading } = useRequest(
        (start: dayjs.Dayjs, end: dayjs.Dayjs, vehicleKeys: string[]) =>
            dashboardRepository.fetchTaskStatistics(start, end, vehicleKeys),
        {
            manual: true,
            onSuccess: setData,
            // 请求失败不阻断页面（§15 降级）：KPI 显示 "--"、图表展示空状态，
            // 错误仅留受控日志（DashboardDataError 稳定错误码）
            onError: (e) => console.error("[TaskStatistics] 任务统计数据加载失败：", e),
        },
    );

    // 车辆筛选选项：挂载时拉取一次；失败仅降级为无选项（不阻断统计主流程）
    useEffect(() => {
        getSimpleVehicles()
            .then((res) => {
                if (res?.code === 200 && res?.message === "success") {
                    setVehicleOptions(res?.data || []);
                } else {
                    console.error("[TaskStatistics] 车辆列表接口返回异常：", res);
                }
            })
            .catch((e) => console.error("[TaskStatistics] 车辆列表加载失败：", e));
    }, []);

    /*
     * 利用率趋势：调用 agvStateStatistics 接口，
     * 按所选时间区间请求 3 种有效状态时长按天统计，
     * 每天利用率 = 有效状态总时长 /（当天计入统计的秒数 × 当天车辆数，今天截至当前时刻）；
     * 失败仅降级对应图表。
     * run 接收外部传入的 start/end，避免闭包捕获过期区间值。
     */
    const { run: runUtilizationTrend, loading: loadingUtilizationTrend } = useRequest(
        async (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
            const res = await agvStateStatistics({
                startTime: start.format("YYYY-MM-DD HH:mm:ss"),
                endTime: end.format("YYYY-MM-DD HH:mm:ss"),
                byHour: false,
                states: VEHICLE_UTILIZATION_STATES,
            });
            // 业务码校验：非成功返回空数组（降级，不阻断页面）
            if (res?.code !== 200 || !res.data) {
                console.error("[TaskStatistics] AGV 状态每日时长统计接口返回异常：", res);
                return [];
            }
            /*
             * 趋势按自然日桶渲染：从起始日到结束日按天升序、缺失天按 0 补齐；
             * 分母口径（首末非整天、今天截断到当前时刻）在映射函数内统一处理。
             */
            return mapStateDurationsToUtilizationTrend(res.data.dailyStateDurations ?? [], start, end, dayjs());
        },
        {
            manual: true,
            onSuccess: setUtilizationTrend,
            onError: (e) => console.error("[TaskStatistics] 利用率趋势数据加载失败：", e),
        },
    );

    /*
     * AGV 利用率排行：按所选时间区间调用 agvExecutingTimeStatistics 接口，
     * 利用率 = 累计有效状态时长 / 有效区间总秒数（终点截断到当前时刻）；
     * 失败仅降级对应图表。
     */
    const { run: runVehicleRanking, loading: loadingVehicleRanking } = useRequest(
        async (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
            const res = await agvExecutingTimeStatistics({
                startTime: start.format("YYYY-MM-DD HH:mm:ss"),
                endTime: end.format("YYYY-MM-DD HH:mm:ss"),
                byHour: false,
                states: VEHICLE_UTILIZATION_STATES,
            });
            // 业务码校验：非成功返回空数组（降级，不阻断页面）
            if (res?.code !== 200 || !res.data) {
                console.error("[TaskStatistics] AGV 各状态总时长统计接口返回异常：", res);
                return [];
            }
            // 有效统计终点取 min(end, now)：接口不含未来数据，分母不计入当前时刻之后的时间
            const now = dayjs();
            const effectiveEnd = end.isBefore(now) ? end : now;
            const windowSeconds = effectiveEnd.diff(start, "second");
            // 区间完全在未来（终点截断后不晚于起点）时无有效统计窗口，直接返回空
            if (windowSeconds <= 0) return [];
            return mapExecutingTimeToVehicleRanking(res.data.vehicleExecutingDurations ?? [], windowSeconds);
        },
        {
            manual: true,
            onSuccess: setVehicleRanking,
            onError: (e) => console.error("[TaskStatistics] AGV 利用率排行数据加载失败：", e),
        },
    );

    /*
     * 统一请求入口：挂载及生效条件变更（点「查询」）时，
     * 按同一区间并行请求任务统计与 AGV 利用率（排行 + 趋势）三条链路；
     * 任一路失败仅降级对应区域，互不影响。
     */
    useEffect(() => {
        const { start, end, vehicleKeys } = appliedQuery;
        run(start, end, vehicleKeys);
        runUtilizationTrend(start, end);
        runVehicleRanking(start, end);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appliedQuery]);

    /*
     * 点「查询」：草稿区间完整才把草稿应用为生效条件（不完整时按钮已禁用，此处为防御性判断）；
     * 生效条件变化由上方 effect 统一触发请求。
     */
    const handleQuery = () => {
        const [start, end] = rangeDraft;
        if (start && end) {
            setAppliedQuery({ start, end, vehicleKeys: vehicleDraft });
        }
    };

    const isLoading = loading && !data;
    const isLoadingUtilizationTrend = loadingUtilizationTrend && !utilizationTrend;
    const isLoadingVehicleRanking = loadingVehicleRanking && !vehicleRanking;

    const kpis = data?.kpis;
    // 时长分布是否为空：以分布桶计数总和为准（接口无原始耗时样本，分桶计数是唯一数据来源）
    const hasDurationData = !!data?.durationDistribution.some((b) => b.count > 0);

    /*
     * KPI / 图表 hint 中展示的统计窗口天数：由生效查询条件的区间计算
     * end.diff(start, "day") + 1（与当前展示数据口径一致，草稿编辑不影响 hint）。
     */
    const queryDays = appliedQuery.end.diff(appliedQuery.start, "day") + 1;
    // 查询按钮：草稿区间完整才可点；任一请求进行中置 loading 防重复触发
    const [draftStart, draftEnd] = rangeDraft;
    const draftValid = !!(draftStart && draftEnd);
    const queryLoading = loading || loadingUtilizationTrend || loadingVehicleRanking;

    return (
        <div>
            {/* 顶部工具栏：统计区间 + 车辆筛选 + 查询按钮（草稿态编辑，点「查询」才请求；
                车辆筛选仅任务统计接口消费，利用率两图只跟随统计区间） */}
            <div style={{ display: "flex", justifyContent: "flex-start", gap: 12, marginBottom: 12 }}>
                {/* 车辆筛选：空选中 = 全部车辆（请求不传参）；选项来自 getSimpleVehicles */}
                <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    optionFilterProp="name"
                    fieldNames={{ label: "name", value: "key" }}
                    placeholder={t("全部车辆")}
                    options={vehicleOptions}
                    value={vehicleDraft}
                    onChange={setVehicleDraft}
                    maxTagCount="responsive"
                    style={{ width: 350 }}
                />
                <TimeRangePicker value={rangeDraft} onChange={setRangeDraft} />
                <Button type="primary" loading={queryLoading} disabled={!draftValid} onClick={handleQuery}>
                    {t("查询")}
                </Button>
            </div>
            {/* KPI 行 */}
            <div className="dashboard-kpi-row">
                <KpiCard
                    label={t("总任务数")}
                    icon={<UnorderedListOutlined />}
                    loading={isLoading}
                    hint={t("总任务数·计算方式", { days: queryDays })}
                    value={kpis ? buildScalarKpiViewModel(kpis.totalCount, { labelKey: "", format: "integer", polarity: "neutral" }, locale) : { displayValue: "--", changeTone: "neutral" }}
                />
                <KpiCard
                    label={t("完成率")}
                    icon={<UnorderedListOutlined />}
                    loading={isLoading}
                    hint={t("完成率·计算方式", { days: queryDays })}
                    value={
                        kpis
                            ? {
                                displayValue: `${formatPercentage(kpis.completionRate, locale)}`,
                                changeTone: "neutral",
                            }
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t("失败 / 取消")}
                    icon={<UnorderedListOutlined />}
                    loading={isLoading}
                    hint={t("失败 / 取消·计算方式", { days: queryDays })}
                    value={
                        kpis
                            ? {
                                displayValue: `${formatInteger(kpis.failedCount, locale)} / ${formatInteger(kpis.canceledCount, locale)}`,
                                changeTone: "neutral",
                                accent: kpis.failedCount > 0 ? "warn" : undefined,
                            }
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t("平均执行时长")}
                    icon={<ClockCircleOutlined />}
                    loading={isLoading}
                    hint={t("平均执行时长·计算方式", { days: queryDays })}
                    value={
                        kpis
                            ? buildScalarKpiViewModel(
                                kpis.averageCompletedDurationMs,
                                { labelKey: "", format: "duration", polarity: "lower-is-better" },
                                locale,
                            )
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
            </div>

            {/* 任务统计图表（统计区间与车辆由上方工具栏控制） */}
            <div className="dashboard-chart-grid">
                <ChartPanel title={t("任务量趋势")} loading={isLoading} empty={!data?.volumeTrend.length} ariaLabelDescription={t("任务量趋势堆叠柱图")} hint={t("任务量趋势·计算方式", { days: queryDays })}>
                    {/* 接口按自然日桶返回窗口内数据，趋势桶恒为自然日；
                        与利用率工具栏所选区间粒度解耦，固定按 day 粒度渲染，避免小时/周粒度下的错误轴标签 */}
                    {data && <TaskVolumeStackedBar data={data.volumeTrend} granularity="day" />}
                </ChartPanel>
                <ChartPanel title={t("任务执行时长分布")} loading={isLoading} empty={!hasDurationData} ariaLabelDescription={t("任务执行时长分布柱图")} hint={t("任务执行时长分布·计算方式")}>
                    {data && (
                        <DurationDistributionBar
                            distribution={data.durationDistribution}
                            p50Ms={data.durationPercentiles.p50Ms}
                            p90Ms={data.durationPercentiles.p90Ms}
                        />
                    )}
                </ChartPanel>
            </div>
            {/* AGV 利用率图表（与任务统计共用顶部工具栏的统计区间，点「查询」随动） */}
            <div className="dashboard-chart-grid">
                <ChartPanel title={t("AGV 利用率排行")} loading={isLoadingVehicleRanking} empty={!vehicleRanking?.length} ariaLabelDescription={t("AGV 利用率排行横向柱图")} hint={t("AGV 利用率排行·计算方式", { days: queryDays })} height={VEHICLE_UTILIZATION_CHART_HEIGHT}>
                    {/* 数据源：agvExecutingTimeStatistics 接口（按所选区间 3 种状态时长），
                        前端按车辆累加时长 / 有效区间总秒数（不超过当前时刻）得到利用率 */}
                    {vehicleRanking && vehicleRanking.length > 0 && <VehicleUtilizationBar data={vehicleRanking} />}
                </ChartPanel>
                <ChartPanel title={t("利用率趋势")} loading={isLoadingUtilizationTrend} empty={!utilizationTrend?.length} ariaLabelDescription={t("利用率趋势折线图")} hint={t("利用率趋势·计算方式", { days: queryDays })}>
                    {/* 趋势桶恒为自然日（按所选区间逐天补齐），固定按 day 粒度渲染 */}
                    {utilizationTrend && <EfficiencyTrendLine data={utilizationTrend} granularity="day" />}
                </ChartPanel>
            </div>
        </div>
    );
}
