/**
 * @description Dashboard HTTP 仓储实现（§7.3）
 *
 * 真实后端适配器，负责：
 *   - 独立处理 {code,message,data} 响应壳与业务错误（§7.3）：
 *     非成功业务码 reject 为 DashboardDataError("BUSINESS_ERROR")，
 *     成功但结构缺失 reject 为 DashboardDataError("INVALID_RESPONSE")；
 *     网络层异常由调用方兜底为 "NETWORK_ERROR"。
 *   - 把后端 VO 转换为领域数据（单位、空值规则、今日/昨日同时刻对齐）。
 *
 * 当前实时看板（fetchRealtime）、任务统计报表（fetchTaskStatistics）与
 * 故障告警报表（fetchFaultAlert / fetchFaultDetailPage）完成联调：
 *   - 实时：POST /fms/v1/dispatcher/dashboard/board（days=2，覆盖今天+昨天）
 *   - 实时告警：POST /fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords
 *     （isClosed=false 仅未关闭，取前 100 条；与看板聚合并行请求、独立降级）
 *   - 任务统计：POST /fms/v1/report/orderStatisticsReport/taskStatistics（区间与车辆由页面工具栏输入，默认近 7 天）
 *   - 故障告警聚合：POST /fms/v1/report/systemAlarmRecord/alarmStatistics（区间由页面 TimeRangePicker 输入，默认近 14 天）
 *   - 故障明细分页：POST /fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords（服务端分页）
 *
 * 实时看板计算口径（均由前端基于 hourlyCounts / vehicle 二次汇总）：
 *   - 今日/昨日按 hourTime（业务时区墙钟，实际格式 yyyy-MM-ddTHH:00:00）的自然日切分；
 *     昨日 baseline 只累计与今日相同进度的小时数（00:00 至当前小时，含当前小时），
 *     保证"今日 vs 昨日同时刻"的公平对比（与 mock §11.1 口径一致）。
 *   - 今日任务总数 = 今日各小时 created 之和（创建口径）。
 *   - 今日任务完成率 = 今日 ΣcreatedSucceededCount / 今日 Σcreated
 *     （今日创建的订单中已完成的比例；createdSucceededCount 即"该小时创建的已完成订单数"）。
 *   - 今日已完成任务平均耗时(ms) = 今日 ΣcreatedSucceededDurationSeconds / ΣcreatedSucceededCount × 1000。
 *   - 今日平均每小时完成任务数 = 今日 Σsucceeded / 已过小时数（00:00 至当前小时，含当前小时）；
 *     baseline 为昨日同时刻同口径（接口无里程字段，原"今日行驶总里程"已替换为本指标）。
 *   - AGV 综合利用率 = runningCount / onlineVehicleCount
 *     （接口无历史忙闲时长，取"在线车辆中运行中占比"的瞬时近似）。
 *   - 故障 AGV 数 / 当前任务积压 / 在线·总 AGV 为快照直读；
 *     接口无昨日同时刻车辆与积压快照，这些指标的 baseline 恒为 null（不展示环比）。
 *   - 实时告警走独立分页接口（isClosed=false 仅未关闭告警），失败只降级该列表；
 *     最近完成任务列表本期不对接，恒为空数组。
 *
 * 任务统计报表计算口径（均由前端基于 dailyCounts / durationDistribution 二次汇总）：
 *   - 接口支持任意起止时间与车辆集合筛选；统计区间由页面 TimeRangePicker 给出
 *     （默认近 7 天，orderTypes 不传使用后端默认「工作任务」，vehicleKeys 空时不传查全部车辆）；
 *     趋势桶恒为自然日，页面固定按 day 粒度渲染。
 *   - 总任务数/完成数/失败数/取消数：终态口径（与 mock §6.2 一致），
 *     分别取各天 completed/failed/cancelled 之和，总数为三者之和；
 *     完成率 = Σcompleted / 总数，总数为 0 时为 null（§6.1 空值规则，UI 展示 "--"）。
 *   - 平均执行时长(ms) = ΣcreatedSucceededDurationSeconds / ΣcreatedSucceededCount × 1000，
 *     已完成数为 0 时为 null。
 *   - 任务量趋势：窗口为所选区间覆盖的自然日（start 所在日至 end 所在日），按天升序；
 *     后端不下发无数据的自然日（实测仅返回有数据的天），缺失天按 0 补齐，
 *     保证 X 轴连续（与实时看板「缺失小时按 0 计」口径一致）；
 *     桶为业务时区自然日 [00:00, 次日 00:00)。
 *   - 时长分布：接口按固定分桶直读，label 归一化后映射到领域桶，未知桶防御性丢弃，
 *     缺失桶由图表按 0 兜底。
 *   - 接口仅有分桶计数、无原始耗时样本，无法精确计算 P50/P90，恒为 null（不展示标线）。
 *   - 接口不提供任务类型分布与任务明细，typeDistribution / rows 恒为空数组（页面展示空状态）。
 *   - 每日 waitDurationSeconds（创建口径总等待时长）已接入类型，页面暂不展示。
 *
 * 故障告警报表计算口径（fetchFaultAlert，基于 dailyAlarmCounts / topAgvAlarms 二次汇总）：
 *   - 接口支持任意起止时间（startTime/endTime），统计区间由页面 TimeRangePicker 给出
 *     （默认近 14 天）；趋势桶恒为自然日，页面固定按 day 粒度渲染。
 *   - 故障次数 = 窗口内各天 (closedCount + unclosedCount) 之和；
 *     未关闭告警数 = 窗口内各天 unclosedCount 之和
 *     （按 startTime 所在自然日归天；窗口前发生且仍未关闭的告警不计入，接口无此数据）。
 *   - 告警关闭率 = ΣclosedCount / Σ(closedCount + unclosedCount)（窗口级，0–1）；
 *     平均告警时长 = ΣtotalDurationSeconds / Σ(closedCount + unclosedCount)
 *     （分子分母同按 startTime 归天；未关闭告警时长按接口累计口径计入，
 *     故为平均告警时长而非严格 MTTR）；窗口内无告警时两者均为 null（§6.1）。
 *   - 故障趋势：窗口为所选区间覆盖的自然日（start 所在日至 end 所在日），按天升序，
 *     后端不下发无数据的自然日时缺失天按 0 补齐，保证 X 轴连续（与任务统计口径一致）；
 *     每天 faultCount = closedCount + unclosedCount，频率（次/天）= 当天次数（日桶覆盖 1 天）。
 *   - 单机故障排行 TOP10：接口仅支持指定单日的 Top10（topAgvDate），无区间聚合，
 *     固定查窗口最后一天（end 所在日；topAgvDate 约定格式 yyyy-MM-dd HH:mm:ss），
 *     页面标题标注对应日期；展示名优先 vehicleName，空时回退 vehicleKey。
 *   - 接口无告警级别维度，alertLevelTrend 恒为空数组（页面已移除级别分布图）；
 *     接口不提供 MTBF / MTTR 与故障类型分布，对应字段恒为 null / 空数组（§6.1 空值规则）；
 *     明细表走独立分页接口，聚合数据 rows 恒为空数组。
 *
 * 故障明细分页口径（fetchFaultDetailPage）：
 *   - 服务端分页：pageNo / pageSize 及来源/告警码/级别/类型/订单/状态/发生与恢复时间范围
 *     等全部接口条件直传后端；默认不带时间参数（页面无区间工具栏），
 *     时间条件由明细筛选区显式指定；
 *   - 接口无排序参数，排序由组件层对当前页数据前端排序；
 *   - 级别映射：接口 alarmLevel 仅 FATAL / WARNING，映射领域 critical / major，
 *     未知级别防御性归为 major；
 *   - 持续时长：durationSeconds × 1000 → durationMs，未关闭时接口不下发（null）；
 *   - 描述取 errorModel.errorDescription + errorDescriptionTranslations，
 *     多语言回退由组件层 resolveFaultDescription 完成。
 */
