/**
 * @description 故障与告警报表（§5.4）
 *
 *   - 4 KPI：统计窗口内故障次数、未关闭告警数、告警关闭率、平均告警时长
 *     （关闭率/平均时长由 dailyAlarmCounts 的 closedCount/unclosedCount/totalDurationSeconds
 *     窗口级汇总；接口不提供 MTBF / MTTR，不再展示）
 *   - 2 图：故障趋势柱+折线、单机故障排行 TOP10 横向柱
 *     （接口无告警级别维度，级别分布图已移除）
 *   - 明细表：事件 ID/级别/类型/AGV/描述/发生时间/恢复时间/持续时间/状态，
 *     已对接真实接口（服务端分页）：筛选/翻页触发重新请求，页面无时间区间概念；
 *     接口无排序参数，持续时间/发生时间排序仅作用于当前页。
 *     未关闭事件的恢复时间显示 --，排序时视为最大持续时间（§5.4 / §7.4）。
 *
 * KPI/图表已对接真实接口（alarmStatistics，§7.3）：接口支持任意起止时间
 * （startTime/endTime），统计区间由页面上方 TimeRangePicker 控制（默认近 14 天，
 * 草稿态编辑，挂载及点「查询」时请求），趋势桶恒为自然日，图表固定按 day 粒度渲染；
 * 单机故障排行为窗口最后一天（end 所在日）的 Top10，标题标注对应日期。
 * 接口未提供的指标由 HTTP 适配器置 null / 空数组（§6.1），组件只展示领域值。
 * 聚合接口失败时整页不阻断：KPI 显示 "--"、图表展示空状态，仅留受控日志；
 * 明细表走独立分页链路，其错误态独立处理（§15）。
 */
