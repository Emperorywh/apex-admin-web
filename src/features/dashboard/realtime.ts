/**
 * 实时看板纯计算模块（P34 私有；页面 owner 的指标口径单一定义点）。
 *
 * 旧实现等价迁移自 C:\code\dd DashboardShared/data/HttpDashboardRepository.ts
 * 的 mapBoardToRealtime 及 RealtimeDashboard 展示模型（本轮逐行核对）：
 * - 全部 KPI 由前端基于 board 聚合的 hourlyCounts / vehicle 二次汇总，
 *   图表、KPI 卡共用同一份快照结果，不出现第二套同义计算（规格 11.2）；
 * - 时间口径：部署时区墙钟（规格 11.3），后端 hourTime 形如
 *   `yyyy-MM-ddTHH:00:00`，统一归一化为 `yyyy-MM-dd HH` 墙钟小时键切今日/昨日；
 * - 空值纪律（规格 11.2 表）：0 是有效值；分母为 0 / 缺失 → null（不可计算），
 *   绝不补 0；快照类指标无昨日基线 → baseline 恒 null（不展示环比）；
 * - 昨日基线只累计与今日相同进度的小时数（00:00 至当前整点，含当前小时），
 *   保证「今日 vs 昨日同时刻」公平对比。
 */

import { DEPLOY_TIMEZONE } from '@/constants/datetime'
import { dayjs } from '@/utils/datetime/deployDayjs'
import { parseBackendDateTime } from '@/utils/datetime/datetimeDisplay'
import type {
  DashboardBoardDto,
  HourlyCountDto,
  SystemAlarmRecordDto,
  TranslationDto,
} from '@/services/dashboard/dashboard.service.types'

/** 车辆五类状态 key（协议无枚举字段，按 VehicleStatistics 计数字段语义固化） */
export type VehicleStatusKey = 'running' | 'idle' | 'charging' | 'fault' | 'offline'

/** 状态分布饼图展示顺序（旧 VEHICLE_STATUS_ORDER 等价保留） */
export const VEHICLE_STATUS_ORDER: VehicleStatusKey[] = [
  'running',
  'idle',
  'charging',
  'fault',
  'offline',
]

/** 车辆状态 → 译文 key（中文 key 即文案；展示层 t() 动态翻译，语言切换重建） */
export const VEHICLE_STATUS_LABEL: Record<VehicleStatusKey, string> = {
  running: '运行',
  idle: '空闲',
  charging: '充电',
  fault: '故障',
  offline: '离线',
}

/** 告警级别 → 译文 key：协议仅 FATAL/WARNING 两级（未知级别按协议原值展示） */
export const ALERT_LEVEL_LABEL: Record<'FATAL' | 'WARNING', string> = {
  FATAL: '严重',
  WARNING: '重要',
}

/** 单个可环比指标：current 当前值 / baseline 昨日同时刻基线（null = 不可计算或无基线） */
export interface ComparableMetric {
  current: number | null
  baseline: number | null
}

/** 看板一次轮询的完整快照（KPI + 状态分布 + 今日趋势，图表与卡片共用） */
export interface RealtimeSnapshot {
  /** 快照时间戳（毫秒，取响应 timestamp，缺失回退本地时钟；仅诊断展示用） */
  snapshotAt: number
  kpis: {
    /** 今日任务总数（创建口径） */
    todayTaskTotal: ComparableMetric
    /** 今日任务完成率（0–1 小数；创建口径） */
    todayCompletionRate: ComparableMetric
    /** 在线 AGV 数（运行+空闲+充电+故障） */
    onlineVehicleCount: number
    /** AGV 总数 */
    totalVehicleCount: number
    /** 故障 AGV 数（快照直读） */
    faultVehicleCount: number
    /** 今日已完成任务平均耗时（毫秒；创建口径） */
    averageCompletedDurationMs: ComparableMetric
    /** 今日平均每小时完成任务数（完成口径 ÷ 已过小时数） */
    averageHourlyCompletedCount: ComparableMetric
    /** AGV 综合利用率（0–1；在线车辆中运行占比的瞬时近似） */
    fleetUtilization: ComparableMetric
    /** 当前任务积压（队列订单数，快照直读） */
    backlogCount: number
  }
  /** 五类状态计数（固定顺序，0 值保留供图例展示完整口径） */
  vehicleStatus: Array<{ status: VehicleStatusKey; count: number }>
  /** 今日 vs 昨日按小时完成数对比（截至当前小时，含当前小时） */
  todayTaskTrend: Array<{
    /** 桶起始时刻（部署时区整点）的展示标签，如 `09-20 14:00` */
    label: string
    todayCompleted: number
    yesterdayCompleted: number
  }>
}

