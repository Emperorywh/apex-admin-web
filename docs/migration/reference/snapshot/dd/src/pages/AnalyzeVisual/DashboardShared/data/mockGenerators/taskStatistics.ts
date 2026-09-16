/**
 * @description 任务统计 mock 生成器（§11）
 *
 * 种子 = hash("task" + startDate + endDate)，相同区间深度相等（§11.1）。
 * 报表任务只统计在区间内进入终态的任务（§6.2）。
 */
import {
    dailyBuckets,
    hourlyBuckets,
    isoWeekBuckets,
    startOfDayInBusinessTz,
} from "@/pages/AnalyzeVisual/DashboardShared/model/businessTime";
import type { DateRange } from "@/pages/AnalyzeVisual/DashboardShared/model/dateRange";
import {
    DURATION_BUCKET_BOUNDS_MS,
    DURATION_BUCKET_ORDER,
    type DurationBucket,
    type DurationBucketKey,
    type TaskDetailRow,
    type TaskStatisticsData,
    type TaskStatisticsKpis,
    type TaskVolumePoint,
} from "@/pages/AnalyzeVisual/TaskStatisticsReport/model/types";
import type { TaskStatus, TaskType } from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import { createPrng, hashStringToSeed, pick, randomFloat, randomInt, toIsoWithOffset } from "./_prng";

/** Asia/Shanghai 相对 UTC 的时区偏移分钟数（UTC+8） */
const TZ_OFFSET_MIN = -480;

const TASK_TYPES: TaskType[] = ["transport", "picking", "replenishment", "inventory"];
const POINTS = ["A01", "B02", "C03", "D04", "E05", "F06", "G07", "H08", "充电站-1", "工作站-2"];
const VEHICLE_IDS = Array.from({ length: 12 }, (_, i) => `AGV-${String(i + 1).padStart(3, "0")}`);

/**
 * 生成单个任务明细行。
 * createdAt 和 finishedAt 都落在 [dayStart, dayEnd) 区间内（业务时区）。
 */
function buildTaskRow(rng: () => number, idSeed: string, dayStartMs: number, dayEndMs: number, status: TaskStatus): TaskDetailRow {
    const span = dayEndMs - dayStartMs;
    const createdAtOffset = randomFloat(rng, 0, span * 0.85);
    const createdAt = dayStartMs + createdAtOffset;
    // 任务执行耗时（区分状态）
    let durationMs: number;
    let finishedAt: string;
    if (status === "completed") {
        durationMs = randomInt(rng, 30_000, 900_000);
        finishedAt = toIsoWithOffset(0, createdAt + durationMs, TZ_OFFSET_MIN);
    } else if (status === "failed") {
        // 失败任务耗时较短
        durationMs = randomInt(rng, 10_000, 240_000);
        finishedAt = toIsoWithOffset(0, createdAt + durationMs, TZ_OFFSET_MIN);
    } else {
        // 取消任务通常很快被取消
        durationMs = randomInt(rng, 5_000, 120_000);
        finishedAt = toIsoWithOffset(0, createdAt + durationMs, TZ_OFFSET_MIN);
    }
    return {
        id: `t-${idSeed}`,
        vehicleId: pick(rng, VEHICLE_IDS),
        type: pick(rng, TASK_TYPES),
        startPoint: pick(rng, POINTS),
        endPoint: pick(rng, POINTS),
        // createdAt / finishedAt 输出为带业务时区偏移的 ISO 8601（§3.3）
        createdAt: toIsoWithOffset(createdAt, 0, TZ_OFFSET_MIN),
        finishedAt,
        durationMs,
        distanceMeters: status === "completed" ? randomInt(rng, 50, 800) : randomInt(rng, 0, 200),
        status,
    };
}

/**
 * 生成区间内全部终态任务明细行。
 * 每个自然日按固定形状产出若干任务，状态分布为完成 88% / 失败 7% / 取消 5%。
 */
function generateRows(range: DateRange, rng: () => number): TaskDetailRow[] {
    const rows: TaskDetailRow[] = [];
    const startDay = startOfDayInBusinessTz(range.startDate);
    const endDayExclusive = startOfDayInBusinessTz(range.endDate).add(1, "day");
    let dayCursor = startDay;
    let dayIndex = 0;
    while (dayCursor.isBefore(endDayExclusive)) {
        const dayStartMs = dayCursor.valueOf();
        const dayEndMs = dayCursor.add(1, "day").valueOf();
        // 每日任务量形状（与实时 mock 形状一致）
        const shape = [2, 3, 4, 6, 8, 10, 9, 6, 4, 3, 2, 2, 2, 3, 5, 8, 10, 9, 6, 4, 3, 2, 1, 1];
        const dayTotal = shape.reduce((s, n) => s + n, 0) + randomInt(rng, -10, 15);
        for (let i = 0; i < Math.max(0, dayTotal); i++) {
            const r = rng();
            const status: TaskStatus = r < 0.88 ? "completed" : r < 0.95 ? "failed" : "canceled";
            rows.push(buildTaskRow(rng, `${range.startDate}-${dayIndex}-${i}`, dayStartMs, dayEndMs, status));
        }
        dayCursor = dayCursor.add(1, "day");
        dayIndex++;
    }
    return rows;
}