import dayjs from "dayjs";
import { alarmStatistics, dashboardBoard, pageSystemAlarmRecords, taskStatistics } from "@/api";
import type { DailyCount, TaskStatisticsVO } from "@/types/AnalyzeVisual/OrderStatistics";
import type { AlarmStatisticsVO, DailyAlarmCount, SystemAlarmRecord } from "@/types/AnalyzeVisual/SystemAlarmRecord";
import type { DashboardBoardVO, HourlyCount, VehicleStatistics } from "@/types/Dashboard";
import {
    BUSINESS_TIMEZONE,
    hourlyBuckets,
    startOfDayInBusinessTz,
    todayDateStr,
} from "@/pages/AnalyzeVisual/DashboardShared/model/businessTime";
import {
    REALTIME_BOARD_STAT_DAYS,
    REALTIME_LIST_MAX_ITEMS,
} from "@/pages/AnalyzeVisual/DashboardShared/model/policy";
import type { AlertLevel, VehicleStatus } from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type {
    FaultAlertData,
    FaultDetailLevel,
    FaultDetailPage,
    FaultDetailPageQuery,
    FaultDetailRecord,
    FaultTrendPoint,
    VehicleFaultRankItem,
} from "@/pages/AnalyzeVisual/FaultAlert/model/types";
import {
    VEHICLE_STATUS_ORDER,
    type HourlyComparisonPoint,
    type RealtimeAlertItem,
    type RealtimeDashboardData,
    type RealtimeKpis,
    type VehicleStatusItem,
} from "@/pages/AnalyzeVisual/RealtimeDashboard/model/types";
import {
    type DurationBucket,
    type DurationBucketKey,
    type TaskStatisticsData,
    type TaskStatisticsKpis,
    type TaskVolumePoint,
} from "@/pages/AnalyzeVisual/TaskStatisticsReport/model/types";
import { DashboardDataError, type DashboardRepository } from "./DashboardRepository";
import { MockDashboardRepository } from "./MockDashboardRepository";

