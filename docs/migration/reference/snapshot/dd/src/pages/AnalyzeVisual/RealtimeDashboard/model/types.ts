/**
 * @description 实时看板领域数据结构（§7.2）
 *
 * 所有时间和单位在领域层保持稳定：
 *   - snapshotAt 使用带时区偏移的 ISO 8601
 *   - 持续时间使用毫秒
 *   - 比例使用 0–1 小数，展示层负责百分比格式化
 */
import {
    AlertLevel,
    CategoryValue,
    ComparableMetric,
    TaskType,
    VehicleStatus,
} from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type { FaultDescription } from "@/pages/AnalyzeVisual/FaultAlert/model/types";

/**
 * 实时看板一次轮询返回的完整快照。
 * snapshotAt 必须包含时区偏移，用于判断数据新鲜度。
 */
export interface RealtimeDashboardData {
    snapshotAt: string;
    kpis: RealtimeKpis;
    vehicleStatus: VehicleStatusItem[];
    todayTaskTrend: HourlyComparisonPoint[];
    openAlerts: RealtimeAlertItem[];
    recentCompletedTasks: RecentTaskItem[];
}

export interface RealtimeKpis {
    todayTaskTotal: ComparableMetric;
    todayCompletionRate: ComparableMetric;
    onlineVehicleCount: number;
    totalVehicleCount: number;
    faultVehicleCount: ComparableMetric;
    averageCompletedDurationMs: ComparableMetric;
    /**
     * 今日平均每小时完成任务数 = 今日 Σsucceeded / 已过小时数（00:00 至当前小时，含当前小时）。
     * 原接口无行驶里程字段（旧 todayDistanceMeters 恒为 null），改为基于 hourlyCounts 可算的平均吞吐。
     */
    averageHourlyCompletedCount: ComparableMetric;
    fleetUtilization: ComparableMetric;
    backlogCount: ComparableMetric;
}

export interface VehicleStatusItem {
    status: VehicleStatus;
    count: number;
}

export interface HourlyComparisonPoint {
    bucketStart: string;
    bucketEnd: string;
    todayCompleted: number;
    yesterdayCompleted: number;
}

/**
 * 实时告警列表项（真实接口 SystemAlarmRecord 的领域映射，isClosed=false 未关闭告警）。
 */
export interface RealtimeAlertItem {
    /** 事件 ID（记录 id 的字符串形式） */
    id: string;
    /** 告警级别：FATAL→critical / WARNING→major */
    level: AlertLevel;
    /** 展示名（sourceName，空时回退 sourceKey；mock 为车辆编号） */
    vehicleId: string;
    /** 故障描述（errorDescription 原文 + 多语言译文，展示走 resolveFaultDescription 回退链） */
    description: FaultDescription;
    /** 发生时间（startTime）；缺失为空串，展示 "--" */
    occurredAt: string;
    /**
     * 持续时长毫秒。未关闭告警接口不下发 durationSeconds，
     * 由 HTTP 适配器按 当前时刻 - startTime 现算；startTime 缺失/不可解析时为 null（展示 "--"）
     */
    durationMs: number | null;
}

export interface RecentTaskItem {
    id: string;
    vehicleId: string;
    type: TaskType;
    startPoint: string;
    endPoint: string;
    durationMs: number;
    completedAt: string;
    status: "completed";
}

/** 实时 KPI 名称键，供展示层指标定义表查找 */
export type RealtimeKpiKey = keyof RealtimeKpis;

/** AGV 状态分布饼图中心展示用：在线数 = running + idle + charging + fault */
export const ONLINE_VEHICLE_STATUSES: VehicleStatus[] = ["running", "idle", "charging", "fault"];

/** 车辆状态饼图展示顺序（§5.1） */
export const VEHICLE_STATUS_ORDER: VehicleStatus[] = ["running", "idle", "charging", "fault", "offline"];

/** 实时 KPI 中可携带环比的指标 key 列表（其余为非比例指标） */
export type TaskTypeCategoryValue = CategoryValue<TaskType>;