/**
 * 按 range.granularity 把任务聚合到时间桶（§5.2）。
 */
function aggregateVolumeTrend(range: DateRange, rows: TaskDetailRow[]): TaskVolumePoint[] {
    const buckets =
        range.granularity === "hour"
            ? hourlyBuckets(range.startDate, range.endDate, Date.now())
            : range.granularity === "day"
              ? dailyBuckets(range.startDate, range.endDate)
              : isoWeekBuckets(range.startDate, range.endDate);
    return buckets.map((b) => {
        const start = b.bucketStart;
        const end = b.bucketEnd;
        let completedCount = 0;
        let failedCount = 0;
        let canceledCount = 0;
        for (const row of rows) {
            // 以 finishedAt 落在桶内为统计口径（进入终态时刻）
            const finishedMs = new Date(row.finishedAt).getTime();
            if (finishedMs >= new Date(start).getTime() && finishedMs < new Date(end).getTime()) {
                if (row.status === "completed") completedCount++;
                else if (row.status === "failed") failedCount++;
                else canceledCount++;
            }
        }
        return { bucketStart: start, bucketEnd: end, completedCount, failedCount, canceledCount };
    });
}

/**
 * 计算时长分布桶 + P50/P90（从原始完成任务时长，nearest-rank，§6.2）。
 */
function computeDurationStats(rows: TaskDetailRow[]): {
    distribution: DurationBucket[];
    percentiles: { p50Ms: number | null; p90Ms: number | null };
} {
    const completedDurations = rows
        .filter((r) => r.status === "completed")
        .map((r) => r.durationMs)
        .sort((a, b) => a - b);
    const counts: Record<DurationBucketKey, number> = {
        lt1m: 0,
        m1To2: 0,
        m2To3: 0,
        m3To5: 0,
        m5To10: 0,
        gte10m: 0,
    };
    for (const ms of completedDurations) {
        for (const key of DURATION_BUCKET_ORDER) {
            const bounds = DURATION_BUCKET_BOUNDS_MS[key];
            if (ms >= bounds.min && ms < bounds.max) {
                counts[key]++;
                break;
            }
        }
    }
    const distribution: DurationBucket[] = DURATION_BUCKET_ORDER.map((bucket) => ({ bucket, count: counts[bucket] }));
    const percentiles = {
        p50Ms: nearestRankPercentile(completedDurations, 0.5),
        p90Ms: nearestRankPercentile(completedDurations, 0.9),
    };
    return { distribution, percentiles };
}

/**
 * nearest-rank 百分位（§6.2）：索引 = ceil(p × n) - 1。
 * 空样本返回 null。
 */
export function nearestRankPercentile(sortedAsc: number[], p: number): number | null {
    if (!sortedAsc.length) return null;
    const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil(p * sortedAsc.length) - 1));
    return sortedAsc[idx];
}

/**
 * 计算任务类型分布。
 */
function computeTypeDistribution(rows: TaskDetailRow[]) {
    const counts = new Map<TaskType, number>();
    for (const t of TASK_TYPES) counts.set(t, 0);
    for (const r of rows) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    return TASK_TYPES.map((key) => ({ key, value: counts.get(key) ?? 0 }));
}

/**
 * 生成任务统计完整报表。
 */
export function generateTaskStatisticsData(range: DateRange): TaskStatisticsData {
    const seed = hashStringToSeed("task", range.startDate, range.endDate);
    const rng = createPrng(seed);
    const rows = generateRows(range, rng);
    const completedCount = rows.filter((r) => r.status === "completed").length;
    const failedCount = rows.filter((r) => r.status === "failed").length;
    const canceledCount = rows.filter((r) => r.status === "canceled").length;
    const totalCount = completedCount + failedCount + canceledCount;
    const completedDurations = rows.filter((r) => r.status === "completed").map((r) => r.durationMs);
    const averageCompletedDurationMs = completedDurations.length
        ? Math.round(completedDurations.reduce((s, d) => s + d, 0) / completedDurations.length)
        : null;

    const kpis: TaskStatisticsKpis = {
        totalCount,
        completedCount,
        failedCount,
        canceledCount,
        completionRate: totalCount > 0 ? completedCount / totalCount : null,
        averageCompletedDurationMs,
    };

    const volumeTrend = aggregateVolumeTrend(range, rows);
    const { distribution, percentiles } = computeDurationStats(rows);
    const typeDistribution = computeTypeDistribution(rows);

    return {
        kpis,
        volumeTrend,
        durationDistribution: distribution,
        durationPercentiles: percentiles,
        typeDistribution,
        rows,
    };
}

/** 任务统计空数据 */
export function emptyTaskStatisticsData(): TaskStatisticsData {
    return {
        kpis: {
            totalCount: 0,
            completedCount: 0,
            failedCount: 0,
            canceledCount: 0,
            completionRate: null,
            averageCompletedDurationMs: null,
        },
        volumeTrend: [],
        durationDistribution: DURATION_BUCKET_ORDER.map((bucket) => ({ bucket, count: 0 })),
        durationPercentiles: { p50Ms: null, p90Ms: null },
        typeDistribution: [],
        rows: [],
    };
}