/** 车辆状态枚举到 VehicleStatistics 计数字段的映射（快照五类直读） */
const VEHICLE_COUNT_FIELD: Record<VehicleStatus, keyof VehicleStatistics> = {
    running: "runningCount",
    idle: "idleCount",
    charging: "chargingCount",
    fault: "faultCount",
    offline: "offlineCount",
};

/** 单天小时汇总结果：创建口径的总数、完成数、完成总耗时（秒），以及完成口径的完成数 */
interface DayHourlySummary {
    createdTotal: number;
    createdSucceededCount: number;
    createdSucceededDurationSeconds: number;
    /** 完成口径（succeeded）：与趋势图同口径，用于平均每小时完成任务数 */
    succeededTotal: number;
}

/**
 * 业务时区墙钟小时键（yyyy-MM-dd HH，空格分隔）。
 * 与 hourlyIndex 建索引时对 hourTime 规范化（T → 空格）后的前 13 位对齐；
 * 基于 dayjs.tz 对象 format，不受运行环境时区影响。
 */
function hourKeyOf(dayStart: dayjs.Dayjs, hour: number): string {
    return dayStart.add(hour, "hour").format("YYYY-MM-DD HH");
}

/**
 * 汇总某一天 00:00 起 hourCount 个小时的订单统计。
 * 昨日 baseline 传与今日相同的小时数做同时刻对齐；
 * hourlyCounts 中缺失的小时项按 0 计（后端可能不下发无数据的小时）。
 */
function summarizeDay(
    hourlyIndex: Map<string, HourlyCount>,
    dayStart: dayjs.Dayjs,
    hourCount: number,
): DayHourlySummary {
    const summary: DayHourlySummary = {
        createdTotal: 0,
        createdSucceededCount: 0,
        createdSucceededDurationSeconds: 0,
        succeededTotal: 0,
    };
    for (let h = 0; h < hourCount && h < 24; h++) {
        const item = hourlyIndex.get(hourKeyOf(dayStart, h));
        if (!item) continue;
        summary.createdTotal += item.created ?? 0;
        summary.createdSucceededCount += item.createdSucceededCount ?? 0;
        summary.createdSucceededDurationSeconds += item.createdSucceededDurationSeconds ?? 0;
        summary.succeededTotal += item.succeeded ?? 0;
    }
    return summary;
}

/**
 * 创建口径完成率：创建总数为 0 时返回 null（§6.1 空值规则，UI 展示 "--"）。
 */
function completionRateOf(summary: DayHourlySummary): number | null {
    return summary.createdTotal > 0 ? summary.createdSucceededCount / summary.createdTotal : null;
}

/**
 * 创建口径平均完成耗时（秒 → 毫秒）：已完成数为 0 时返回 null（§6.1）。
 */
function avgCompletedDurationMsOf(summary: DayHourlySummary): number | null {
    return summary.createdSucceededCount > 0
        ? (summary.createdSucceededDurationSeconds / summary.createdSucceededCount) * 1000
        : null;
}

/**
 * 平均每小时完成任务数 = Σsucceeded / 已过小时数（00:00 至当前小时，含当前小时）。
 * 分母与今日/昨日趋势桶数一致，保证环比是"今日 vs 昨日同时刻"的公平对比；
 * 小时数为 0 时返回 null（§6.1；hourlyBuckets 至少含当前小时，正常不触发）。
 */
function avgHourlyCompletedCountOf(summary: DayHourlySummary, hourCount: number): number | null {
    return hourCount > 0 ? summary.succeededTotal / hourCount : null;
}

/**
 * 构造今日 vs 昨日按小时对比的完成趋势（截至当前小时，§5.1）。
 * 两条线都取"该小时完成的订单数"（succeeded），按墙钟小时键对齐今昨两天。
 * 桶边界直接复用 hourlyBuckets（只输出今日已完成进度的桶）。
 */
function buildTodayTrend(
    hourlyIndex: Map<string, HourlyCount>,
    todayStart: dayjs.Dayjs,
    yesterdayStart: dayjs.Dayjs,
    buckets: Array<{ bucketStart: string; bucketEnd: string }>,
): HourlyComparisonPoint[] {
    return buckets.map((bucket, h) => ({
        bucketStart: bucket.bucketStart,
        bucketEnd: bucket.bucketEnd,
        todayCompleted: hourlyIndex.get(hourKeyOf(todayStart, h))?.succeeded ?? 0,
        yesterdayCompleted: hourlyIndex.get(hourKeyOf(yesterdayStart, h))?.succeeded ?? 0,
    }));
}

/**
 * 把未关闭系统告警记录映射为实时告警列表项。
 * 逐字段防御性取值（与 mapSystemAlarmRecordToDetail 同策略）；
 * 持续时长接口不下发（未关闭无 durationSeconds），按 当前时刻 - startTime 现算，
 * startTime 缺失/不可解析时为 null（UI 展示 "--"）。
 */
