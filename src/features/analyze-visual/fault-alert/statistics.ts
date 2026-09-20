/**
 * 故障告警聚合统计纯计算模块（P36；旧 HttpDashboardRepository
 * mapAlarmStatisticsToDomain 口径等价迁移，图表 / KPI 卡共用同一份结果）。
 *
 * 计算口径（旧实现文件头注释逐条核对，G15 边界随附登记）：
 * - 每日行按 startTime 所在自然日归天；接口不保证下发窗口内每一天
 *   （实测仅返回有数据的天），缺失天按 0 补齐保证趋势 X 轴连续；
 *   窗口外的异常下发天直接忽略（不猜测语义）。
 * - 故障次数 = 窗口内各天 (closedCount + unclosedCount) 之和；
 *   未关闭告警数 = 各天 unclosedCount 之和
 *   （窗口前发生且仍未关闭的告警接口无归天数据，不计入——口径提示中说明）。
 * - 告警关闭率 = ΣclosedCount / Σ(closedCount + unclosedCount)（窗口级，0–1）；
 *   平均告警时长(ms) = ΣtotalDurationSeconds / Σ(closed + unclosed) × 1000
 *   （未关闭告警时长按接口累计口径计入，故为「平均告警时长」而非严格 MTTR）；
 *   窗口内无告警时分母为 0 → 两者均 null（不可计算展示 "--"，绝不补 0，规格 11.2）。
 * - 单机故障排行：接口已按 topAgvDate（窗口最后一天）下发 Top10；
 *   此处再做一次稳定排序（次数降序、次数相同按展示名升序）兼容后端顺序变化。
 */

import type { Dayjs } from 'dayjs'
import type {
  AlarmStatisticsVo,
  DailyAlarmCountDto,
} from '@/services/report-fault/report-fault.service.types'

/** 单日趋势点（业务时区自然日桶，日桶覆盖 1 天：频率（次/天）= 当天次数） */
export interface FaultTrendPoint {
  /** 桶起始日（yyyy-MM-dd，展示层按需翻译/格式化） */
  date: string
  /** 当天故障次数 = closedCount + unclosedCount */
  faultCount: number
}

/** 单机故障排行行（展示名优先 vehicleName，空时回退 vehicleKey） */
export interface VehicleFaultRankItem {
  /** 展示名（已做回退；可能为空串，展示层再兜底） */
  displayName: string
  /** 告警次数 */
  faultCount: number
}

/** 聚合统计结果（一次 alarmStatistics 请求的领域视图；KPI 与图表共用） */
export interface FaultAlertStatistics {
  /** 窗口内故障次数（关闭 + 未关闭） */
  faultCount: number
  /** 窗口内未关闭告警数 */
  openAlertCount: number
  /** 窗口内告警关闭率（0–1）；窗口内无告警（分母 0）时 null = 不可计算 */
  closedRate: number | null
  /** 窗口内平均单次告警时长（毫秒）；无告警时 null = 不可计算 */
  averageDurationMs: number | null
  /** 故障趋势（窗口覆盖的每个自然日按天升序，缺失天补 0） */
  trend: FaultTrendPoint[]
  /** 单机故障排行（接口 Top10 直读 + 稳定排序） */
  vehicleRanking: VehicleFaultRankItem[]
}

/** 业务日期串（yyyy-MM-dd）校验：date 字段归一化后必须命中，非法天防御性跳过 */
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** 每日行索引：date 归一化为 yyyy-MM-dd（兼容空格 / T 两种分隔）；非法日期跳过 */
function indexDailyCounts(dailyAlarmCounts: DailyAlarmCountDto[] | undefined) {
  const index = new Map<string, DailyAlarmCountDto>()
  for (const day of Array.isArray(dailyAlarmCounts) ? dailyAlarmCounts : []) {
    const dateStr = typeof day?.date === 'string' ? day.date.slice(0, 10) : ''
    if (BUSINESS_DATE_PATTERN.test(dateStr)) {
      index.set(dateStr, day)
    }
  }
  return index
}

/**
 * 把告警统计聚合 VO 映射为页面领域视图。
 * start/end 为页面生效统计窗口（部署时区墙钟 Dayjs），与请求参数同源——
 * KPI 汇总与趋势补 0 用同一窗口循环，保证两者口径严格一致；
 * 区间逆序（start 晚于 end）时窗口天数 ≤ 0，循环不执行，退化为空趋势 + 零值 KPI。
 */
export function buildFaultAlertStatistics(
  vo: AlarmStatisticsVo,
  start: Dayjs,
  end: Dayjs,
): FaultAlertStatistics {
  const dailyIndex = indexDailyCounts(vo?.dailyAlarmCounts)

  const startDay = start.startOf('day')
  const totalDays = end.startOf('day').diff(startDay, 'day') + 1

  let faultCount = 0
  let openAlertCount = 0
  // 关闭数与告警总时长单独累计：窗口级关闭率 / 平均告警时长的分子分母
  let closedTotal = 0
  let totalDurationSeconds = 0

  const trend: FaultTrendPoint[] = []
  for (let i = 0; i < totalDays; i += 1) {
    const dayStart = startDay.add(i, 'day')
    const day = dailyIndex.get(dayStart.format('YYYY-MM-DD'))
    const closed = day?.closedCount ?? 0
    const unclosed = day?.unclosedCount ?? 0
    const count = closed + unclosed
    faultCount += count
    openAlertCount += unclosed
    closedTotal += closed
    totalDurationSeconds += day?.totalDurationSeconds ?? 0
    trend.push({ date: dayStart.format('YYYY-MM-DD'), faultCount: count })
  }

  // 窗口级派生 KPI：分母与故障次数同口径；无告警时 null（不可计算，不补 0）
  const closedRate = faultCount > 0 ? closedTotal / faultCount : null
  const averageDurationMs =
    faultCount > 0 ? (totalDurationSeconds / faultCount) * 1000 : null

  // 排行：接口 Top10 直读，展示名优先 vehicleName 回退 vehicleKey；再做稳定排序
  const vehicleRanking: VehicleFaultRankItem[] = (Array.isArray(vo?.topAgvAlarms)
    ? vo.topAgvAlarms
    : []
  ).map((item) => ({
    displayName: item?.vehicleName || item?.vehicleKey || '',
    faultCount: item?.alarmCount ?? 0,
  }))
  vehicleRanking.sort(
    (a, b) => b.faultCount - a.faultCount || a.displayName.localeCompare(b.displayName),
  )

  return { faultCount, openAlertCount, closedRate, averageDurationMs, trend, vehicleRanking }
}
