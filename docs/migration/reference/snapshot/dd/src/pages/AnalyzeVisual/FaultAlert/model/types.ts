/**
 * @description 故障告警领域数据结构（§7.2）
 *
 * 未恢复事件的 recoveredAt 和 durationMs 为 null。
 */
import {
    AlertLevel,
    CategoryValue,
    FaultStatus,
    FaultType,
    LocalizedMessage,
} from "@/pages/AnalyzeVisual/DashboardShared/model/types";
import type { DateRange } from "@/pages/AnalyzeVisual/DashboardShared/model/dateRange";
import type { TranslationItem } from "@/types/PlaybackTypings";

/**
 * 故障告警领域数据。
 * 未恢复事件的 recoveredAt 和 durationMs 为 null。
 */
export interface FaultAlertData {
    generatedAt: string;
    kpis: FaultAlertKpis;
    trend: FaultTrendPoint[];
    typeDistribution: CategoryValue<FaultType>[];
    vehicleRanking: VehicleFaultRankItem[];
    alertLevelTrend: AlertLevelPoint[];
    rows: FaultDetailRow[];
}

export interface FaultAlertKpis {
    faultCount: number;
    /** 接口不提供车辆运行时长样本，真实数据源下恒为 null（§6.1，UI 展示 "--"） */
    mtbfHours: number | null;
    /** 接口不提供恢复耗时样本，真实数据源下恒为 null（§6.1，UI 展示 "--"） */
    mttrMinutes: number | null;
    openAlertCount: number;
    /**
     * 窗口内告警关闭率（0–1）：ΣclosedCount / Σ(closedCount + unclosedCount)，
     * 与故障次数同窗口同归天口径；窗口内无告警时分母为 0，返回 null（§6.1）
     */
    closedRate: number | null;
    /**
     * 窗口内平均单次告警时长（毫秒）：ΣtotalDurationSeconds / Σ(closedCount + unclosedCount)。
     * 分子分母同按 startTime 归天；未关闭告警的时长按接口累计口径计入，
     * 因此它是「平均告警时长」而非严格 MTTR；窗口内无告警时返回 null（§6.1）
     */
    avgDurationMs: number | null;
}

export interface FaultTrendPoint {
    bucketStart: string;
    bucketEnd: string;
    faultCount: number;
    frequencyPerDay: number | null;
}

export interface VehicleFaultRankItem {
    /** 展示名（真实接口为 vehicleName，空时回退 vehicleKey；mock 为车辆编号） */
    vehicleId: string;
    faultCount: number;
}

export interface AlertLevelPoint {
    bucketStart: string;
    bucketEnd: string;
    criticalCount: number;
    majorCount: number;
    minorCount: number;
    infoCount: number;
}

export interface FaultDetailRow {
    id: string;
    level: AlertLevel;
    type: FaultType;
    vehicleId: string;
    description: LocalizedMessage;
    occurredAt: string;
    recoveredAt: string | null;
    durationMs: number | null;
    status: FaultStatus;
}

/** 告警级别展示顺序（§5.4） */
export const ALERT_LEVEL_ORDER: AlertLevel[] = ["critical", "major", "minor", "info"];

/** 故障类型展示顺序（§5.4） */
export const FAULT_TYPE_ORDER: FaultType[] = ["sensor", "battery", "communication", "mechanical", "software"];

/** 报表组件消费的 range 类型别名 */
export type FaultAlertRange = DateRange;

// ---------------------------------------------------------------------------
// 故障明细分页（服务端分页，对接 /fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords）
// ---------------------------------------------------------------------------

/**
 * 明细表级别筛选项。
 * 接口 alarmLevel 只有 FATAL / WARNING 两级，映射到领域 critical / major，
 * 因此筛选也只开放这两级（minor / info 在真实数据中不存在）。
 */
export type FaultDetailLevel = Extract<AlertLevel, "critical" | "major">;

/**
 * 故障明细分页查询参数（服务端分页）。
 * 所有条件均可选、不传表示不筛选；接口不支持排序参数。
 */
export interface FaultDetailPageQuery {
    /** 当前页码（从 1 开始） */
    pageNo: number;
    /** 每页条数 */
    pageSize: number;
    /** 告警级别（领域 code，由 HTTP 适配器映射为 FATAL / WARNING） */
    level?: FaultDetailLevel;
    /** 告警类型（后端 alarmType 原文精确匹配） */
    alarmType?: string;
    /** 告警来源：VEHICLE 车辆 / DEVICE 设备 / SERVER 服务器 */
    sourceType?: string;
    /** 告警来源标识（车辆key/设备key/服务器标识等） */
    sourceKey?: string;
    /** 告警来源名称 */
    sourceName?: string;
    /** 告警码 */
    alarmCode?: string;
    /** 关联订单key */
    orderKey?: string;
    /** 是否已关闭（true 仅查已关闭 / false 仅查未关闭，不传查全部；由 HTTP 适配器映射为接口 isClosed） */
    closed?: boolean;
    /** 发生时间起（startTime 下界，格式 YYYY-MM-DD HH:mm:ss） */
    startTimeBegin?: string;
    /** 发生时间止（startTime 上界，同上） */
    startTimeEnd?: string;
    /** 恢复时间起（endTime 下界，同上） */
    endTimeBegin?: string;
    /** 恢复时间止（endTime 上界，同上） */
    endTimeEnd?: string;
}

/**
 * 故障描述：errorModel.errorDescription 原文 + 多语言译文。
 * 展示层按 locale 走回退链（当前语言 → zh_CN → en_US → 原文），
 * 与 ErrorEntryTable 组件的口径一致。
 */
export interface FaultDescription {
    /** errorDescription 原文 */
    text: string;
    /** errorDescriptionTranslations 多语言译文列表 */
    translations: TranslationItem[];
}

/**
 * 故障明细行（真实接口 SystemAlarmRecord 的领域映射）。
 * 与 mock 的 FaultDetailRow 刻意分离：alarmType 为后端自由字符串，
 * 状态只有 关闭/未关闭 两种（接口无「处理中」中间态）。
 */
export interface FaultDetailRecord {
    /** 事件 ID（记录 id 的字符串形式） */
    id: string;
    /** 告警级别：FATAL→critical / WARNING→major */
    level: AlertLevel;
    /** 告警类型（后端 alarmType 原文，不做枚举映射） */
    alarmType: string;
    /** 告警来源名称（sourceName，空时回退 sourceKey） */
    vehicleName: string;
    /** 故障描述（原文 + 多语言译文） */
    description: FaultDescription;
    /** 发生时间（startTime） */
    occurredAt: string | null;
    /** 恢复时间（endTime，未关闭为 null） */
    recoveredAt: string | null;
    /** 持续时长（durationSeconds × 1000；未关闭时接口不下发，为 null） */
    durationMs: number | null;
    /** 是否已关闭（isClosed） */
    closed: boolean;
}

/** 故障明细分页结果（服务端分页） */
export interface FaultDetailPage {
    rows: FaultDetailRecord[];
    total: number;
}