function mapSystemAlarmRecordToAlertItem(record: SystemAlarmRecord, now: number): RealtimeAlertItem {
    const errorModel = record?.errorModel;
    const occurredAt = typeof record?.startTime === "string" ? record.startTime : "";
    const startMs = occurredAt ? new Date(occurredAt).getTime() : NaN;
    return {
        id: record?.id === null || record?.id === undefined ? "" : String(record.id),
        level: mapAlarmLevelToDomain(record?.alarmLevel),
        // 展示名优先 sourceName，空时回退 sourceKey（车辆 key / 设备 key）
        vehicleId: record?.sourceName || record?.sourceKey || "",
        description: {
            text: errorModel?.errorDescription ?? "",
            translations: Array.isArray(errorModel?.errorDescriptionTranslations)
                ? errorModel.errorDescriptionTranslations
                : [],
        },
        occurredAt,
        durationMs: Number.isNaN(startMs) ? null : Math.max(0, now - startMs),
    };
}

/**
 * 拉取实时未关闭告警列表（实时看板告警面板，§5.1）。
 * 独立降级：网络/业务码/结构任何异常都返回空数组并留受控日志，不阻断看板其余面板（§15）。
 */
async function fetchOpenAlertItems(): Promise<RealtimeAlertItem[]> {
    try {
        const res = await pageSystemAlarmRecords({
            pageNo: 1,
            // 列表规模上限 100 条（§12.2）
            pageSize: REALTIME_LIST_MAX_ITEMS,
            // 实时列表只展示未关闭告警（§5.1）
            isClosed: false,
        });
        if (res?.code !== 200 || res?.message !== "success" || !res.data || !Array.isArray(res.data.records)) {
            return [];
        }
        const now = Date.now();
        return res.data.records.map((record) => mapSystemAlarmRecordToAlertItem(record, now));
    } catch (e) {
        console.error("[HttpDashboardRepository] 实时未关闭告警加载失败：", e);
        return [];
    }
}

/**
 * 把看板聚合 VO 映射为实时看板领域数据。
 * 计算口径见文件头注释；now 为调用方当前时间戳（毫秒）；
 * openAlerts 由独立分页链路 fetchOpenAlertItems 提供（失败时已降级为空数组）。
 */
function mapBoardToRealtime(
    board: DashboardBoardVO,
    now: number,
    snapshotAt: string,
    openAlerts: RealtimeAlertItem[],
): RealtimeDashboardData {
    const order = board?.order;
    const vehicle = board?.vehicle;

    // 小时统计索引：key 为业务时区墙钟 "yyyy-MM-dd HH"。
    // 后端 hourTime 实际带 "T" 分隔符（yyyy-MM-ddTHH:00:00），统一替换为空格再截前 13 位，
    // 兼容文档中的空格分隔格式
    const hourlyIndex = new Map<string, HourlyCount>();
    for (const item of order?.hourlyCounts ?? []) {
        if (typeof item?.hourTime === "string" && item.hourTime.length >= 13) {
            hourlyIndex.set(item.hourTime.replace("T", " ").slice(0, 13), item);
        }
    }

    // 今日 00:00 至当前小时的整点桶（§5.1 只展示截至当前小时的数据）；
    // 昨日 baseline 用相同小时数做同时刻对齐
    const todayStr = todayDateStr(now);
    const todayStart = startOfDayInBusinessTz(todayStr);
    const yesterdayStart = todayStart.subtract(1, "day");
    const buckets = hourlyBuckets(todayStr, todayStr, now);

    const todaySummary = summarizeDay(hourlyIndex, todayStart, buckets.length);
    const yesterdaySummary = summarizeDay(hourlyIndex, yesterdayStart, buckets.length);

    const totalVehicleCount = vehicle?.totalVehicleCount ?? 0;
    const onlineVehicleCount = vehicle?.onlineVehicleCount ?? 0;

    const kpis: RealtimeKpis = {
        todayTaskTotal: { current: todaySummary.createdTotal, baseline: yesterdaySummary.createdTotal },
        todayCompletionRate: { current: completionRateOf(todaySummary), baseline: completionRateOf(yesterdaySummary) },
        onlineVehicleCount,
        totalVehicleCount,
        // 快照类指标无昨日同时刻数据，baseline 恒为 null（不展示环比）
        faultVehicleCount: { current: vehicle?.faultCount ?? 0, baseline: null },
        averageCompletedDurationMs: {
            current: avgCompletedDurationMsOf(todaySummary),
            baseline: avgCompletedDurationMsOf(yesterdaySummary),
        },
        // 平均每小时完成任务数：Σsucceeded / 已过小时数（接口无里程字段，
        // 原今日行驶总里程不可算，改为此平均吞吐指标），昨日同小时数做同时刻对比
        averageHourlyCompletedCount: {
            current: avgHourlyCompletedCountOf(todaySummary, buckets.length),
            baseline: avgHourlyCompletedCountOf(yesterdaySummary, buckets.length),
        },
        // 利用率取瞬时近似：在线车辆中运行中占比；无在线车辆时为 null
        fleetUtilization: {
            current: onlineVehicleCount > 0 ? (vehicle?.runningCount ?? 0) / onlineVehicleCount : null,
            baseline: null,
        },
        backlogCount: { current: order?.queueOrderCount ?? 0, baseline: null },
    };

    // AGV 状态分布：五类快照直读，按 §5.1 固定顺序输出
    const vehicleStatus: VehicleStatusItem[] = VEHICLE_STATUS_ORDER.map((status) => ({
        status,
        count: vehicle?.[VEHICLE_COUNT_FIELD[status]] ?? 0,
    }));

    return {
        snapshotAt,
        kpis,
        vehicleStatus,
        todayTaskTrend: buildTodayTrend(hourlyIndex, todayStart, yesterdayStart, buckets),
        openAlerts,
        // 最近完成任务列表本期不对接，展示为空
        recentCompletedTasks: [],
    };
}

