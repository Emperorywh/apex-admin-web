/**
 * @description AGV 各状态总时长统计页面
 *
 * 数据源：agvExecutingTimeStatistics 接口（每车 × 每状态的总时长，单位秒）。
 * 页面结构：
 *   - 工具栏：时间区间（TimeRangePicker）+ 状态多选 + 按小时维度开关 + 查询/重置
 *   - 4 KPI：任务执行利用率（分母为所选时间段秒数）、平均交管时长、平均执行时长、平均故障时长
 *   - 5 图：各状态总时长占比（饼）、各状态总时长排行（横向柱）、
 *     车辆 × 状态时长堆叠（全宽）、单车辆状态分布（饼，可选车）、车辆总时长排行（横向柱）
 *   - 明细表：每车每状态一行，含时长与占该车总时长比例（表格视图兼作图表的无障碍替代），
 *     表头下方支持车辆 / 状态本地筛选（仅过滤表格，不触发请求）
 *
 * 查询约定：
 *   - 草稿态编辑条件，点「查询」才整体应用并触发请求（与故障告警页一致）
 *   - 按小时维度时接口限制时间范围 ≤ 24 小时，查询前校验
 *   - 状态集合为空 = 统计所有状态（不传参）；车辆集合本页面不筛选（空 = 全部车辆）
 *   - 请求失败保留上一次成功数据（降级展示），仅以 message + 受控日志提示
 */
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useRequest } from "ahooks";
import { Button, Card, Checkbox, message, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ClockCircleOutlined, DashboardOutlined, PartitionOutlined, WarningOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { agvExecutingTimeStatistics } from "@/api";
import TimeRangePicker, { type TimeRangeValue } from "@/components/TimeRangePicker";
import { ChartPanel } from "@/pages/AnalyzeVisual/DashboardShared/components/ChartPanel";
import { InfoHint } from "@/pages/AnalyzeVisual/DashboardShared/components/InfoHint";
import { KpiCard } from "@/pages/AnalyzeVisual/DashboardShared/components/KpiCard";
import {
    formatDecimalHours,
    formatDuration,
    formatPercentage,
} from "@/pages/AnalyzeVisual/DashboardShared/model/formatters";
import { buildScalarKpiViewModel } from "@/pages/AnalyzeVisual/DashboardShared/model/kpiViewModel";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/pages/AnalyzeVisual/DashboardShared/model/policy";
import { StateSharePie } from "@/pages/AnalyzeVisual/VehicleStatus/charts/StateSharePie";
import { StateDurationRankBar } from "@/pages/AnalyzeVisual/VehicleStatus/charts/StateDurationRankBar";
import { VehicleStateStackedBar } from "@/pages/AnalyzeVisual/VehicleStatus/charts/VehicleStateStackedBar";
import { VehicleTotalRankBar } from "@/pages/AnalyzeVisual/VehicleStatus/charts/VehicleTotalRankBar";
import {
    VEHICLE_STATISTIC_STATE_ORDER,
    stateColor,
    stateLabelKey,
} from "@/pages/AnalyzeVisual/VehicleStatus/model/states";
import {
    groupByVehicle,
    secondsOfStates,
    type StateDurationItem,
} from "@/pages/AnalyzeVisual/VehicleStatus/model/selectors";
import type { VehicleExecutingDuration, VehicleStatisticState } from "@/types/AnalyzeVisual/VehicleStateStatistics";

/** 接口约定的时间格式（date-time 字符串，与后端联调口径一致） */
const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

/** 按小时维度统计时接口允许的最大时间跨度（24 小时） */
const BY_HOUR_MAX_RANGE_HOURS = 24;

/**
 * 已应用的查询条件（查询态）。
 * 与工具栏草稿态分离：点「查询」才把草稿整体应用为查询条件。
 */
interface AppliedQuery {
    startTime: string;
    endTime: string;
    byHour: boolean;
    states: VehicleStatisticState[];
}

/** 明细表行：每车每状态一条 */
interface DetailRow {
    key: string;
    vehicleKey: string;
    vehicleName: string;
    state: VehicleStatisticState;
    seconds: number;
    /** 占该车总时长比例（0–1 小数） */
    share: number;
}

/** 默认时间区间：近 7 个自然日（与 TimeRangePicker 快捷预设默认回显口径一致） */
function defaultRange(): TimeRangeValue {
    return [dayjs().subtract(6, "day").startOf("day"), dayjs().endOf("day")];
}

/**
 * AGV 各状态总时长统计主组件。
 * 计算方式说明统一从语言文件读取，中文文案使用状态中文名称和中文操作提示。
 * 保留利用率分母、未出现状态车辆参与平均及图表缩放方式的原有口径。
 */
export function VehicleStatus() {
    const { t, locale } = useI18n();

    // ===== 工具栏草稿态 =====
    const [range, setRange] = useState<TimeRangeValue>(defaultRange);
    const [byHour, setByHour] = useState(false);
    const [draftStates, setDraftStates] = useState<VehicleStatisticState[]>([]);

    // ===== 查询态 + 数据 =====
    const [applied, setApplied] = useState<AppliedQuery>(() => {
        const [start, end] = defaultRange();
        return {
            startTime: (start as Dayjs).format(DATE_TIME_FORMAT),
            endTime: (end as Dayjs).format(DATE_TIME_FORMAT),
            byHour: false,
            states: [],
        };
    });
    const [rows, setRows] = useState<VehicleExecutingDuration[] | null>(null);
    // 最近一次成功加载时间（状态栏展示，便于识别降级期间的陈旧数据）
    const [loadedAt, setLoadedAt] = useState<Dayjs | null>(null);

    // 用 run 而非 runAsync：runAsync 会把错误再次抛出，调用方不 catch 会产生 Unhandled Rejection
    const { run, loading } = useRequest(
        async (query: AppliedQuery) => {
            const res = await agvExecutingTimeStatistics({
                startTime: query.startTime,
                endTime: query.endTime,
                byHour: query.byHour,
                // 状态集合为空 = 统计所有状态，不传参（而非传空数组）
                states: query.states.length ? query.states : undefined,
            });
            // 业务码校验：非 200 视为失败，抛出由 onError 统一处理
            if (res?.code !== 200 || !res.data) {
                throw new Error(res?.message || `code: ${res?.code}`);
            }
            return res.data.vehicleExecutingDurations ?? [];
        },
        {
            manual: true,
            onSuccess: (list) => {
                setRows(list);
                setLoadedAt(dayjs());
            },
            // 失败保留上一次成功数据（降级展示），仅 message + 受控日志提示
            onError: (e) => {
                console.error("[VehicleStatus] AGV 各状态总时长统计加载失败：", e);
                message.error(t("查询失败") + "：" + (e?.message ?? ""));
            },
        },
    );

    // 查询态变化（含挂载时的初始查询态）触发请求
    useEffect(() => {
        run(applied);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applied]);

    // ===== 查询 / 重置 =====
    const handleSearch = () => {
        const [start, end] = range;
        if (!start || !end) {
            message.warning(t("请选择完整的时间范围"));
            return;
        }
        // 接口限制：按小时维度统计时时间范围不能超过 24 小时，前端先校验
        if (byHour && end.diff(start, "hour", true) > BY_HOUR_MAX_RANGE_HOURS) {
            message.warning(t("按小时维度统计时，时间范围不能超过 24 小时"));
            return;
        }
        setApplied({
            startTime: start.format(DATE_TIME_FORMAT),
            endTime: end.format(DATE_TIME_FORMAT),
            byHour,
            states: [...draftStates],
        });
    };

    const handleReset = () => {
        const [start, end] = defaultRange();
        setRange([start, end]);
        setByHour(false);
        setDraftStates([]);
        // 查询态同步重置（总是新对象，同值点击也会主动刷新）
        setApplied({
            startTime: (start as Dayjs).format(DATE_TIME_FORMAT),
            endTime: (end as Dayjs).format(DATE_TIME_FORMAT),
            byHour: false,
            states: [],
        });
    };

    // ===== 聚合视图（KPI / 图表 / 表格共用同一份原始记录） =====
    const list = rows ?? [];
    const vehicleGroups = useMemo(() => groupByVehicle(list), [list]);

    // ===== KPI =====
    /*
     * 利用率分母：已应用查询区间的秒数（仅时间段，不乘车辆数）。
     * 接口不含未来数据，区间终点超过当前时刻时截断到当前时刻（不计入未来时间），
     * 与任务统计报表页利用率的「有效区间」口径一致。
     */
    const windowSeconds = useMemo(() => {
        const start = dayjs(applied.startTime);
        const end = dayjs(applied.endTime);
        if (!start.isValid() || !end.isValid()) return 0;
        const now = dayjs();
        const effectiveEnd = end.isBefore(now) ? end : now;
        return Math.max(0, effectiveEnd.diff(start, "second"));
    }, [applied]);

    const workSeconds = useMemo(() => secondsOfStates(list, ["EXECUTING_WORK"]), [list]);
    const trafficSeconds = useMemo(() => secondsOfStates(list, ["TRAFFIC"]), [list]);
    const errorSeconds = useMemo(() => secondsOfStates(list, ["ERROR"]), [list]);

    /*
     * 平均口径：该状态总时长 ÷ 全部车辆数（未出现该状态的车按 0 参与平均）；
     * 无车辆时给 null，KPI 展示 "--"。
     */
    const vehicleCount = vehicleGroups.length;
    const avgTrafficMs = vehicleCount > 0 ? (trafficSeconds / vehicleCount) * 1000 : null;
    const avgWorkMs = vehicleCount > 0 ? (workSeconds / vehicleCount) * 1000 : null;
    const avgErrorMs = vehicleCount > 0 ? (errorSeconds / vehicleCount) * 1000 : null;

    // ===== 单车饼图的车辆选择（默认第一辆；数据刷新后若选中车仍在则保持） =====
    const [selectedVehicleKey, setSelectedVehicleKey] = useState<string | undefined>(undefined);
    const selectedGroup =
        vehicleGroups.find((g) => g.vehicleKey === selectedVehicleKey) ?? vehicleGroups[0];
    const selectedStateAgg = useMemo<StateDurationItem[]>(() => {
        if (!selectedGroup) return [];
        return Object.entries(selectedGroup.stateSeconds).map(([state, seconds]) => ({
            state: state as VehicleStatisticState,
            seconds: seconds ?? 0,
        }));
    }, [selectedGroup]);

    // ===== 明细表筛选（纯前端本地过滤，不触发请求；与工具栏查询态解耦） =====
    const [filterVehicleKeys, setFilterVehicleKeys] = useState<string[]>([]);
    const [filterStates, setFilterStates] = useState<VehicleStatisticState[]>([]);

    // 车辆筛选选项：当前数据中出现过的车辆（保持接口返回顺序）
    const filterVehicleOptions = useMemo(
        () => vehicleGroups.map((g) => ({ value: g.vehicleKey, label: g.vehicleName })),
        [vehicleGroups],
    );
    // 状态筛选选项：当前数据中出现过的状态（保持枚举语义顺序），避免出现无数据选项
    const filterStateOptions = useMemo(
        () =>
            VEHICLE_STATISTIC_STATE_ORDER.filter((state) =>
                vehicleGroups.some((g) => g.stateSeconds[state] !== undefined),
            ),
        [vehicleGroups],
    );

    // ===== 明细表 =====
    const detailRows = useMemo<DetailRow[]>(
        () =>
            vehicleGroups.flatMap((group) =>
                (Object.entries(group.stateSeconds) as [VehicleStatisticState, number][]).map(([state, seconds]) => ({
                    key: `${group.vehicleKey}|${state}`,
                    vehicleKey: group.vehicleKey,
                    vehicleName: group.vehicleName,
                    state,
                    seconds,
                    share: group.totalSeconds > 0 ? seconds / group.totalSeconds : 0,
                })),
            ),
        [vehicleGroups],
    );

    // 应用本地筛选后的明细行；空集合 = 不筛该维度（与「全部」口径一致）
    const filteredDetailRows = useMemo(() => {
        const vehicleSet = filterVehicleKeys.length ? new Set(filterVehicleKeys) : null;
        const stateSet = filterStates.length ? new Set(filterStates) : null;
        return detailRows.filter(
            (row) =>
                (!vehicleSet || vehicleSet.has(row.vehicleKey)) && (!stateSet || stateSet.has(row.state)),
        );
    }, [detailRows, filterVehicleKeys, filterStates]);

    const columns = useMemo<ColumnsType<DetailRow>>(
        () => [
            { title: t("车辆名称"), dataIndex: "vehicleName", key: "vehicleName", ellipsis: true },
            {
                title: t("状态"),
                dataIndex: "state",
                key: "state",
                // 状态色与图表一致（固定语义色），Tag 携带文字标签，不只依赖颜色
                render: (state: VehicleStatisticState) => (
                    <Tag color={stateColor(state)}>{t(stateLabelKey(state))}</Tag>
                ),
            },
            {
                title: t("时长"),
                dataIndex: "seconds",
                key: "seconds",
                sorter: (a, b) => a.seconds - b.seconds,
                render: (seconds: number) => formatDuration(seconds * 1000, locale),
            },
            {
                // 数值精确口径（小时），与时长列同值不同格式，不提供重复排序入口
                title: t("时长（小时）"),
                dataIndex: "hours",
                key: "hours",
                render: (_: unknown, row) => `${formatDecimalHours(row.seconds * 1000, locale)} h`,
            },
            {
                title: t("占该车总时长"),
                dataIndex: "share",
                key: "share",
                sorter: (a, b) => a.share - b.share,
                render: (share: number) => formatPercentage(share, locale),
            },
        ],
        [t, locale],
    );

    // 首次加载中（无历史数据时才让 KPI / 图表进入 loading，避免查询刷新时闪烁）
    const isLoading = loading && !rows;

    return (
        <div>
            {/* 查询工具栏：草稿态编辑，点「查询」整体应用 */}
            <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 12 } }}>
                <Space size="middle" wrap>
                    <TimeRangePicker value={range} onChange={setRange} />
                    <Select
                        mode="multiple"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder={t("全部状态")}
                        value={draftStates}
                        onChange={setDraftStates}
                        options={VEHICLE_STATISTIC_STATE_ORDER.map((state) => ({
                            value: state,
                            label: t(stateLabelKey(state)),
                        }))}
                        maxTagCount={3}
                        style={{ minWidth: 220 }}
                    />
                    <Checkbox checked={byHour} onChange={(e) => setByHour(e.target.checked)}>
                        {t("按小时维度")}
                    </Checkbox>
                    <InfoHint content={t("按小时维度统计时，时间范围不能超过 24 小时")} />
                    <Button type="primary" loading={loading} onClick={handleSearch}>
                        {t("查询")}
                    </Button>
                    <Button onClick={handleReset}>{t("重置")}</Button>
                    {loadedAt && rows && (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {t("已加载 {count} 条记录", { count: rows.length })} · {loadedAt.format("HH:mm:ss")}
                        </Typography.Text>
                    )}
                </Space>
            </Card>

            {/* KPI 行 */}
            <div className="dashboard-kpi-row">
                {/* 任务执行利用率：分母为所选时间段秒数（不乘车辆数，多车时可能超过 100%） */}
                <KpiCard
                    label={t("任务执行利用率")}
                    icon={<DashboardOutlined />}
                    loading={isLoading}
                    hint={t("任务执行利用率·计算方式")}
                    value={
                        rows
                            ? {
                                  ...buildScalarKpiViewModel(windowSeconds > 0 ? workSeconds / windowSeconds : null, { labelKey: "", format: "percentage", polarity: "higher-is-better" }, locale),
                                  changeText: t("覆盖 {vehicles} 辆车 · 执行作业 {duration}", {
                                      vehicles: vehicleCount,
                                      duration: formatDuration(workSeconds * 1000, locale),
                                  }),
                              }
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t("平均交管时长")}
                    icon={<PartitionOutlined />}
                    loading={isLoading}
                    hint={t("平均交管时长·计算方式")}
                    value={
                        rows
                            ? {
                                  ...buildScalarKpiViewModel(avgTrafficMs, { labelKey: "", format: "duration", polarity: "lower-is-better" }, locale),
                                  changeText: t("覆盖 {vehicles} 辆车", { vehicles: vehicleCount }),
                              }
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t("平均执行时长")}
                    icon={<ClockCircleOutlined />}
                    loading={isLoading}
                    hint={t("平均执行时长（车辆状态）·计算方式")}
                    value={
                        rows
                            ? {
                                  ...buildScalarKpiViewModel(avgWorkMs, { labelKey: "", format: "duration", polarity: "neutral" }, locale),
                                  changeText: t("覆盖 {vehicles} 辆车", { vehicles: vehicleCount }),
                              }
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t("平均故障时长")}
                    icon={<WarningOutlined />}
                    loading={isLoading}
                    hint={t("平均故障时长·计算方式")}
                    value={
                        rows
                            ? {
                                  ...buildScalarKpiViewModel(avgErrorMs, { labelKey: "", format: "duration", polarity: "lower-is-better" }, locale),
                                  accent: avgErrorMs && avgErrorMs > 0 ? "danger" : undefined,
                              }
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
            </div>

            {/* 图表网格 */}
            <div className="dashboard-chart-grid">
                {/*
                    车辆状态堆叠独占一行，默认展示全部车辆并支持局部缩放。
                    加载和空态也预留相同高度，避免查询前后面板跳动。
                */}
                <div style={{ gridColumn: "1 / -1" }}>
                    <ChartPanel
                        title={t("车辆 × 状态 时长堆叠")}
                        loading={isLoading}
                        empty={!vehicleGroups.length}
                        ariaLabelDescription={t("车辆状态时长堆叠柱图")}
                        hint={t("车辆 × 状态 时长堆叠·计算方式")}
                        height={460}
                        minHeight={524}
                    >
                        <VehicleStateStackedBar data={vehicleGroups} />
                    </ChartPanel>
                </div>
            </div>

            {/* 明细表：兼作图表的表格视图（无障碍要求），前端分页；
                表格自带 loading/空态，不经 ChartPanel 的 empty/loading 覆盖 */}
            <ChartPanel title={t("状态时长明细")} ariaLabelDescription={t("状态时长明细表")}>
                <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
                    {/* 明细表本地筛选：仅过滤表格数据，不影响上方图表与 KPI */}
                    <Space size="middle" wrap style={{ marginBottom: 12 }}>
                        <Select
                            mode="multiple"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            placeholder={t("全部车辆")}
                            value={filterVehicleKeys}
                            onChange={setFilterVehicleKeys}
                            options={filterVehicleOptions}
                            maxTagCount={3}
                            style={{ minWidth: 200 }}
                        />
                        <Select
                            mode="multiple"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            placeholder={t("全部状态")}
                            value={filterStates}
                            onChange={setFilterStates}
                            options={filterStateOptions.map((state) => ({
                                value: state,
                                label: t(stateLabelKey(state)),
                            }))}
                            maxTagCount={3}
                            style={{ minWidth: 200 }}
                        />
                    </Space>
                    <Table<DetailRow>
                        size="small"
                        rowKey="key"
                        columns={columns}
                        dataSource={filteredDetailRows}
                        loading={loading}
                        pagination={{
                            pageSize: 10,
                            pageSizeOptions: [...TABLE_PAGE_SIZE_OPTIONS],
                            showSizeChanger: true,
                            showTotal: (total) => t("共 {total} 条", { total }),
                        }}
                        scroll={{ x: "max-content" }}
                    />
                </div>
            </ChartPanel>
        </div>
    );
}
