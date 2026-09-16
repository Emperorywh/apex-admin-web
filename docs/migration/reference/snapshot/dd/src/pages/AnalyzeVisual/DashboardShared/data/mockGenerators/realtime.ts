/**
 * @description 实时看板 mock 生成器（§11）
 *
 * 可复现性策略（§11.1）：
 *   - 累计指标（今日任务数、完成数、平均每小时完成任务数等）由固定日计划截取到 clock.now 计算，
 *     同一业务日内不随轮询倒退。
 *   - baseline 表示昨日同一时刻采用同一公式得到的值。
 *   - 瞬时指标（车辆状态、积压、未关闭告警）种子包含 floor(now/5000)，
 *     同一 5 秒桶稳定、跨桶可变化。
 *   - ComparableMetric.baseline 不使用任意随机数伪造环比。
 */
import { startOfDayInBusinessTz } from "@/pages/AnalyzeVisual/DashboardShared/model/businessTime";
import type { RealtimeAlertItem, RealtimeDashboardData, RealtimeKpis, RecentTaskItem, VehicleStatusItem } from "@/pages/AnalyzeVisual/RealtimeDashboard/model/types";
import type { VehicleStatus } from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type { Clock } from "./_scenario";
import { createPrng, hashStringToSeed, pick, randomFloat, randomInt, toIsoWithOffset } from "./_prng";

/** Asia/Shanghai 相对 UTC 的时区偏移分钟数（UTC+8） */
const TZ_OFFSET_MIN = -480;

const TASK_TYPES = ["transport", "picking", "replenishment", "inventory"] as const;
const POINTS = ["A01", "B02", "C03", "D04", "E05", "F06", "G07", "H08", "充电站-1", "工作站-2"];
const VEHICLE_IDS = Array.from({ length: 12 }, (_, i) => `AGV-${String(i + 1).padStart(3, "0")}`);

/**
 * 业务时区下指定日期的当前时刻（小时，0-23）。
 */
function currentHourInBusinessTz(now: number): number {
    const d = new Date(now);
    // 转换为 UTC+8 的分量
    const utc = d.getTime() + d.getTimezoneOffset() * 60_000;
    const shifted = new Date(utc + Math.abs(TZ_OFFSET_MIN) * 60_000);
    return shifted.getHours();
}

/**
 * 业务时区下今天的 YYYY-MM-DD。
 */