/** 业务时区自然日（yyyy-MM-dd）格式校验：非法日期防御性跳过，避免产生 Invalid 桶边界 */
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 接口时长分桶 label → 领域桶 key。
 * 后端按固定分桶下发（<1min / 1-2min / 2-3min / 3-5min / 5-10min / >10min），
 * 本表 key 为「去空白 + 小写」归一化后的 label，避免后端文案空格/大小写差异导致匹配失败。
 */
const DURATION_LABEL_TO_BUCKET: Record<string, DurationBucketKey> = {
    "<1min": "lt1m",
    "1-2min": "m1To2",
    "2-3min": "m2To3",
    "3-5min": "m3To5",
    "5-10min": "m5To10",
    ">10min": "gte10m",
};

/** 归一化接口分桶 label：去除全部空白字符并转小写；非字符串一律归一化为空串（匹配不到即丢弃） */
function normalizeDurationLabel(label: unknown): string {
    return typeof label === "string" ? label.replace(/\s+/g, "").toLowerCase() : "";
}

/**
 * 把任务统计聚合 VO 映射为任务统计领域数据。
 * 计算口径见文件头注释；start/end 为页面所选统计窗口（业务时区墙钟，与请求参数一致）。
 */
function mapTaskStatisticsToDomain(vo: TaskStatisticsVO, start: dayjs.Dayjs, end: dayjs.Dayjs): TaskStatisticsData {
    // 按 date 建索引：date 归一化为 yyyy-MM-dd（实测后端下发 "yyyy-MM-ddT00:00:00"，
    // 与告警统计同样截取前 10 位兼容），非法日期防御性跳过；
    // 实测后端不下发无数据的自然日（只返回有数据的天），
    // 不能假设 dailyCounts 连续覆盖统计窗口；窗口外的异常下发天会被忽略（不进入 KPI 与趋势）
    const dailyIndex = new Map<string, DailyCount>();
    for (const day of Array.isArray(vo?.dailyCounts) ? vo.dailyCounts : []) {
        const dateStr = typeof day?.date === "string" ? day.date.slice(0, 10) : "";
        if (BUSINESS_DATE_PATTERN.test(dateStr)) {
            dailyIndex.set(dateStr, day);
        }
    }

    // 趋势窗口为所选区间覆盖的自然日（start 所在日至 end 所在日），按天升序，缺失天按 0 补齐。
    // KPI 在同一循环内按窗口汇总，保证 KPI 与趋势图口径严格一致；
    // 区间逆序（start 晚于 end）时窗口天数 ≤ 0，循环不执行，退化为空趋势 + 零值 KPI
    const startDay = start.startOf("day");
    const totalDays = end.startOf("day").diff(startDay, "day") + 1;

    // 终态口径汇总（与 mock §6.2 一致）：完成/失败/取消按天直读累加，总数为三者之和
    let completedCount = 0;
    let failedCount = 0;
    let canceledCount = 0;
    // 平均耗时的分子分母：创建口径的已完成订单数与已完成总耗时（秒）
    let succeededCount = 0;
    let succeededDurationSeconds = 0;

    // 任务量趋势：每天一个业务时区自然日桶 [00:00, 次日 00:00)
    const volumeTrend: TaskVolumePoint[] = [];
    for (let i = 0; i < totalDays; i++) {
        const dayStart = startDay.add(i, "day");
        const day = dailyIndex.get(dayStart.format("YYYY-MM-DD"));
        completedCount += day?.completed ?? 0;
        failedCount += day?.failed ?? 0;
        canceledCount += day?.cancelled ?? 0;
        succeededCount += day?.createdSucceededCount ?? 0;
        succeededDurationSeconds += day?.createdSucceededDurationSeconds ?? 0;
        volumeTrend.push({
            bucketStart: dayStart.toISOString(),
            bucketEnd: dayStart.add(1, "day").toISOString(),
            completedCount: day?.completed ?? 0,
            failedCount: day?.failed ?? 0,
            canceledCount: day?.cancelled ?? 0,
        });
    }

    const totalCount = completedCount + failedCount + canceledCount;
    const kpis: TaskStatisticsKpis = {
        totalCount,
        completedCount,
        failedCount,
        canceledCount,
        // 完成率：终态口径；总数为 0 时为 null（§6.1 空值规则）
        completionRate: totalCount > 0 ? completedCount / totalCount : null,
        // 平均执行时长：后端只给「已完成数 + 总耗时（秒）」两个原始值，由前端相除并换算为毫秒
        averageCompletedDurationMs:
            succeededCount > 0 ? Math.round((succeededDurationSeconds / succeededCount) * 1000) : null,
    };

    // 时长分布：label 归一化后映射到领域桶；未知桶防御性丢弃，缺失桶由图表按 0 兜底
    const durationDistribution: DurationBucket[] = [];
    const apiBuckets = Array.isArray(vo?.durationDistribution) ? vo.durationDistribution : [];
    for (const apiBucket of apiBuckets) {
        const key = DURATION_LABEL_TO_BUCKET[normalizeDurationLabel(apiBucket?.label)];
        if (!key) continue;
        durationDistribution.push({ bucket: key, count: apiBucket?.count ?? 0 });
    }

    return {
        kpis,
        volumeTrend,
        durationDistribution,
        // 接口仅有分桶计数、无原始耗时样本，无法精确计算 P50/P90（不展示标线）
        durationPercentiles: { p50Ms: null, p90Ms: null },
        // 接口不提供任务类型分布与任务明细，页面对应区域展示空状态
        typeDistribution: [],
        rows: [],
    };
}

