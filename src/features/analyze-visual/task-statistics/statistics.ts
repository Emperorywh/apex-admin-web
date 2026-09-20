/**
 * 任务统计报表：KPI/趋势/分布/明细派生口径（owner=P35；旧
 * DashboardShared/HttpDashboardRepository.mapTaskStatisticsToDomain 与
 * TaskStatistics.tsx 利用率映射的纯函数化，口径逐项等价保留，
 * 供页面 KPI、图表与明细表共用——同源一次派生，保证图表与明细一致）。
 *
 * 口径纪律（旧实现注释同口径，G15 页面侧落实）：
 * - dailyCounts 只含「有数据的自然日」（实测不下发空 day），date 实测下发
 *   "yyyy-MM-ddT00:00:00"——归一化截取前 10 位，非法日期防御性跳过；
 *   窗口外的异常下发天被忽略（不进入 KPI 与趋势）；
 * - 总任务数 = 完成 + 失败 + 取消（终态口径，各天之和）；
 *   完成率 = 完成 ÷ 总数，总数为 0 时不可计算 → null（展示 "--"，绝不补 0）；
 * - 平均执行时长 = 创建且已完成订单总耗时（秒）÷ 同口径订单数 × 1000 → 毫秒，
 *   分母为 0 时不可计算 → null（0 是有效值，正常展示）；
 * - 趋势按所选区间覆盖的自然日逐天升序，缺失天按 0 补齐（计数聚合「无记录
 *   = 0 个订单」，与旧实现/故障趋势口径一致）；区间逆序退化为空趋势 + 零值；
 * - 时长分布：后端 label 归一化（去空白 + 小写）后映射固定桶序，未知桶丢弃，
 *   缺失桶由图表按 0 兜底；接口无原始耗时样本，P50/P90 不可计算（不展示标线）；
 * - 利用率排行（每车）：有效状态时长之和 ÷ 有效窗口秒数（终点截断当前时刻，
 *   P37 computeWindowSeconds 同口径）；窗口为 0 时不可计算 → null；
 * - 利用率趋势（按天）：当天有效状态总时长 ÷（当天与有效窗口交集秒数 ×
 *   当天车辆数）；整天在窗口外 → null（断线）；缺失记录按 0；
 *   车辆数缺失/为 0/非法 → null（不可计算，不用单车近似）。
 *
 * 时间口径（规格 11.3 部署时区）：start/end 为页面层按部署时区构造的 Dayjs，
 * now 为当前时刻；diff 计算的是绝对毫秒差，与浏览器时区无关。
 *
 * 域边界：本模块只依赖 services 层 DTO 类型；车辆聚合视角（groupByVehicle/
 * secondsOfStatesInGroup）与「有效状态」常量（EFFECTIVE_WORK_STATES）归
 * P37 owner（features/analyze-visual/vehicle-status），features 业务域之间
 * 不得互相导入（结构检查规则 3）——由页面层组合后把「每车有效状态时长」
 * 传入 buildVehicleUtilizationRanking，本模块不重复实现聚合。
 */

import type { Dayjs } from 'dayjs'
import type {
  DailyCountDto,
  TaskStatisticsVo,
} from '@/services/report-task/report-task.service.types'
import type { DailyStateDurationDto } from '@/services/report-vehicle-state/report-vehicle-state.service.types'

/** 业务时区自然日（yyyy-MM-dd）格式校验：非法日期防御性跳过，避免产生 Invalid 桶边界 */
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/* ------------------------------ 时长分布固定桶 ------------------------------ */

/** 时长分布桶 key（固定 6 桶；与后端下发 label 的映射见 DURATION_LABEL_TO_BUCKET） */
export type DurationBucketKey = 'lt1m' | 'm1To2' | 'm2To3' | 'm3To5' | 'm5To10' | 'gte10m'

/** 桶展示顺序（图表 x 轴与明细共用） */
export const DURATION_BUCKET_ORDER: DurationBucketKey[] = [
  'lt1m',
  'm1To2',
  'm2To3',
  'm3To5',
  'm5To10',
  'gte10m',
]