function todayInBusinessTz(now: number): string {
    const d = new Date(now);
    const utc = d.getTime() + d.getTimezoneOffset() * 60_000;
    const shifted = new Date(utc + Math.abs(TZ_OFFSET_MIN) * 60_000);
    const y = shifted.getFullYear();
    const m = String(shifted.getMonth() + 1).padStart(2, "0");
    const day = String(shifted.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * 给定日期种子，生成 24 小时的"计划完成任务数"数组。
 * 同一种子永远得到相同结果，今日/昨日共用同一函数（不同种子）。
 */
function dailyPlanCompletedCounts(dateStr: string): number[] {
    const rng = createPrng(hashStringToSeed("plan", dateStr));
    // 工作日形状：早高峰、午休低谷、下午高峰
    const shape = [2, 3, 4, 6, 8, 10, 9, 6, 4, 3, 2, 2, 2, 3, 5, 8, 10, 9, 6, 4, 3, 2, 1, 1];
    return shape.map((base) => Math.max(0, Math.round(base + randomFloat(rng, -1.5, 1.5))));
}

/**
 * 累计到指定小时（含）的计划完成数。
 */
function cumulativeCompletedByHour(plan: number[], upToHour: number): number {
    return plan.slice(0, Math.min(upToHour + 1, 24)).reduce((s, n) => s + n, 0);
}

/**
 * 计算日级累计指标（完成数、总任务数、里程、平均耗时）。
 * 用同一日种子，保证公式一致；今日截取到当前小时、昨日截取到同一小时作为 baseline。
 */
interface DailyCumulative {
    completed: number;
    total: number;
    failed: number;
    canceled: number;
    /** 平均每小时完成任务数 = 截至当前小时的完成数 / 已过小时数（含当前小时） */
    avgHourlyCompletedCount: number;
    avgCompletedDurationMs: number;
    fleetUtilization: number;
}

function buildDailyCumulative(dateStr: string, upToHour: number): DailyCumulative {
    const completed = cumulativeCompletedByHour(dailyPlanCompletedCounts(dateStr), upToHour);
    // 失败 + 取消 = 总 - 完成，按固定比例
    const failed = Math.round(completed * 0.06);
    const canceled = Math.round(completed * 0.03);
    const total = completed + failed + canceled;
    // 平均每小时完成任务数：分母与真实仓储口径一致（含当前小时，至少 1）
    const avgHourlyCompletedCount = completed / (upToHour + 1);
    // 平均完成时长：180~360 秒
    const durRng = createPrng(hashStringToSeed("dur", dateStr));
    const avgCompletedDurationMs = completed > 0 ? Math.round(randomFloat(durRng, 180_000, 360_000)) : 0;
    // 车队利用率：今日基于小时推进，越到晚上越接近日峰值
    const peak = randomFloat(createPrng(hashStringToSeed("util", dateStr)), 0.62, 0.82);
    const fleetUtilization = upToHour <= 0 ? 0 : Math.min(0.95, peak * (upToHour / 18));
    return { completed, total, failed, canceled, avgHourlyCompletedCount, avgCompletedDurationMs, fleetUtilization };
}

/**
 * 生成实时快照。种子由 floor(now/5000) 决定瞬时部分。
 */
export function generateRealtimeDashboardData(now: number, clock: Clock = { now: () => now }): RealtimeDashboardData {
    const currentNow = clock.now();
    const today = todayInBusinessTz(currentNow);
    const yesterday = shiftDate(today, -1);
    const hour = currentHourInBusinessTz(currentNow);

    const todayCum = buildDailyCumulative(today, hour);
    const yesterdayCum = buildDailyCumulative(yesterday, hour);

    const completionRate = todayCum.total > 0 ? todayCum.completed / todayCum.total : null;
    const yesterdayCompletionRate = yesterdayCum.total > 0 ? yesterdayCum.completed / yesterdayCum.total : null;

    // 5 秒桶种子，瞬时指标
    const bucketSeed = hashStringToSeed("rt", Math.floor(currentNow / 5000));
    const instantRng = createPrng(bucketSeed);

    const totalVehicleCount = VEHICLE_IDS.length;
    const vehicleStatus = generateVehicleStatus(instantRng, totalVehicleCount);
    const onlineVehicleCount = vehicleStatus
        .filter((v) => v.status !== "offline")
        .reduce((s, v) => s + v.count, 0);
    const faultVehicleCount = vehicleStatus.find((v) => v.status === "fault")?.count ?? 0;

    const kpis: RealtimeKpis = {
        todayTaskTotal: { current: todayCum.total, baseline: yesterdayCum.total },
        todayCompletionRate: { current: completionRate, baseline: yesterdayCompletionRate },
        onlineVehicleCount,
        totalVehicleCount,
        faultVehicleCount: { current: faultVehicleCount, baseline: faultVehicleCount },
        averageCompletedDurationMs: {
            current: todayCum.avgCompletedDurationMs || null,
            baseline: yesterdayCum.avgCompletedDurationMs || null,
        },
        averageHourlyCompletedCount: { current: todayCum.avgHourlyCompletedCount, baseline: yesterdayCum.avgHourlyCompletedCount },
        fleetUtilization: {
            current: todayCum.fleetUtilization,
            baseline: yesterdayCum.fleetUtilization,
        },
        backlogCount: { current: randomInt(instantRng, 2, 12), baseline: randomInt(instantRng, 2, 12) },
    };

    const todayTaskTrend = buildHourlyTrend(today, yesterday, hour);
    const openAlerts = generateOpenAlerts(instantRng, currentNow);
    const recentCompletedTasks = generateRecentCompletedTasks(instantRng, currentNow, today);

    return {
        snapshotAt: toIsoWithOffset(currentNow, 0, TZ_OFFSET_MIN),
        kpis,
        vehicleStatus,
        todayTaskTrend,
        openAlerts,
        recentCompletedTasks,
    };
}

/**
 * 生成车辆状态分布。五类互斥，数量之和等于 totalVehicleCount（§6.1）。
 */
function generateVehicleStatus(rng: () => number, total: number): VehicleStatusItem[] {
    // 先用比例分配，再校准保证总和 = total
    const running = Math.round(total * randomFloat(rng, 0.45, 0.6));
    const idle = Math.round(total * randomFloat(rng, 0.15, 0.25));
    const charging = Math.round(total * randomFloat(rng, 0.1, 0.18));
    const fault = randomInt(rng, 0, Math.max(1, Math.floor(total * 0.08)));
    let offline = total - running - idle - charging - fault;
    // 校准：若 offline 为负，从 running 扣；若过大也接受（离线居多场景）
    if (offline < 0) {
        offline = 0;
    }
    const order: VehicleStatus[] = ["running", "idle", "charging", "fault", "offline"];
    const map: Record<VehicleStatus, number> = {
        running,
        idle,
        charging,
        fault,
        offline,
    };
    // 修正使总和等于 total
    const sum = order.reduce((s, k) => s + map[k], 0);
    map.running += total - sum;
    return order.map((status) => ({ status, count: Math.max(0, map[status]) }));
}

/**
 * 构造今日 vs 昨日按小时对比的趋势（截至当前小时，§5.1）。
 */
function buildHourlyTrend(today: string, yesterday: string, currentHour: number) {
    const todayPlan = dailyPlanCompletedCounts(today);
    const yesterdayPlan = dailyPlanCompletedCounts(yesterday);
    const todayStart = startOfDayInBusinessTz(today);
    const points = [];
    for (let h = 0; h <= currentHour && h < 24; h++) {
        const tStart = todayStart.add(h, "hour");
        points.push({
            bucketStart: tStart.toISOString(),
            bucketEnd: tStart.add(1, "hour").toISOString(),
            todayCompleted: todayPlan[h],
            yesterdayCompleted: yesterdayPlan[h],
        });
    }
    return points;
}

/**
 * 生成实时未关闭告警列表（§5.1：只展示未关闭告警）。
 * 描述为 FaultDescription 形状（text + translations）：mock 仅用于开发联调，
 * 固定中文文案、无译文列表；真实接口走 errorModel 多语言译文。
 */
function generateOpenAlerts(rng: () => number, now: number): RealtimeAlertItem[] {
    const count = randomInt(rng, 3, 8);
    const levels = ["critical", "major", "minor", "info"] as const;
    // 级别 → 中文描述模板（{id} 替换为车辆编号）
    const textOf: Record<(typeof levels)[number], string> = {
        critical: "严重告警：车辆 {id} 传感器异常",
        major: "重要告警：车辆 {id} 通信中断",
        minor: "一般告警：车辆 {id} 电量偏低",
        info: "提示：车辆 {id} 进入充电",
    };
    const items: RealtimeAlertItem[] = [];
    for (let i = 0; i < count; i++) {
        const occurredMs = -randomInt(rng, 60_000, 50_400_000); // 1 分钟到 14 小时前
        const level = pick(rng, levels);
        items.push({
            id: `alert-${Math.floor(now / 5000)}-${i}`,
            level,
            vehicleId: pick(rng, VEHICLE_IDS),
            description: { text: textOf[level].replace("{id}", pick(rng, VEHICLE_IDS)), translations: [] },
            occurredAt: toIsoWithOffset(now, occurredMs, TZ_OFFSET_MIN),
            durationMs: -occurredMs,
        });
    }
    // 防御 null（领域类型允许 null）：mock 数据恒为数值，?? 0 仅满足类型
    return items.sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));
}

/**
 * 生成最近完成任务滚动表（§5.1）。
 */
function generateRecentCompletedTasks(rng: () => number, now: number, _today: string): RecentTaskItem[] {
    const count = randomInt(rng, 5, 10);
    const items: RecentTaskItem[] = [];
    for (let i = 0; i < count; i++) {
        const completedOffsetMs = -randomInt(rng, 60_000, 3_600_000);
        items.push({
            id: `task-${Math.floor(now / 5000)}-${i}`,
            vehicleId: pick(rng, VEHICLE_IDS),
            type: pick(rng, TASK_TYPES),
            startPoint: pick(rng, POINTS),
            endPoint: pick(rng, POINTS),
            durationMs: randomInt(rng, 120_000, 600_000),
            completedAt: toIsoWithOffset(now, completedOffsetMs, TZ_OFFSET_MIN),
            status: "completed",
        });
    }
    return items.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

/** 把 YYYY-MM-DD 平移 n 天，返回新的 YYYY-MM-DD（与运行环境时区无关） */
function shiftDate(dateStr: string, n: number): string {
    const d = startOfDayInBusinessTz(dateStr).add(n, "day");
    return d.format("YYYY-MM-DD");
}