/**
 * 把告警统计聚合 VO 映射为故障告警领域数据。
 * 计算口径见文件头注释；start/end 为页面所选统计窗口（业务时区墙钟，与请求参数一致），
 * now 为调用方当前时间戳（毫秒）。
 */
function mapAlarmStatisticsToDomain(vo: AlarmStatisticsVO, start: dayjs.Dayjs, end: dayjs.Dayjs, now: number): FaultAlertData {
    // 按天建索引：date 归一化为 yyyy-MM-dd（兼容后端 "yyyy-MM-ddTHH:mm:ss" / 空格分隔格式），
    // 非法日期防御性跳过；不能假设 dailyAlarmCounts 连续覆盖统计窗口，窗口外的异常下发天会被忽略
    const dailyIndex = new Map<string, DailyAlarmCount>();
    for (const day of Array.isArray(vo?.dailyAlarmCounts) ? vo.dailyAlarmCounts : []) {
        const dateStr = typeof day?.date === "string" ? day.date.slice(0, 10) : "";
        if (BUSINESS_DATE_PATTERN.test(dateStr)) {
            dailyIndex.set(dateStr, day);
        }
    }

    // 趋势窗口为所选区间覆盖的自然日（start 所在日至 end 所在日），按天升序，缺失天按 0 补齐。
    // KPI 在同一循环内按窗口汇总，保证 KPI 与趋势图口径严格一致；
    // 区间逆序（start 晚于 end）时窗口天数 ≤ 0，循环不执行，退化为空趋势 + 零值 KPI
    const startDay = start.startOf("day");
    const totalDays = end.startOf("day").diff(startDay, "day") + 1;

    let faultCount = 0;
    let openAlertCount = 0;
    // 关闭数与告警总时长单独累计，用于窗口级关闭率 / 平均告警时长 KPI
    let closedTotal = 0;
    let totalDurationSeconds = 0;
    // 故障趋势：每天一个业务时区自然日桶 [00:00, 次日 00:00)
    const trend: FaultTrendPoint[] = [];
    for (let i = 0; i < totalDays; i++) {
        const dayStart = startDay.add(i, "day");
        const day = dailyIndex.get(dayStart.format("YYYY-MM-DD"));
        const closed = day?.closedCount ?? 0;
        const unclosed = day?.unclosedCount ?? 0;
        // 当天故障次数 = 关闭 + 未关闭（均以 startTime 所在自然日归天）
        const count = closed + unclosed;
        faultCount += count;
        openAlertCount += unclosed;
        closedTotal += closed;
        totalDurationSeconds += day?.totalDurationSeconds ?? 0;
        trend.push({
            bucketStart: dayStart.toISOString(),
            bucketEnd: dayStart.add(1, "day").toISOString(),
            faultCount: count,
            // 桶恒为自然日（覆盖 1 天）：频率（次/天）= 当天次数（§6.4 公式在日桶下的结果）
            frequencyPerDay: count,
        });
    }

    // 窗口级派生 KPI：分母与故障次数同口径（startTime 归天），窗口内无告警时为 null（§6.1）
    // 关闭率 = Σclosed / Σ(closed + unclosed)；
    // 平均告警时长 = ΣtotalDurationSeconds / Σ(closed + unclosed)，
    // 未关闭告警的时长按接口累计口径计入，故为「平均告警时长」而非严格 MTTR
    const closedRate = faultCount > 0 ? closedTotal / faultCount : null;
    const avgDurationMs = faultCount > 0 ? (totalDurationSeconds / faultCount) * 1000 : null;

    // 单机故障排行 TOP10：接口已按次数倒序下发（topAgvDate = 窗口最后一天），
    // 展示名优先 vehicleName，空时回退 vehicleKey；图表组件会再做一次稳定排序
    const topAgvAlarms = Array.isArray(vo?.topAgvAlarms) ? vo.topAgvAlarms : [];
    const vehicleRanking: VehicleFaultRankItem[] = topAgvAlarms.map((item) => ({
        vehicleId: item?.vehicleName || item?.vehicleKey || "",
        faultCount: item?.alarmCount ?? 0,
    }));

    return {
        generatedAt: dayjs.tz(now, BUSINESS_TIMEZONE).format("YYYY-MM-DDTHH:mm:ssZ"),
        kpis: {
            faultCount,
            openAlertCount,
            // 接口不提供车辆运行时长与恢复耗时样本，MTBF / MTTR 恒为 null（§6.1，UI 展示 "--"）
            mtbfHours: null,
            mttrMinutes: null,
            closedRate,
            avgDurationMs,
        },
        trend,
        // 接口无故障类型维度，恒为空数组（页面不展示类型分布）
        typeDistribution: [],
        vehicleRanking,
        // 接口无告警级别维度，恒为空数组（页面级别分布图展示空状态）
        alertLevelTrend: [],
        // 明细表走独立分页接口（fetchFaultDetailPage），此处恒为空数组
        rows: [],
    };
}