/** 后端下发 label（去空白 + 小写后）→ 桶 key；匹配不到即未知桶（防御性丢弃） */
const DURATION_LABEL_TO_BUCKET: Record<string, DurationBucketKey> = {
  '<1min': 'lt1m',
  '1-2min': 'm1To2',
  '2-3min': 'm2To3',
  '3-5min': 'm3To5',
  '5-10min': 'm5To10',
  '>10min': 'gte10m',
}

/** 归一化接口分桶 label：去除全部空白字符并转小写；非字符串一律归一化为空串 */
function normalizeDurationLabel(label: unknown): string {
  return typeof label === 'string' ? label.replace(/\s+/g, '').toLowerCase() : ''
}

/* ------------------------------ 任务统计视图 ------------------------------ */

/** 窗口级 KPI（null = 不可计算，展示 "--"；0 是有效值正常展示） */
export interface TaskStatisticsKpis {
  /** 总任务数（终态口径：完成 + 失败 + 取消） */
  totalCount: number
  completedCount: number
  failedCount: number
  canceledCount: number
  /** 完成率（0–1 小数；总数为 0 时 null） */
  completionRate: number | null
  /** 平均执行时长（毫秒；创建且已完成订单数分母为 0 时 null） */
  averageCompletedDurationMs: number | null
}

/** 任务量趋势单点（每天一桶；缺失天已按 0 补齐） */
export interface DailyVolumePoint {
  /** 自然日（yyyy-MM-dd，与语言无关，日期值不翻译） */
  date: string
  completedCount: number
  failedCount: number
  canceledCount: number
}

/** 时长分布桶（已按固定桶序对齐，count 可为 0） */
export interface DurationBucketView {
  bucket: DurationBucketKey
  count: number
}

/** buildTaskStatistics 的完整派生视图（KPI/趋势/分布/明细共用同一份产物） */
export interface TaskStatisticsView {
  kpis: TaskStatisticsKpis
  /** 任务量趋势（窗口覆盖的每个自然日按天升序，缺失天补 0） */
  volumeTrend: DailyVolumePoint[]
  /** 时长分布（固定 6 桶升序，接口未下发的桶为 0） */
  durationDistribution: DurationBucketView[]
  /** 每日明细行（与 volumeTrend 同源同序——图表与 Apex 明细一致，A19） */
  dailyRows: DailyDetailRow[]
}

/** 每日明细行（Apex 明细表数据源；平均耗时不可计算为 null，单元格留白） */
export interface DailyDetailRow {
  /** 稳定行 ID = 自然日 */
  date: string
  created: number
  completed: number
  failed: number
  canceled: number
  /** 当天创建且已完成订单的平均执行耗时（毫秒；分母 0 → null 留白） */
  averageDurationMs: number | null
}