import { useRequest } from "ahooks";
import { Alert, Button, DatePicker, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckCircleOutlined, ClockCircleOutlined, DownOutlined, UpOutlined, WarningOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { ChartPanel } from "@/pages/AnalyzeVisual/DashboardShared/components/ChartPanel";
import { KpiCard } from "@/pages/AnalyzeVisual/DashboardShared/components/KpiCard";
import { dashboardRepository } from "@/pages/AnalyzeVisual/DashboardShared/data/HttpDashboardRepository";
import {
    formatDateTime,
    formatDuration,
} from "@/pages/AnalyzeVisual/DashboardShared/model/formatters";
import { BUSINESS_TIMEZONE } from "@/pages/AnalyzeVisual/DashboardShared/model/businessTime";
import { buildScalarKpiViewModel } from "@/pages/AnalyzeVisual/DashboardShared/model/kpiViewModel";
import {
    ALERT_LEVEL_LABEL,
    ALERT_LEVEL_TAG_COLOR,
    FAULT_STATUS_LABEL,
    FAULT_STATUS_TAG_COLOR,
} from "@/pages/AnalyzeVisual/DashboardShared/model/enumLabels";
import { FAULT_ALERT_REPORT_DAYS, TABLE_PAGE_SIZE_OPTIONS } from "@/pages/AnalyzeVisual/DashboardShared/model/policy";
import type { AlertLevel } from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type { PageQuery } from "@/pages/AnalyzeVisual/DashboardShared/model/tableSelectors";
import type { FaultAlertData, FaultDetailLevel, FaultDetailPage, FaultDetailPageQuery, FaultDetailRecord } from "@/pages/AnalyzeVisual/FaultAlert/model/types";
import {
    type FaultDetailFilters,
    type FaultTableSortColumn,
    type FaultTableSortState,
    resolveFaultDescription,
    sortFaultDetailRecords,
} from "@/pages/AnalyzeVisual/FaultAlert/model/selectors";
import { FaultTrendBarLine } from "@/pages/AnalyzeVisual/FaultAlert/charts/FaultTrendBarLine";
import { VehicleFaultRankBar } from "@/pages/AnalyzeVisual/FaultAlert/charts/VehicleFaultRankBar";
import TimeRangePicker, { type TimeRangeValue } from "@/components/TimeRangePicker";

const { RangePicker } = DatePicker;

/**
 * 明细筛选草稿态（编辑中的值）。
 * 与 applied（查询态）分离：点「查询」才把草稿整体应用为查询条件，
 * 避免文本输入过程中每敲一个字符就触发请求。
 */
interface DraftFilters {
    /** 告警级别：critical / major / all */
    level: FaultDetailLevel | "all";
    /** 告警类型（alarmType 原文）/ all */
    alarmType: string;
    /** 告警来源：VEHICLE / DEVICE / SERVER / all */
    sourceType: string;
    /** 告警来源标识 */
    sourceKey: string;
    /** 告警来源名称 */
    sourceName: string;
    /** 告警码 */
    alarmCode: string;
    /** 关联订单key */
    orderKey: string;
    /** 状态：open 未关闭 / closed 已关闭 / all */
    closed: "all" | "open" | "closed";
    /** 发生时间范围（RangePicker 值，查询时格式化为字符串） */
    startRange: [Dayjs | null, Dayjs | null] | null;
    /** 恢复时间范围 */
    endRange: [Dayjs | null, Dayjs | null] | null;
}

/** 空筛选草稿（常量复用，重置时直接引用，切勿原地修改） */
const EMPTY_DRAFT: DraftFilters = {
    level: "all",
    alarmType: "all",
    sourceType: "all",
    sourceKey: "",
    sourceName: "",
    alarmCode: "",
    orderKey: "",
    closed: "all",
    startRange: null,
    endRange: null,
};

/** 空查询条件（常量复用，重置时直接引用，切勿原地修改） */
const EMPTY_FILTERS: FaultDetailFilters = { level: "all", alarmType: "all", sourceType: "all", closed: "all" };

/** 时间范围控件与接口约定的时间格式（date-time 字符串） */
const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

/**
 * 初始统计区间：近 FAULT_ALERT_REPORT_DAYS 个自然日
 * [今天-(N-1)天 00:00:00, 今天 23:59:59]，与 TimeRangePicker 的 lastNDays(N) 口径一致。
 */
function initialStatRange(): [Dayjs, Dayjs] {
    const now = dayjs.tz(Date.now(), BUSINESS_TIMEZONE);
    return [now.subtract(FAULT_ALERT_REPORT_DAYS - 1, "day").startOf("day"), now.endOf("day")];
}

/**
 * 故障与告警报表主组件。
 * 计算方式说明统一从语言文件读取，中文文案使用告警业务名称和中文单位。
 * 保留按发生日期汇总及未关闭告警累计时长的口径，排行日期与生效统计区间一致。
 */
export function FaultAlert() {
    const { t, locale } = useI18n();
    const [data, setData] = useState<FaultAlertData | null>(null);
    /*
     * KPI / 图表的统计区间草稿态，由 TimeRangePicker 编辑（默认近 FAULT_ALERT_REPORT_DAYS 天）。
     * 草稿变更不触发请求，点「查询」才应用为生效条件（与明细筛选区交互约定一致）；
     * 明细表走独立分页链路，不受统计区间影响。
     */
    const [rangeDraft, setRangeDraft] = useState<TimeRangeValue>(() => initialStatRange());
    /*
     * 生效统计窗口：点「查询」时由草稿应用而来，其变化驱动聚合数据请求；
     * 初值即默认窗口（近 14 天），挂载时由下方 effect 自动查询一次。
     */
    const [appliedRange, setAppliedRange] = useState<{ start: Dayjs; end: Dayjs }>(() => {
        const [start, end] = initialStatRange();
        return { start, end };
    });

    // 用 run 而非 runAsync：runAsync 会把错误再次抛出，调用方不 catch 会产生 Unhandled Rejection
    // start/end 由调用方传入（而非闭包捕获 appliedRange），避免闭包捕获过期值
    const { run, loading } = useRequest(
        (start: Dayjs, end: Dayjs) => dashboardRepository.fetchFaultAlert(start, end),
        {
            manual: true,
            onSuccess: setData,
            // 聚合接口失败不阻断页面（§15 降级）：KPI 显示 "--"、图表展示空状态，
            // 明细表走独立分页链路不受影响；错误仅留受控日志（DashboardDataError 稳定错误码）
            onError: (e) => console.error("[FaultAlert] 告警统计聚合数据加载失败：", e),
        },
    );

    // 挂载及生效统计窗口变更（点「查询」）时请求聚合数据
    useEffect(() => {
        run(appliedRange.start, appliedRange.end);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appliedRange]);

    /*
     * 点「查询」：草稿区间完整才把草稿应用为生效条件（不完整时按钮已禁用，此处为防御性判断）；
     * 生效条件变化由上方 effect 统一触发请求。
     */
    const handleStatQuery = () => {
        const [start, end] = rangeDraft;
        if (start && end) {
            setAppliedRange({ start, end });
        }
    };

    // 明细表交互状态（本地，切走 Tab 后随销毁重置，§12.1）
    // 服务端分页：草稿态 draft 编辑条件，点「查询」应用为 applied 才触发请求；
    // 接口无排序参数，排序仅作用于当前页
    const [draft, setDraft] = useState<DraftFilters>(EMPTY_DRAFT);
    const [applied, setApplied] = useState<FaultDetailFilters>(EMPTY_FILTERS);
    const [moreVisible, setMoreVisible] = useState(false);
    const [sort, setSort] = useState<FaultTableSortState>(null);
    const [page, setPage] = useState<PageQuery>({ current: 1, pageSize: 10 });
    const [detail, setDetail] = useState<FaultDetailPage | null>(null);
    const [detailError, setDetailError] = useState<Error | null>(null);
    // 类型筛选动态选项：接口无类型字典接口，从已加载记录中累计去重（取并集，随翻页逐步补全）
    const [alarmTypeOptions, setAlarmTypeOptions] = useState<string[]>([]);

    // 同上：用 run（别名 runDetail）而非 runAsync，避免错误二次抛出导致 Unhandled Rejection
    const { run: runDetail, loading: detailLoading } = useRequest(
        (q: FaultDetailPageQuery) => dashboardRepository.fetchFaultDetailPage(q),
        {
            manual: true,
            onSuccess: (res) => {
                setDetail(res);
                setAlarmTypeOptions((prev) => {
                    const merged = new Set(prev);
                    for (const row of res.rows) {
                        if (row.alarmType) merged.add(row.alarmType);
                    }
                    // 无新增类型时保持原引用，避免触发无意义重渲染
                    return merged.size === prev.length ? prev : [...merged].sort();
                });
            },
            onError: setDetailError,
        },
    );

    // 查询：把草稿整体应用为查询条件并回到第 1 页（applied 总是新对象，同值点击也会主动刷新）
    const handleSearch = () => {
        setApplied({
            level: draft.level,
            alarmType: draft.alarmType,
            sourceType: draft.sourceType,
            sourceKey: draft.sourceKey,
            sourceName: draft.sourceName,
            alarmCode: draft.alarmCode,
            orderKey: draft.orderKey,
            closed: draft.closed,
            startTimeBegin: draft.startRange?.[0]?.format(DATE_TIME_FORMAT),
            startTimeEnd: draft.startRange?.[1]?.format(DATE_TIME_FORMAT),
            endTimeBegin: draft.endRange?.[0]?.format(DATE_TIME_FORMAT),
            endTimeEnd: draft.endRange?.[1]?.format(DATE_TIME_FORMAT),
        });
        setPage((p) => ({ ...p, current: 1 }));
    };

    // 重置：草稿与查询条件同时清空并回到第 1 页
    const handleReset = () => {
        setDraft(EMPTY_DRAFT);
        setApplied(EMPTY_FILTERS);
        setPage((p) => ({ ...p, current: 1 }));
    };

    // 明细查询参数：默认不带时间范围（页面无区间工具栏），时间条件由筛选区显式指定；
    // "all" / 空串统一转为不传参
    const detailQuery = useMemo<FaultDetailPageQuery>(
        () => ({
            pageNo: page.current,
            pageSize: page.pageSize,
            level: applied.level && applied.level !== "all" ? applied.level : undefined,
            alarmType: applied.alarmType && applied.alarmType !== "all" ? applied.alarmType : undefined,
            sourceType: applied.sourceType && applied.sourceType !== "all" ? applied.sourceType : undefined,
            sourceKey: applied.sourceKey || undefined,
            sourceName: applied.sourceName || undefined,
            alarmCode: applied.alarmCode || undefined,
            orderKey: applied.orderKey || undefined,
            // 状态三态映射：open → false（仅未关闭）/ closed → true（仅已关闭）/ all → 不传
            closed: applied.closed === "open" ? false : applied.closed === "closed" ? true : undefined,
            startTimeBegin: applied.startTimeBegin,
            startTimeEnd: applied.startTimeEnd,
            endTimeBegin: applied.endTimeBegin,
            endTimeEnd: applied.endTimeEnd,
        }),
        [page.current, page.pageSize, applied],
    );

    useEffect(() => {
        setDetailError(null);
        runDetail(detailQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detailQuery]);

    // 接口无排序参数：排序仅对当前页数据做前端稳定排序
    const displayRows = useMemo(() => sortFaultDetailRecords(detail?.rows ?? [], sort), [detail, sort]);

    const columns = useMemo<ColumnsType<FaultDetailRecord>>(
        () => [
            { title: t("事件 ID"), dataIndex: "id", key: "id", ellipsis: true },
            {
                title: t("级别"),
                dataIndex: "level",
                key: "level",
                render: (level: AlertLevel) => <Tag color={ALERT_LEVEL_TAG_COLOR[level]}>{t(ALERT_LEVEL_LABEL[level])}</Tag>,
            },
            {
                // 类型为后端自由字符串，原文展示、不做枚举翻译
                title: t("类型"),
                dataIndex: "alarmType",
                key: "alarmType",
                render: (v: string) => v || "--",
            },
            { title: t("AGV"), dataIndex: "vehicleName", key: "vehicleName", render: (v: string) => v || "--" },
            {
                title: t("描述"),
                dataIndex: "description",
                key: "description",
                ellipsis: true,
                // 译文回退链：当前语言 → zh_CN → en_US → 原文；全空显示 "--"
                render: (desc: FaultDetailRecord["description"]) => resolveFaultDescription(desc, locale) || "--",
            },
            {
                title: t("发生时间"),
                dataIndex: "occurredAt",
                key: "occurredAt",
                sorter: true,
                sortOrder: sort?.column === "occurredAt" ? sort.direction : null,
                render: (v: string | null) => (v ? formatDateTime(v, locale) : "--"),
            },
            {
                title: t("恢复时间"),
                dataIndex: "recoveredAt",
                key: "recoveredAt",
                render: (v: string | null) => (v ? formatDateTime(v, locale) : "--"),
            },
            {
                title: t("持续时间"),
                dataIndex: "durationMs",
                key: "durationMs",
                sorter: true,
                sortOrder: sort?.column === "durationMs" ? sort.direction : null,
                // 未关闭事件排序时视为最大持续时间（§5.4），durationMs 为 null 由 selector 处理
                render: (v: number | null) => formatDuration(v, locale),
            },
            {
                title: t("状态"),
                dataIndex: "closed",
                key: "closed",
                // 接口只有 关闭/未关闭 两种状态（无「处理中」中间态）
                render: (closed: boolean) => {
                    const status = closed ? "closed" : "open";
                    return <Tag color={FAULT_STATUS_TAG_COLOR[status]}>{t(FAULT_STATUS_LABEL[status])}</Tag>;
                },
            },
        ],
        [t, locale, sort],
    );

    const isLoading = loading && !data;

    const kpis = data?.kpis;

    /*
     * KPI / 图表 hint 中展示的统计窗口天数：由生效统计窗口的区间计算
     * end.diff(start, "day") + 1（与当前展示数据口径一致，草稿编辑不影响 hint）。
     */
    const queryDays = appliedRange.end.diff(appliedRange.start, "day") + 1;
    // 查询按钮：草稿区间完整才可点；请求进行中置 loading 防重复触发
    const [draftStart, draftEnd] = rangeDraft;
    const draftValid = !!(draftStart && draftEnd);

    return (
        <div>
            {/* 统计工具栏：统计区间驱动下方 KPI 与图表（草稿态编辑，点「查询」才请求）；明细表不受影响 */}
            <div style={{ display: "flex", justifyContent: "flex-start", gap: 12, marginBottom: 12 }}>
                <TimeRangePicker value={rangeDraft} onChange={setRangeDraft} />
                <Button type="primary" loading={loading} disabled={!draftValid} onClick={handleStatQuery}>
                    {t("查询")}
                </Button>
            </div>
            <div className="dashboard-kpi-row">
                <KpiCard
                    label={t("故障次数")}
                    icon={<WarningOutlined />}
                    loading={isLoading}
                    hint={t("故障次数·计算方式", { days: queryDays })}
                    value={kpis ? buildScalarKpiViewModel(kpis.faultCount, { labelKey: "", format: "integer", polarity: "lower-is-better" }, locale) : { displayValue: "--", changeTone: "neutral" }}
                />
                <KpiCard
                    label={t("未关闭告警数")}
                    icon={<WarningOutlined />}
                    loading={isLoading}
                    hint={t("未关闭告警数·计算方式", { days: queryDays })}
                    value={
                        kpis
                            ? {
                                  ...buildScalarKpiViewModel(kpis.openAlertCount, { labelKey: "", format: "integer", polarity: "lower-is-better" }, locale),
                                  accent: kpis.openAlertCount > 0 ? "danger" : undefined,
                              }
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                {/* 关闭率/平均时长为窗口级派生指标（分子分母与故障次数同口径），
                    窗口内无告警时领域值为 null，展示 "--"（§6.1） */}
                <KpiCard
                    label={t("告警关闭率")}
                    icon={<CheckCircleOutlined />}
                    loading={isLoading}
                    hint={t("告警关闭率·计算方式", { days: queryDays })}
                    value={
                        kpis
                            ? {
                                  ...buildScalarKpiViewModel(kpis.closedRate, { labelKey: "", format: "percentage", polarity: "higher-is-better" }, locale),
                                  accent: kpis.closedRate !== null && kpis.closedRate < 1 ? "warn" : undefined,
                              }
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t("平均告警时长")}
                    icon={<ClockCircleOutlined />}
                    loading={isLoading}
                    hint={t("平均告警时长·计算方式", { days: queryDays })}
                    value={kpis ? buildScalarKpiViewModel(kpis.avgDurationMs, { labelKey: "", format: "duration", polarity: "lower-is-better" }, locale) : { displayValue: "--", changeTone: "neutral" }}
                />
            </div>

            <div className="dashboard-chart-grid">
                {/* 接口仅支持按天数返回（窗口由上方「统计天数」控制），趋势桶恒为自然日，固定按 day 粒度渲染 */}
                <ChartPanel title={t("故障趋势")} loading={isLoading} empty={!data?.trend.length} ariaLabelDescription={t("故障趋势柱状与频率折线图")} hint={t("故障趋势·计算方式", { days: queryDays })}>
                    {data && <FaultTrendBarLine data={data.trend} granularity="day" />}
                </ChartPanel>
                {/* 接口排行仅支持指定单日（窗口最后一天，即 end 所在日），标题标注对应日期避免误读为区间排行 */}
                <ChartPanel title={t("单机故障排行 TOP10（{date}）", { date: appliedRange.end.format("YYYY-MM-DD") })} loading={isLoading} empty={!data?.vehicleRanking.length} ariaLabelDescription={t("单机故障排行 TOP10 横向柱图")} hint={t("单机故障排行 TOP10·计算方式")} height={Math.max(280, (data?.vehicleRanking.length ?? 0) * 28)}>
                    {data && <VehicleFaultRankBar data={data.vehicleRanking} />}
                </ChartPanel>
            </div>

            {/* 故障明细：ChartPanel 内部为图表设计的居中 flex 容器不适合表格，
                这里用一个纵向 flex 包裹，确保 Space 在上方、Table 横向占满 */}
            <ChartPanel title={t("故障明细")} ariaLabelDescription={t("故障明细表")}>
                <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
                    {/* 筛选区：草稿态编辑，点「查询」才发请求；常用条件平铺，其余收进「更多筛选」 */}
                    <Space style={{ marginBottom: 12 }} size="middle" wrap>
                        <Select
                            size="small"
                            value={draft.level}
                            onChange={(v) => setDraft((d) => ({ ...d, level: v }))}
                            options={[
                                { value: "all", label: t("全部级别") },
                                // 接口级别仅 FATAL / WARNING（映射领域 critical / major），筛选只开放这两级
                                { value: "critical", label: t(ALERT_LEVEL_LABEL.critical) },
                                { value: "major", label: t(ALERT_LEVEL_LABEL.major) },
                            ]}
                            style={{ width: 120 }}
                        />
                        <Select
                            size="small"
                            showSearch
                            optionFilterProp="label"
                            value={draft.alarmType}
                            onChange={(v) => setDraft((d) => ({ ...d, alarmType: v }))}
                            options={[
                                { value: "all", label: t("全部类型") },
                                // 动态选项：从已加载记录的 alarmType 累计去重，原文展示
                                ...alarmTypeOptions.map((tp) => ({ value: tp, label: tp })),
                            ]}
                            style={{ width: 140 }}
                        />
                        <Select
                            size="small"
                            value={draft.sourceType}
                            onChange={(v) => setDraft((d) => ({ ...d, sourceType: v }))}
                            options={[
                                { value: "all", label: t("全部来源") },
                                // 接口来源枚举原文作为 value，label 走 i18n
                                { value: "VEHICLE", label: t("车辆") },
                                { value: "DEVICE", label: t("设备") },
                                { value: "SERVER", label: t("服务器") },
                            ]}
                            style={{ width: 120 }}
                        />
                        <Select
                            size="small"
                            value={draft.closed}
                            onChange={(v) => setDraft((d) => ({ ...d, closed: v }))}
                            options={[
                                { value: "all", label: t("全部状态") },
                                // 选项文案与状态列口径一致（FAULT_STATUS_LABEL：open 未处理 / closed 已关闭）
                                { value: "open", label: t(FAULT_STATUS_LABEL.open) },
                                { value: "closed", label: t(FAULT_STATUS_LABEL.closed) },
                            ]}
                            style={{ width: 120 }}
                        />
                        <Input
                            size="small"
                            allowClear
                            placeholder={t("告警码")}
                            value={draft.alarmCode}
                            onChange={(e) => setDraft((d) => ({ ...d, alarmCode: e.target.value }))}
                            onPressEnter={handleSearch}
                            style={{ width: 160 }}
                        />
                        <Button size="small" type="primary" loading={detailLoading} onClick={handleSearch}>
                            {t("查询")}
                        </Button>
                        <Button size="small" onClick={handleReset}>
                            {t("重置")}
                        </Button>
                        <Button
                            size="small"
                            type="link"
                            icon={moreVisible ? <UpOutlined /> : <DownOutlined />}
                            iconPosition="end"
                            onClick={() => setMoreVisible((v) => !v)}
                        >
                            {moreVisible ? t("收起筛选") : t("更多筛选")}
                        </Button>
                    </Space>
                    {moreVisible && (
                        <Space style={{ marginBottom: 12 }} size="middle" wrap>
                            <Input
                                size="small"
                                allowClear
                                placeholder={t("来源标识")}
                                value={draft.sourceKey}
                                onChange={(e) => setDraft((d) => ({ ...d, sourceKey: e.target.value }))}
                                onPressEnter={handleSearch}
                                style={{ width: 160 }}
                            />
                            <Input
                                size="small"
                                allowClear
                                placeholder={t("来源名称")}
                                value={draft.sourceName}
                                onChange={(e) => setDraft((d) => ({ ...d, sourceName: e.target.value }))}
                                onPressEnter={handleSearch}
                                style={{ width: 160 }}
                            />
                            <Input
                                size="small"
                                allowClear
                                placeholder={t("关联订单")}
                                value={draft.orderKey}
                                onChange={(e) => setDraft((d) => ({ ...d, orderKey: e.target.value }))}
                                onPressEnter={handleSearch}
                                style={{ width: 160 }}
                            />
                            <Typography.Text type="secondary">{t("发生时间")}</Typography.Text>
                            <RangePicker
                                size="small"
                                showTime
                                format={DATE_TIME_FORMAT}
                                value={draft.startRange}
                                onChange={(v) => setDraft((d) => ({ ...d, startRange: v }))}
                            />
                            <Typography.Text type="secondary">{t("恢复时间")}</Typography.Text>
                            <RangePicker
                                size="small"
                                showTime
                                format={DATE_TIME_FORMAT}
                                value={draft.endRange}
                                onChange={(v) => setDraft((d) => ({ ...d, endRange: v }))}
                            />
                        </Space>
                    )}
                    {detailError && !detail ? (
                        <Alert
                            role="alert"
                            type="error"
                            showIcon
                            message={t("故障明细加载失败")}
                            description={detailError.message}
                            action={<Button loading={detailLoading} onClick={() => runDetail(detailQuery)}>{t("重试")}</Button>}
                        />
                    ) : (
                        <Table<FaultDetailRecord>
                            size="small"
                            rowKey="id"
                            columns={columns}
                            dataSource={displayRows}
                            loading={detailLoading}
                            pagination={{
                                current: page.current,
                                pageSize: page.pageSize,
                                total: detail?.total ?? 0,
                                pageSizeOptions: [...TABLE_PAGE_SIZE_OPTIONS],
                                showSizeChanger: true,
                                onChange: (current, pageSize) => setPage({ current, pageSize }),
                            }}
                            onChange={(_pagination, _filters, sorter) => {
                                const s = Array.isArray(sorter) ? sorter[0] : sorter;
                                if (s && s.columnKey && (s.order === "ascend" || s.order === "descend")) {
                                    setSort({ column: String(s.columnKey) as FaultTableSortColumn, direction: s.order });
                                } else {
                                    setSort(null);
                                }
                            }}
                            scroll={{ x: "max-content" }}
                        />
                    )}
                </div>
            </ChartPanel>
        </div>
    );
}