/** 领域级别 → 接口 alarmLevel（接口仅 FATAL / WARNING 两级） */
const FAULT_LEVEL_TO_API: Record<FaultDetailLevel, string> = {
    critical: "FATAL",
    major: "WARNING",
};

/** 文本条件归一化：去首尾空白，空串视为不筛选（不传该参数） */
function trimQueryParam(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

/** 接口 alarmLevel → 领域级别；未知级别防御性归为 major（重要） */
function mapAlarmLevelToDomain(level: unknown): AlertLevel {
    return level === "FATAL" ? "critical" : "major";
}

/**
 * 把系统告警记录映射为故障明细行。
 * 逐字段防御性取值：后端漏字段时退化为空串 / null，不让单行异常击垮整页。
 */
function mapSystemAlarmRecordToDetail(record: SystemAlarmRecord): FaultDetailRecord {
    const errorModel = record?.errorModel;
    return {
        id: record?.id === null || record?.id === undefined ? "" : String(record.id),
        level: mapAlarmLevelToDomain(record?.alarmLevel),
        // 告警类型为后端自由字符串，原文展示、不做枚举映射
        alarmType: typeof record?.alarmType === "string" ? record.alarmType : "",
        // 来源名称优先 sourceName，空时回退 sourceKey（车辆 key / 设备 key）
        vehicleName: record?.sourceName || record?.sourceKey || "",
        description: {
            text: errorModel?.errorDescription ?? "",
            translations: Array.isArray(errorModel?.errorDescriptionTranslations)
                ? errorModel.errorDescriptionTranslations
                : [],
        },
        occurredAt: record?.startTime ?? null,
        recoveredAt: record?.endTime ?? null,
        // 持续时长秒 → 毫秒；未关闭告警接口不下发该字段，保持 null（§5.4 排序视为最大）
        durationMs: typeof record?.durationSeconds === "number" ? record.durationSeconds * 1000 : null,
        closed: record?.isClosed === true,
    };
}

/**
 * Dashboard HTTP 仓储。
 * 实时看板、任务统计报表与故障告警报表（聚合 + 明细分页）走真实接口；
 * 效率报表暂委托 mock，待对应接口联调后替换。
 */
export class HttpDashboardRepository implements DashboardRepository {
    /**
     * 效率报表 KPI/图表的后端接口尚未联调，暂委托 mock 实现（§11）。
     * 实时看板、任务统计报表与故障告警报表已走真实接口，不会触发委托分支。
     */
    private readonly mockFallback = new MockDashboardRepository();

    async fetchRealtime(): Promise<RealtimeDashboardData> {
        // days=2 覆盖今天+昨天；orderTypes 不传，使用后端默认（工作任务）
        // 实时告警列表走独立分页链路，与看板聚合并行请求；其失败已在内部降级为空数组，
        // 不影响本方法的业务码校验（只有看板聚合失败才整页降级，§15）
        const [res, openAlerts] = await Promise.all([
            dashboardBoard({ days: REALTIME_BOARD_STAT_DAYS }),
            fetchOpenAlertItems(),
        ]);
        // HTTP 成功约定（§7.3）：code === 200 且 message === "success"，该判断只存在于本适配器
        if (res?.code !== 200 || res?.message !== "success") {
            throw new DashboardDataError("BUSINESS_ERROR", res);
        }
        if (!res.data) {
            throw new DashboardDataError("INVALID_RESPONSE", res);
        }
        // 响应时间戳为毫秒；缺失或为 0 时回退到本地当前时间，输出带业务时区偏移的 ISO 8601
        const ts = typeof res.timestamp === "number" && res.timestamp > 0 ? res.timestamp : Date.now();
        const snapshotAt = dayjs.tz(ts, BUSINESS_TIMEZONE).format("YYYY-MM-DDTHH:mm:ssZ");
        return mapBoardToRealtime(res.data, Date.now(), snapshotAt, openAlerts);
    }

    /**
     * 任务统计报表：接口支持任意起止日期与车辆筛选（orderTypes 不传，使用后端默认「工作任务」），
     * start/end 由页面 TimeRangePicker 给出（业务时区墙钟，格式 yyyy-MM-dd HH:mm:ss），
     * vehicleKeys 为页面车辆多选的选中集合，空数组不传（查全部车辆）。
     */
    async fetchTaskStatistics(start: dayjs.Dayjs, end: dayjs.Dayjs, vehicleKeys?: string[]): Promise<TaskStatisticsData> {
        const res = await taskStatistics({
            startTime: start.format("YYYY-MM-DD HH:mm:ss"),
            endTime: end.format("YYYY-MM-DD HH:mm:ss"),
            // 空数组与「不传」同义（不筛选车辆），统一不传，避免后端对空集合的歧义处理
            vehicleKeys: vehicleKeys?.length ? vehicleKeys : undefined,
        });
        // HTTP 成功约定（§7.3）：code === 200 且 message === "success"，该判断只存在于本适配器
        if (res?.code !== 200 || res?.message !== "success") {
            throw new DashboardDataError("BUSINESS_ERROR", res);
        }
        if (!res.data) {
            throw new DashboardDataError("INVALID_RESPONSE", res);
        }
        return mapTaskStatisticsToDomain(res.data, start, end);
    }

    /**
     * 故障告警报表：接口支持任意起止时间（startTime/endTime），
     * start/end 由页面 TimeRangePicker 给出（业务时区墙钟，格式 yyyy-MM-dd HH:mm:ss）；
     * topAgvDate 取窗口最后一天（end 所在日 00:00），用于单机故障排行 TOP10；
     * topAlarmVehicleKey 页面无消费场景，不传。
     */
    async fetchFaultAlert(start: dayjs.Dayjs, end: dayjs.Dayjs): Promise<FaultAlertData> {
        const now = Date.now();
        const res = await alarmStatistics({
            startTime: start.format("YYYY-MM-DD HH:mm:ss"),
            endTime: end.format("YYYY-MM-DD HH:mm:ss"),
            // topAgvDate 文档标注 string(date-time)，实测后端约定格式为 yyyy-MM-dd HH:mm:ss
            // （如 2026-08-11 00:00:00，当天开始时间），只传日期会解析失败返回 500
            topAgvDate: end.startOf("day").format("YYYY-MM-DD HH:mm:ss"),
        });
        // HTTP 成功约定（§7.3）：code === 200 且 message === "success"，该判断只存在于本适配器
        if (res?.code !== 200 || res?.message !== "success") {
            throw new DashboardDataError("BUSINESS_ERROR", res);
        }
        if (!res.data) {
            throw new DashboardDataError("INVALID_RESPONSE", res);
        }
        return mapAlarmStatisticsToDomain(res.data, start, end, now);
    }

    /**
     * 故障明细分页查询：已对接真实接口（服务端分页）。
     * 支持来源/告警码/级别/类型/订单/状态/发生与恢复时间范围等全部接口条件；
     * 默认不携带时间参数（页面无区间工具栏），时间条件由筛选区显式指定。
     */
    async fetchFaultDetailPage(query: FaultDetailPageQuery): Promise<FaultDetailPage> {
        const res = await pageSystemAlarmRecords({
            pageNo: query.pageNo,
            pageSize: query.pageSize,
            // 不筛选时不传对应参数（而非传空串），语义更明确
            alarmLevel: query.level ? FAULT_LEVEL_TO_API[query.level] : undefined,
            alarmType: trimQueryParam(query.alarmType),
            sourceType: trimQueryParam(query.sourceType),
            sourceKey: trimQueryParam(query.sourceKey),
            sourceName: trimQueryParam(query.sourceName),
            alarmCode: trimQueryParam(query.alarmCode),
            orderKey: trimQueryParam(query.orderKey),
            // 布尔条件直传：undefined 不筛选，false 仅查未关闭（不能用 || undefined 兜底，会吞掉 false）
            isClosed: query.closed,
            startTimeBegin: query.startTimeBegin || undefined,
            startTimeEnd: query.startTimeEnd || undefined,
            endTimeBegin: query.endTimeBegin || undefined,
            endTimeEnd: query.endTimeEnd || undefined,
        });
        // HTTP 成功约定（§7.3）：code === 200 且 message === "success"，该判断只存在于本适配器
        if (res?.code !== 200 || res?.message !== "success") {
            throw new DashboardDataError("BUSINESS_ERROR", res);
        }
        if (!res.data || !Array.isArray(res.data.records)) {
            throw new DashboardDataError("INVALID_RESPONSE", res);
        }
        return {
            rows: res.data.records.map(mapSystemAlarmRecordToDetail),
            total: typeof res.data.total === "number" ? res.data.total : 0,
        };
    }
}

/**
 * Dashboard 仓储单例。
 * 实现无内部状态（效率报表的 mock 委托也是无状态字段），
 * 4 个看板页面共享同一实例，页面组件直接 import 使用，不再经 context 注入。
 */
export const dashboardRepository = new HttpDashboardRepository();
