/**
 * @description 任务统计领域数据结构（§7.2）
 *
 * 报表返回完整报表和全部明细。
 * 本阶段前端负责明细筛选、排序和分页。
 */
import {
    CategoryValue,
    TaskStatus,
    TaskType,
} from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type { DateRange } from "@/pages/AnalyzeVisual/DashboardShared/model/dateRange";

/**
 * 任务统计返回完整报表和全部明细。
 * 本阶段前端负责明细筛选、排序和分页。
 */
export interface TaskStatisticsData {
    kpis: TaskStatisticsKpis;
    volumeTrend: TaskVolumePoint[];
    durationDistribution: DurationBucket[];
    durationPercentiles: { p50Ms: number | null; p90Ms: number | null };
    typeDistribution: CategoryValue<TaskType>[];
    rows: TaskDetailRow[];
}

export interface TaskStatisticsKpis {
    totalCount: number;
    completedCount: number;
    failedCount: number;
    canceledCount: number;
    completionRate: number | null;
    averageCompletedDurationMs: number | null;
}

export interface TaskVolumePoint {
    bucketStart: string;
    bucketEnd: string;
    completedCount: number;
    failedCount: number;
    canceledCount: number;
}

export type DurationBucketKey = "lt1m" | "m1To2" | "m2To3" | "m3To5" | "m5To10" | "gte10m";

export interface DurationBucket {
    bucket: DurationBucketKey;
    count: number;
}

export interface TaskDetailRow {
    id: string;
    vehicleId: string;
    type: TaskType;
    startPoint: string;
    endPoint: string;
    createdAt: string;
    finishedAt: string;
    durationMs: number;
    distanceMeters: number;
    status: TaskStatus;
}

/** 时长分布桶顺序（§5.2） */
export const DURATION_BUCKET_ORDER: DurationBucketKey[] = ["lt1m", "m1To2", "m2To3", "m3To5", "m5To10", "gte10m"];

/** 任务类型枚举顺序（用于饼图稳定展示） */
export const TASK_TYPE_ORDER: TaskType[] = ["transport", "picking", "replenishment", "inventory"];

/** 任务状态枚举顺序（用于筛选下拉稳定展示） */
export const TASK_STATUS_ORDER: TaskStatus[] = ["completed", "failed", "canceled"];

/** 时长分布桶上下界（毫秒），用于计算 P50/P90 落桶与展示 */
export const DURATION_BUCKET_BOUNDS_MS: Record<DurationBucketKey, { min: number; max: number }> = {
    lt1m: { min: 0, max: 60_000 },
    m1To2: { min: 60_000, max: 120_000 },
    m2To3: { min: 120_000, max: 180_000 },
    m3To5: { min: 180_000, max: 300_000 },
    m5To10: { min: 300_000, max: 600_000 },
    gte10m: { min: 600_000, max: Number.POSITIVE_INFINITY },
};

/**
 * AGV 利用率排行单项（原效率分析页面迁入）。
 * activeDurationMs / availableDurationMs 单位毫秒；utilization 为 0–1 小数。
 */
export interface VehicleUtilizationItem {
    vehicleId: string;
    activeDurationMs: number;
    availableDurationMs: number;
    utilization: number | null;
}

/**
 * 利用率趋势单点（原效率分析页面迁入）。
 * utilization 为 0–1 小数，展示层负责百分比格式化。
 */
export interface EfficiencyTrendPoint {
    bucketStart: string;
    bucketEnd: string;
    utilization: number | null;
}

/** 报表组件消费的 range 类型别名 */
export type TaskStatisticsRange = DateRange;