/** 计数字段防御读取：缺失/null 按 0 参与计数聚合（协议不区分「无记录」与 0） */
function countOf(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * 把任务统计聚合 VO 映射为页面领域视图。
 * start/end 为页面所选统计窗口（部署时区墙钟，与请求参数一致）。
 */
export function buildTaskStatistics(
  vo: TaskStatisticsVo,
  start: Dayjs,
  end: Dayjs,
): TaskStatisticsView {
  // 按 date 建索引：归一化为 yyyy-MM-dd，非法日期跳过；窗口外的天被忽略
  const dailyIndex = new Map<string, DailyCountDto>()
  for (const day of Array.isArray(vo?.dailyCounts) ? vo.dailyCounts : []) {
    const dateStr = typeof day?.date === 'string' ? day.date.slice(0, 10) : ''
    if (BUSINESS_DATE_PATTERN.test(dateStr)) {
      dailyIndex.set(dateStr, day)
    }
  }

  // 终态口径汇总：完成/失败/取消按天直读累加，总数为三者之和；
  // 平均耗时使用创建口径（创建且已完成）的分子分母单独累加
  let completedCount = 0
  let failedCount = 0
  let canceledCount = 0
  let succeededCount = 0
  let succeededDurationSeconds = 0

  // 趋势窗口为所选区间覆盖的自然日（start 所在日至 end 所在日），按天升序，
  // 缺失天按 0 补齐；KPI 在同一循环内按窗口汇总，保证 KPI 与趋势口径严格一致；
  // 区间逆序（start 晚于 end）时窗口天数 ≤ 0，循环不执行，退化为空趋势 + 零值 KPI
  const startDay = start.startOf('day')
  const totalDays = end.startOf('day').diff(startDay, 'day') + 1
  const volumeTrend: DailyVolumePoint[] = []
  const dailyRows: DailyDetailRow[] = []
  for (let i = 0; i < totalDays; i++) {
    const dayStart = startDay.add(i, 'day')
    const dateLabel = dayStart.format('YYYY-MM-DD')
    const day = dailyIndex.get(dateLabel)
    const completed = countOf(day?.completed)
    const failed = countOf(day?.failed)
    const canceled = countOf(day?.cancelled)
    const daySucceeded = countOf(day?.createdSucceededCount)
    const daySucceededSeconds = countOf(day?.createdSucceededDurationSeconds)

    completedCount += completed
    failedCount += failed
    canceledCount += canceled
    succeededCount += daySucceeded
    succeededDurationSeconds += daySucceededSeconds

    volumeTrend.push({ date: dateLabel, completedCount: completed, failedCount: failed, canceledCount: canceled })
    dailyRows.push({
      date: dateLabel,
      created: countOf(day?.created),
      completed,
      failed,
      canceled,
      // 每日平均耗时：分母为 0 不可计算 → null（单元格留白，绝不补 0）
      averageDurationMs:
        daySucceeded > 0 ? Math.round((daySucceededSeconds / daySucceeded) * 1000) : null,
    })
  }

  const totalCount = completedCount + failedCount + canceledCount
  const kpis: TaskStatisticsKpis = {
    totalCount,
    completedCount,
    failedCount,
    canceledCount,
    // 完成率：终态口径；总数为 0 时不可计算（§6.1 空值规则）
    completionRate: totalCount > 0 ? completedCount / totalCount : null,
    // 平均执行时长：创建且已完成口径（分母 0 → null）；秒 → 毫秒换算取整
    averageCompletedDurationMs:
      succeededCount > 0 ? Math.round((succeededDurationSeconds / succeededCount) * 1000) : null,
  }

  // 时长分布：label 归一化后映射到固定桶；未知桶防御性丢弃，缺失桶由下方对齐补 0
  const bucketCounts = new Map<DurationBucketKey, number>()
  const apiBuckets = Array.isArray(vo?.durationDistribution) ? vo.durationDistribution : []
  for (const apiBucket of apiBuckets) {
    const key = DURATION_LABEL_TO_BUCKET[normalizeDurationLabel(apiBucket?.label)]
    if (!key) continue
    bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + countOf(apiBucket?.count))
  }
  const durationDistribution: DurationBucketView[] = DURATION_BUCKET_ORDER.map((bucket) => ({
    bucket,
    count: bucketCounts.get(bucket) ?? 0,
  }))

  return { kpis, volumeTrend, durationDistribution, dailyRows }
}

/* ------------------------------ 利用率排行（每车） ------------------------------ */

/** 利用率排行单项（0–1 小数；窗口无效为 null，图表灰色呈现 + 提示不可计算） */
export interface VehicleUtilizationItem {
  vehicleKey: string
  /** 展示名（页面层经 P37 groupByVehicle 已做空值回退 vehicleKey） */
  vehicleName: string
  /** 有效状态时长之和（秒） */
  activeSeconds: number
  /** 利用率 = activeSeconds ÷ 窗口秒数；窗口为 0 时 null */
  utilization: number | null
}

