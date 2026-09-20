/**
 * 车辆状态统计：KPI 派生口径（owner=P37；旧 VehicleStatus.tsx 组件内 KPI
 * 计算的纯函数化，口径逐项等价保留，供页面与验收脚本共用）。
 *
 * 口径纪律（旧实现注释同口径，G15 页面侧落实）：
 * - 利用率分母 = 已应用查询区间的秒数（仅时间段，不乘车辆数）——多车同时
 *   作业时结果可超过 100%（语义为「平均同时执行任务的车辆数」近似）；
 *   区间终点超过当前时刻时截断到当前时刻（接口不含未来数据，不计入未来时间），
 *   与任务统计报表（P35）利用率的「有效区间」口径一致；
 * - 平均口径 = 该状态总时长 ÷ 全部车辆数（未出现该状态的车按 0 参与平均）；
 *   无车辆（分母 0）时不可计算 → null，KPI 展示 "--"，绝不补 0（规格 11.2）；
 * - 任务执行利用率分母为 0（窗口为空）同样不可计算 → null。
 *
 * 时间口径（规格 11.3 部署时区）：start/end 为页面层按部署时区构造的 Dayjs，
 * now 为当前时刻；diff 计算的是绝对毫秒差，与浏览器时区无关。
 */

import type { Dayjs } from 'dayjs'
import type { VehicleExecutingDurationDto, VehicleStatisticState } from '@/services/report-vehicle-state/report-vehicle-state.service.types'
import { groupByVehicle, secondsOfStates } from '@/features/analyze-visual/vehicle-status/selectors'

/**
 * 任务统计报表（P35）利用率口径的「有效状态」集合：
 * 执行作业 + 执行充电 + 执行停靠。P37 页面利用率只用 EXECUTING_WORK（分母
 * 不乘车辆数），与 P35 口径不同——两套口径在此并列声明防止混用，
 * P35 接入时消费本常量（不得另写第二份定义）。
 */
export const EFFECTIVE_WORK_STATES: VehicleStatisticState[] = [
  'EXECUTING_WORK',
  'EXECUTING_CHARGE',
  'EXECUTING_PARK',
]

/** 本页 KPI 消费的状态集合（旧实现常量等价保留） */
const WORK_STATES: VehicleStatisticState[] = ['EXECUTING_WORK']
const TRAFFIC_STATES: VehicleStatisticState[] = ['TRAFFIC']
const ERROR_STATES: VehicleStatisticState[] = ['ERROR']

/**
 * 统计窗口有效秒数：区间终点超过当前时刻时截断到当前时刻（不计入未来时间），
 * 无效区间或负跨度返回 0（调用方以 0 判定「不可计算」）。
 */
export function computeWindowSeconds(start: Dayjs, end: Dayjs, now: Dayjs): number {
  if (!start.isValid() || !end.isValid()) return 0
  const effectiveEnd = end.isBefore(now) ? end : now
  return Math.max(0, effectiveEnd.diff(start, 'second'))
}

/** KPI 派生结果（null = 不可计算，展示 "--"；0 是有效值正常展示） */
export interface VehicleStatusKpis {
  /** 任务执行利用率（0–1 小数；窗口秒数为 0 时 null） */
  utilization: number | null
  /** 平均交管时长（毫秒；无车辆时 null） */
  avgTrafficMs: number | null
  /** 平均执行时长（毫秒；无车辆时 null） */
  avgWorkMs: number | null
  /** 平均故障时长（毫秒；无车辆时 null） */
  avgErrorMs: number | null
  /** 覆盖车辆数（KPI 副文案） */
  vehicleCount: number
  /** 执行作业总时长（秒，KPI 副文案） */
  workSeconds: number
}

/** 从原始记录 + 窗口秒数计算全部 KPI 派生值（与图表/明细共用同一份原始记录） */
export function buildVehicleStatusKpis(
  rows: VehicleExecutingDurationDto[],
  windowSeconds: number,
): VehicleStatusKpis {
  const workSeconds = secondsOfStates(rows, WORK_STATES)
  const trafficSeconds = secondsOfStates(rows, TRAFFIC_STATES)
  const errorSeconds = secondsOfStates(rows, ERROR_STATES)
  const vehicleCount = groupByVehicle(rows).length

  return {
    utilization: windowSeconds > 0 ? workSeconds / windowSeconds : null,
    avgTrafficMs: vehicleCount > 0 ? (trafficSeconds / vehicleCount) * 1000 : null,
    avgWorkMs: vehicleCount > 0 ? (workSeconds / vehicleCount) * 1000 : null,
    avgErrorMs: vehicleCount > 0 ? (errorSeconds / vehicleCount) * 1000 : null,
    vehicleCount,
    workSeconds,
  }
}