/** 实时告警列表项（未关闭告警的展示形态） */
export interface OpenAlertItem {
  /** 记录 ID（字符串形态作 React key；缺失退化为空串） */
  id: string
  /** 告警级别协议原值（FATAL/WARNING/未知值） */
  level: string
  /** 来源类型协议原值（VEHICLE/DEVICE/SERVER/未知值） */
  sourceType: string
  /** 来源展示名（sourceName 优先，空回退 sourceKey） */
  sourceName: string
  /** 来源标识（sourceKey；车辆详情导航的实体参数） */
  sourceKey: string
  /** 关联订单 key（任务详情导航的实体参数；缺失为空串） */
  orderKey: string
  /** 关联订单名称（缺失为空串） */
  orderName: string
  /** 描述原文（errorDescription，可能为空串） */
  descriptionText: string
  /** 描述多语言译文（展示走 resolveAlertDescription 回退链） */
  descriptionTranslations: TranslationDto[]
  /** 发生时间（原样字符串；缺失空串，展示留白） */
  occurredAt: string
  /** 持续时长毫秒（当前时刻 − startTime 现算；不可算为 null，展示留白） */
  durationMs: number | null
}

/** 任意风格语言标识 → `lang_REGION`（lang 小写、region 大写；与旧 normalizeLocaleKey 同口径） */
function normalizeLocaleKey(key: string): string {
  if (!key) return ''
  const parts = key.replace(/-/g, '_').split('_')
  const lang = (parts[0] || '').toLowerCase()
  const region = (parts[1] || '').toUpperCase()
  return region ? `${lang}_${region}` : lang
}

/**
 * 告警描述译文回退链（旧 resolveFaultDescription 等价）：
 * 当前语言 → zh_CN → en_US → errorDescription 原文；译文空白视为未命中继续回退。
 */
