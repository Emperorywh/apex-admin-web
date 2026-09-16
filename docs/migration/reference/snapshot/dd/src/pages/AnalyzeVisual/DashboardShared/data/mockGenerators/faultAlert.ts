/**
 * @description 故障告警 mock 生成器（§11 / §6.4）
 *
 * 种子 = hash("fault" + startDate + endDate)。
 * 指标公式（§6.4）：
 *   - MTBF = 区间所有车辆可用运行小时总和 / 故障次数；故障次数为 0 时返回 null
 *   - MTTR = 区间已恢复故障的恢复耗时平均值；无已恢复故障时返回 null
 *   - 时间桶故障频率 = 桶内故障次数 / 桶实际覆盖天数
 */
import {
    bucketCalendarDays,
    dailyBuckets,
    hourlyBuckets,
    isoWeekBuckets,
    startOfDayInBusinessTz,
} from "@/pages/AnalyzeVisual/DashboardShared/model/businessTime";
import type { DateRange } from "@/pages/AnalyzeVisual/DashboardShared/model/dateRange";
import type {
    AlertLevelPoint,
    FaultAlertData,
    FaultAlertKpis,
    FaultDetailRecord,
    FaultDetailRow,
    FaultTrendPoint,
    VehicleFaultRankItem,
} from "@/pages/AnalyzeVisual/FaultAlert/model/types";
import { ALERT_LEVEL_ORDER, FAULT_TYPE_ORDER } from "@/pages/AnalyzeVisual/FaultAlert/model/types";
import type { AlertLevel, FaultStatus, FaultType } from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import { createPrng, hashStringToSeed, pick, randomFloat, randomInt, toIsoWithOffset } from "./_prng";

const TZ_OFFSET_MIN = -480;
const VEHICLE_IDS = Array.from({ length: 12 }, (_, i) => `AGV-${String(i + 1).padStart(3, "0")}`);
const VEHICLE_COUNT = VEHICLE_IDS.length;

/**
 * 生成单个故障明细行。
 */
function buildFaultRow(rng: () => number, idSeed: string, dayStartMs: number, dayEndMs: number): FaultDetailRow {
    const occurredAt = dayStartMs + randomFloat(rng, 0, dayEndMs - dayStartMs);
    const level = pick(rng, ALERT_LEVEL_ORDER);
    const type = pick(rng, FAULT_TYPE_ORDER);
    // 70% 已恢复 / 20% 处理中 / 10% 未处理（open）
    const r = rng();
    let status: FaultStatus;
    if (r < 0.7) status = "closed";
    else if (r < 0.9) status = "recovering";
    else status = "open";

    let recoveredAt: string | null = null;
    let durationMs: number | null = null;
    if (status === "closed") {
        // 恢复耗时 5~240 分钟
        const dur = randomInt(rng, 5 * 60_000, 240 * 60_000);
        durationMs = dur;
        recoveredAt = toIsoWithOffset(occurredAt + dur, 0, TZ_OFFSET_MIN);
    } else if (status === "recovering") {
        // 处理中：尚未关闭，但视为计算"持续时间"用 now - occurred
        recoveredAt = null;
        durationMs = null;
    } else {
        recoveredAt = null;
        durationMs = null;
    }

    return {
        id: `f-${idSeed}`,
        level,
        type,
        vehicleId: pick(rng, VEHICLE_IDS),
        description: { key: `dashboard.fault.mock.${type}`, values: { id: pick(rng, VEHICLE_IDS) } },
        occurredAt: toIsoWithOffset(occurredAt, 0, TZ_OFFSET_MIN),
        recoveredAt,
        durationMs,
        status,
    };
}

/**
 * 生成区间内全部故障事件。
 */
function generateRows(range: DateRange, rng: () => number): FaultDetailRow[] {
    const rows: FaultDetailRow[] = [];
    const startDay = startOfDayInBusinessTz(range.startDate);
    const endDayExclusive = startOfDayInBusinessTz(range.endDate).add(1, "day");
    let dayCursor = startDay;
    let dayIndex = 0;
    while (dayCursor.isBefore(endDayExclusive)) {
        const dayStartMs = dayCursor.valueOf();
        const dayEndMs = dayCursor.add(1, "day").valueOf();
        // 每日故障量 1~6 次
        const dayTotal = randomInt(rng, 1, 6);
        for (let i = 0; i < dayTotal; i++) {
            rows.push(buildFaultRow(rng, `${range.startDate}-${dayIndex}-${i}`, dayStartMs, dayEndMs));
        }
        dayCursor = dayCursor.add(1, "day");
        dayIndex++;
    }
    return rows;
}

/**
 * 计算故障趋势（柱+折线，§5.4）。
 * 频率 = 桶内故障次数 / 桶实际覆盖天数（§6.4）。
 */
function aggregateFaultTrend(range: DateRange, rows: FaultDetailRow[]): FaultTrendPoint[] {
    const buckets =
        range.granularity === "hour"
            ? hourlyBuckets(range.startDate, range.endDate, Date.now())
            : range.granularity === "day"
              ? dailyBuckets(range.startDate, range.endDate)
              : isoWeekBuckets(range.startDate, range.endDate);
    return buckets.map((b) => {
        const startMs = new Date(b.bucketStart).getTime();
        const endMs = new Date(b.bucketEnd).getTime();
        const faultCount = rows.filter((row) => {
            const t = new Date(row.occurredAt).getTime();
            return t >= startMs && t < endMs;
        }).length;
        const days = bucketCalendarDays(b.bucketStart, b.bucketEnd);
        return {
            bucketStart: b.bucketStart,
            bucketEnd: b.bucketEnd,
            faultCount,
            frequencyPerDay: days > 0 ? faultCount / days : null,
        };
    });
}