/**
 * 由「每车有效状态时长」构造利用率排行数据。
 * 输入 items 由页面层组合 P37 owner 模块得到（groupByVehicle 分组 +
 * secondsOfStatesInGroup(EFFECTIVE_WORK_STATES) 求和），本函数只做
 * 利用率换算，不重复实现车辆聚合（P37 owner 契约）。
 */
export function buildVehicleUtilizationRanking(
  items: { vehicleKey: string; vehicleName: string; activeSeconds: number }[],
  windowSeconds: number,
): VehicleUtilizationItem[] {
  return items.map((item) => ({
    vehicleKey: item.vehicleKey,
    vehicleName: item.vehicleName,
    activeSeconds: item.activeSeconds,
    // 分母为 0（窗口为空/区间完全在未来）不可计算 → null；0 分子是有效值
    utilization: windowSeconds > 0 ? item.activeSeconds / windowSeconds : null,
  }))
}

/* ------------------------------ 利用率趋势（按天） ------------------------------ */

/** 利用率趋势单点（utilization null = 不可计算，折线断开；0 是有效值） */
export interface UtilizationTrendPoint {
  /** 自然日（yyyy-MM-dd） */
  date: string
  utilization: number | null
}

/**
 * 每日状态时长 → 利用率趋势（按天）。
 * 每天利用率 = 当天有效状态总时长 ÷（当天与有效窗口交集秒数 × 当天车辆数）；
 * 有效窗口终点超过当前时刻时按当前时刻截断（接口无未来数据，不计入分母）。
 * 从 start 到 end 按天升序：整天在有效窗口之外（如未来天）→ null 断线；
 * 缺失记录按 0（该日无有效状态时长）；已有记录但车辆数缺失/为 0 → null。
 */
export function buildUtilizationTrend(
  durations: DailyStateDurationDto[],
  start: Dayjs,
  end: Dayjs,
  now: Dayjs,
): UtilizationTrendPoint[] {
  // 按日期保留完整记录，确保分子与分母使用同一天的数据
  const dailyDurations = new Map<string, DailyStateDurationDto>()
  for (const item of durations) {
    const dateStr = typeof item?.date === 'string' ? item.date.slice(0, 10) : ''
    // 非法日期防御性跳过，避免产生 Invalid 桶边界
    if (!BUSINESS_DATE_PATTERN.test(dateStr)) continue
    dailyDurations.set(dateStr, item)
  }
  // 有效统计终点：接口不含未来数据，区间终点超过当前时刻时按当前时刻截断
  const effectiveEnd = end.isBefore(now) ? end : now
  // 从 start 到 end 按天升序逐天计算
  const trend: UtilizationTrendPoint[] = []
  const startDay = start.startOf('day')
  const totalDays = end.startOf('day').diff(startDay, 'day') + 1
  for (let i = 0; i < totalDays; i++) {
    const dayStart = startDay.add(i, 'day')
    const dayEnd = dayStart.add(1, 'day')
    // 当天自然日与有效窗口的交集秒数 × 当天车辆数 = 车队总可用秒数（分母）
    const overlapStart = dayStart.isAfter(start) ? dayStart : start
    const overlapEnd = dayEnd.isBefore(effectiveEnd) ? dayEnd : effectiveEnd
    const overlapSeconds = overlapEnd.diff(overlapStart, 'second')
    const dailyDuration = dailyDurations.get(dayStart.format('YYYY-MM-DD'))
    let utilization: number | null = null
    if (overlapSeconds > 0) {
      if (!dailyDuration) {
        // 缺失天按 0 补齐（与任务量趋势口径一致：无记录 = 0 时长）
        utilization = 0
      } else {
        const vehicleCount = dailyDuration.vehicleCount
        if (typeof vehicleCount === 'number' && Number.isFinite(vehicleCount) && vehicleCount > 0) {
          utilization = countOf(dailyDuration.totalDurationSeconds) / (overlapSeconds * vehicleCount)
        }
        // 车辆数缺失/为 0/非法：保持 null（不可计算，避免除零或误按单车计算）
      }
    }
    trend.push({ date: dayStart.format('YYYY-MM-DD'), utilization })
  }
  return trend
}