export function resolveAlertDescription(
  item: Pick<OpenAlertItem, 'descriptionText' | 'descriptionTranslations'>,
  locale: string,
): string {
  const translations = Array.isArray(item.descriptionTranslations)
    ? item.descriptionTranslations
    : []
  const want = normalizeLocaleKey(locale)
  for (const target of [want, 'zh_CN', 'en_US']) {
    if (!target) continue
    const hit = translations.find(
      (entry) => entry && normalizeLocaleKey(entry.translationKey ?? '') === target,
    )
    const value = hit?.translationValue
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return item.descriptionText ?? ''
}

/**
 * 后端 hourTime → 部署时区墙钟小时键 `yyyy-MM-dd HH`。
 * 实测带 `T` 分隔（yyyy-MM-ddTHH:00:00），统一替换为空格后截前 13 位，
 * 兼容文档声明的空格分隔形态；非法/过短输入返回 null（防御性跳过，不猜测）。
 */
function hourKeyOf(raw: string | undefined): string | null {
  if (typeof raw !== 'string' || raw.length < 13) return null
  return raw.replace('T', ' ').slice(0, 13)
}

/** 单天小时汇总结果：创建口径的总数/已完成数/总耗时（秒），以及完成口径的完成数 */
interface DayHourlySummary {
  createdTotal: number
  createdSucceededCount: number
  createdSucceededDurationSeconds: number
  succeededTotal: number
}

/**
 * 汇总某天 00:00 起 hourCount 个小时的订单行（含当前小时）。
 * hourlyCounts 缺失的小时按 0 计（后端不下发无数据小时 ≠ 数据缺失）；
 * 昨日基线传与今日相同的小时数，保证同时刻对齐。
 */
function summarizeDay(
  hourlyIndex: Map<string, HourlyCountDto>,
  dayStart: dayjs.Dayjs,
  hourCount: number,
): DayHourlySummary {
  const summary: DayHourlySummary = {
    createdTotal: 0,
    createdSucceededCount: 0,
    createdSucceededDurationSeconds: 0,
    succeededTotal: 0,
  }
  for (let hour = 0; hour < hourCount && hour < 24; hour += 1) {
    const item = hourlyIndex.get(dayStart.add(hour, 'hour').format('YYYY-MM-DD HH'))
    if (!item) continue
    summary.createdTotal += item.created ?? 0
    summary.createdSucceededCount += item.createdSucceededCount ?? 0
    summary.createdSucceededDurationSeconds += item.createdSucceededDurationSeconds ?? 0
    summary.succeededTotal += item.succeeded ?? 0
  }
  return summary
}

/** 创建口径完成率：创建总数为 0 时不可计算（null，UI 展示「--」，不补 0） */
function completionRateOf(summary: DayHourlySummary): number | null {
  return summary.createdTotal > 0 ? summary.createdSucceededCount / summary.createdTotal : null
}

/** 创建口径平均完成耗时（秒 → 毫秒）：已完成数为 0 时不可计算 */
function avgCompletedDurationMsOf(summary: DayHourlySummary): number | null {
  return summary.createdSucceededCount > 0
    ? (summary.createdSucceededDurationSeconds / summary.createdSucceededCount) * 1000
    : null
}

/**
 * 平均每小时完成任务数 = Σsucceeded ÷ 已过小时数（00:00 至当前整点，含当前小时）。
 * 分母与今日/昨日趋势桶数一致，保证环比是同时刻的公平对比；小时数为 0 时不可计算。
 */
function avgHourlyCompletedCountOf(summary: DayHourlySummary, hourCount: number): number | null {
  return hourCount > 0 ? summary.succeededTotal / hourCount : null
}

/**
 * 把看板聚合 VO 映射为实时看板快照。
 * now 为调用方当前毫秒时间戳（部署时区只用于墙钟切桶，不影响业务值）。
 */
export function buildRealtimeSnapshot(board: DashboardBoardDto, now: number): RealtimeSnapshot {
  const order = board.order
  const vehicle = board.vehicle

  // 小时统计索引：key 为部署时区墙钟 `yyyy-MM-dd HH`
  const hourlyIndex = new Map<string, HourlyCountDto>()
  for (const item of order?.hourlyCounts ?? []) {
    const key = hourKeyOf(item?.hourTime)
    if (key) hourlyIndex.set(key, item)
  }

  // 今日 00:00 至当前小时的整点桶（含当前小时）；昨日基线用相同小时数对齐
  const todayStart = dayjs(now).tz(DEPLOY_TIMEZONE).startOf('day')
  const elapsedHours = dayjs(now).tz(DEPLOY_TIMEZONE).diff(todayStart, 'hour') + 1
  const yesterdayStart = todayStart.subtract(1, 'day')

  const todaySummary = summarizeDay(hourlyIndex, todayStart, elapsedHours)
  const yesterdaySummary = summarizeDay(hourlyIndex, yesterdayStart, elapsedHours)

  const totalVehicleCount = vehicle?.totalVehicleCount ?? 0
  const onlineVehicleCount = vehicle?.onlineVehicleCount ?? 0

  // 趋势：每个已过整点桶取「该小时完成的订单数」（succeeded），今昨按墙钟键对齐
  const todayTaskTrend = Array.from({ length: Math.max(0, Math.min(elapsedHours, 24)) }, (_, hour) => ({
    label: todayStart.add(hour, 'hour').format('MM-DD HH:00'),
    todayCompleted: hourlyIndex.get(todayStart.add(hour, 'hour').format('YYYY-MM-DD HH'))?.succeeded ?? 0,
    yesterdayCompleted:
      hourlyIndex.get(yesterdayStart.add(hour, 'hour').format('YYYY-MM-DD HH'))?.succeeded ?? 0,
  }))

  return {
    snapshotAt: now,
    kpis: {
      todayTaskTotal: {
        current: todaySummary.createdTotal,
        baseline: yesterdaySummary.createdTotal,
      },
      todayCompletionRate: {
        current: completionRateOf(todaySummary),
        baseline: completionRateOf(yesterdaySummary),
      },
      onlineVehicleCount,
      totalVehicleCount,
      // 快照类指标无昨日同时刻数据：baseline 恒 null（不展示环比，不伪造对比）
      faultVehicleCount: vehicle?.faultCount ?? 0,
      averageCompletedDurationMs: {
        current: avgCompletedDurationMsOf(todaySummary),
        baseline: avgCompletedDurationMsOf(yesterdaySummary),
      },
      averageHourlyCompletedCount: {
        current: avgHourlyCompletedCountOf(todaySummary, elapsedHours),
        baseline: avgHourlyCompletedCountOf(yesterdaySummary, elapsedHours),
      },
      // 利用率取瞬时近似：在线车辆中运行中占比；在线为 0 时不可计算（除零纪律）
      fleetUtilization: {
        current: onlineVehicleCount > 0 ? (vehicle?.runningCount ?? 0) / onlineVehicleCount : null,
        baseline: null,
      },
      backlogCount: order?.queueOrderCount ?? 0,
    },
    // 五类状态快照直读，固定顺序输出（0 值保留，图例展示完整状态口径）
    vehicleStatus: [
      { status: 'running', count: vehicle?.runningCount ?? 0 },
      { status: 'idle', count: vehicle?.idleCount ?? 0 },
      { status: 'charging', count: vehicle?.chargingCount ?? 0 },
      { status: 'fault', count: vehicle?.faultCount ?? 0 },
      { status: 'offline', count: vehicle?.offlineCount ?? 0 },
    ],
    todayTaskTrend,
  }
}

/**
 * 把未关闭告警记录映射为实时告警列表项。
 * 逐字段防御性取值（后端漏字段退化为空串/null，不让单行异常击垮整页）；
 * 持续时长接口不下发，按 当前时刻 − startTime 现算，缺失/不可解析为 null（展示留白）。
 */
export function mapOpenAlertItem(record: SystemAlarmRecordDto, now: number): OpenAlertItem {
  const errorModel = record?.errorModel
  const occurredAt = typeof record?.startTime === 'string' ? record.startTime : ''
  // 解析统一走 datetimeDisplay（T00.7 部署时区单点：墙钟/带偏移/不可识别分类处理）；
  // 不可解析 → null，展示留白，不猜格式
  const startMs = parseBackendDateTime(occurredAt)?.valueOf() ?? null
  return {
    id: record?.id === null || record?.id === undefined ? '' : String(record.id),
    level: typeof record?.alarmLevel === 'string' ? record.alarmLevel : '',
    sourceType: typeof record?.sourceType === 'string' ? record.sourceType : '',
    sourceName: record?.sourceName || record?.sourceKey || '',
    sourceKey: typeof record?.sourceKey === 'string' ? record.sourceKey : '',
    orderKey: typeof record?.orderKey === 'string' ? record.orderKey : '',
    orderName: typeof record?.orderName === 'string' ? record.orderName : '',
    descriptionText: errorModel?.errorDescription ?? '',
    descriptionTranslations: Array.isArray(errorModel?.errorDescriptionTranslations)
      ? errorModel.errorDescriptionTranslations
      : [],
    occurredAt,
    durationMs: startMs === null ? null : Math.max(0, now - startMs),
  }
}

/**
 * 格式化持续时长（毫秒 → 跨语言可读的 h/m/s 组合，旧 formatDuration 等价）：
 * <1 分钟只显示秒；<1 小时显示分秒；其余显示小时分钟。null/负值由调用方留白。
 */
export function formatDurationMs(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  return `${seconds}s`
}