/**
 * 计算告警级别趋势（堆叠柱，§5.4）。
 */
function aggregateAlertLevelTrend(range: DateRange, rows: FaultDetailRow[]): AlertLevelPoint[] {
    const buckets =
        range.granularity === "hour"
            ? hourlyBuckets(range.startDate, range.endDate, Date.now())
            : range.granularity === "day"
              ? dailyBuckets(range.startDate, range.endDate)
              : isoWeekBuckets(range.startDate, range.endDate);
    return buckets.map((b) => {
        const startMs = new Date(b.bucketStart).getTime();
        const endMs = new Date(b.bucketEnd).getTime();
        const inBucket = rows.filter((row) => {
            const t = new Date(row.occurredAt).getTime();
            return t >= startMs && t < endMs;
        });
        return {
            bucketStart: b.bucketStart,
            bucketEnd: b.bucketEnd,
            criticalCount: inBucket.filter((r) => r.level === "critical").length,
            majorCount: inBucket.filter((r) => r.level === "major").length,
            minorCount: inBucket.filter((r) => r.level === "minor").length,
            infoCount: inBucket.filter((r) => r.level === "info").length,
        };
    });
}

/**
 * 计算故障类型分布。
 */
function computeTypeDistribution(rows: FaultDetailRow[]) {
    const counts = new Map<FaultType, number>();
    for (const t of FAULT_TYPE_ORDER) counts.set(t, 0);
    for (const r of rows) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    return FAULT_TYPE_ORDER.map((key) => ({ key, value: counts.get(key) ?? 0 }));
}

/**
 * 计算单机故障排行 TOP10（按次数降序，次数相同按 AGV ID 升序，§5.4）。
 */
function computeVehicleRanking(rows: FaultDetailRow[]): VehicleFaultRankItem[] {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.vehicleId, (counts.get(r.vehicleId) ?? 0) + 1);
    return [...counts.entries()]
        .map(([vehicleId, faultCount]) => ({ vehicleId, faultCount }))
        .sort((a, b) => b.faultCount - a.faultCount || a.vehicleId.localeCompare(b.vehicleId))
        .slice(0, 10);
}

/**
 * 生成故障告警完整报表。
 */
export function generateFaultAlertData(range: DateRange): FaultAlertData {
    const seed = hashStringToSeed("fault", range.startDate, range.endDate);
    const rng = createPrng(seed);
    const rows = generateRows(range, rng);

    const faultCount = rows.length;
    // MTBF：区间所有车辆可用运行小时总和 / 故障次数
    // 可用运行小时 ≈ calendarDays × 24 × VEHICLE_COUNT × 0.9（剔除离线/充电等）
    const totalAvailableHours = range.calendarDays * 24 * VEHICLE_COUNT * 0.9;
    const mtbfHours = faultCount > 0 ? totalAvailableHours / faultCount : null;
    // MTTR：已恢复故障恢复耗时平均（未恢复不计入，§6.4）
    const recoveredDurations = rows.filter((r) => r.durationMs !== null).map((r) => r.durationMs as number);
    const mttrMinutes =
        recoveredDurations.length > 0
            ? recoveredDurations.reduce((s, d) => s + d, 0) / recoveredDurations.length / 60_000
            : null;
    // 选定区间内发生且当前仍未关闭的告警数
    const openAlertCount = rows.filter((r) => r.status !== "closed").length;
    // 关闭率 = 已关闭 / 总数；平均告警时长 = 总时长 / 总数
    // （mock 仅已关闭行有 durationMs，未关闭行按 0 计入分子，
    // 对应真实接口未关闭告警按累计时长计入 totalDurationSeconds 的口径）；
    // 无故障时两者均为 null（§6.1）
    const closedRowCount = rows.length - openAlertCount;
    const closedRate = rows.length > 0 ? closedRowCount / rows.length : null;
    const avgDurationMs =
        rows.length > 0
            ? rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) / rows.length
            : null;

    const kpis: FaultAlertKpis = {
        faultCount,
        mtbfHours,
        mttrMinutes,
        openAlertCount,
        closedRate,
        avgDurationMs,
    };

    const trend = aggregateFaultTrend(range, rows);
    const typeDistribution = computeTypeDistribution(rows);
    const vehicleRanking = computeVehicleRanking(rows);
    const alertLevelTrend = aggregateAlertLevelTrend(range, rows);

    return {
        generatedAt: toIsoWithOffset(Date.now(), 0, TZ_OFFSET_MIN),
        kpis,
        trend,
        typeDistribution,
        vehicleRanking,
        alertLevelTrend,
        rows,
    };
}

/** 故障告警空数据 */
export function emptyFaultAlertData(): FaultAlertData {
    return {
        generatedAt: toIsoWithOffset(Date.now(), 0, TZ_OFFSET_MIN),
        kpis: { faultCount: 0, mtbfHours: null, mttrMinutes: null, openAlertCount: 0, closedRate: null, avgDurationMs: null },
        trend: [],
        typeDistribution: [],
        vehicleRanking: [],
        alertLevelTrend: [],
        rows: [],
    };
}

/**
 * 把 mock 明细行转换为服务端分页明细结构（mock 专用）。
 * 与真实接口的差异：alarmType 展示领域 code（sensor 等），
 * 描述无译文可回退，直接展示 i18n key 原文——mock 仅用于开发联调，可接受。
 */
export function toFaultDetailRecord(row: FaultDetailRow): FaultDetailRecord {
    return {
        id: row.id,
        level: row.level,
        alarmType: row.type,
        vehicleName: row.vehicleId,
        description: { text: row.description.key, translations: [] },
        occurredAt: row.occurredAt,
        recoveredAt: row.recoveredAt,
        durationMs: row.durationMs,
        closed: row.status === "closed",
    };
}
