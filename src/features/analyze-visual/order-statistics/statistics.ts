/**
 * 任务统计纯计算模块（P33 私有；TASKS P33「经文档核对的公式归入专属纯计算模块」）。
 *
 * 口径来源（经 OpenAPI 与旧实现逐项核对，交接记录登记）：
 * - 数量统计：接口按「任务类型 × 任务状态」返回数量行；图表按状态维度分组求和
 *   （旧实现 QuantityBar 的 stateSumMap 同语义），未知状态保留协议原值参与分组；
 * - 效率统计：接口按任务类型返回三个平均值行（orderAverage*，单位秒）；图表展示
 *   各类型对应平均值之和（旧实现 totalTime/execTime/waitTime 求和同语义）。
 *   注意该口径是「各类型平均值的合计」，不等于全部订单的整体平均——口径说明
 *   随图表标题旁提示展示（MetricHint），P35 复用统计口径时以本文件为唯一计算源。
 *
 * 函数全部为纯函数：不做翻译（文案由组件层动态传入）、不做请求、不持有状态。
 */

import type { OrderEfficiencyDto, OrderQuantityDto } from '@/services/report-order/report-order.service.types'

/** 数量统计的按状态聚合行：state 为协议原值（未知状态原样保留，不映射） */
export interface QuantityByState {
  orderState: string
  total: number
}

/**
 * 数量统计按状态分组求和。
 * - number 缺失/null 按 0 计入求和（旧实现 `d.number || 0` 同语义：缺失行不贡献数量，
 *   与「统计条缺失显示 —」不同，这里是图表聚合的数值输入，无法区分缺失与 0 时按旧口径处理）；
 * - 类目顺序为接口返回的首次出现顺序（旧实现 Map 迭代序同语义）；
 * - 空数组返回空数组（真实空结果，与查询失败由页面状态区分）。
 */
export function sumQuantityByState(rows: OrderQuantityDto[]): QuantityByState[] {
  const sumMap = new Map<string, number>()
  for (const row of rows) {
    const state = row.orderState ?? ''
    sumMap.set(state, (sumMap.get(state) ?? 0) + (row.number ?? 0))
  }
  return [...sumMap.entries()].map(([orderState, total]) => ({ orderState, total }))
}

/** 效率统计的汇总值（秒；保留两位小数与旧实现 toFixed(2) 同语义） */
export interface EfficiencySummary {
  /** Σ各类型平均总时间 */
  averageTime: number
  /** Σ各类型平均执行时间 */
  averageExecutionTime: number
  /** Σ各类型平均等待时间 */
  averageWaitTime: number
}

/**
 * 效率统计三值求和：把各任务类型的平均值相加（旧实现同口径，非整体平均——
 * 口径说明见文件头与图表提示）。缺失/null 字段按 0 计入（旧实现 `|| 0` 同语义）。
 */
export function sumEfficiencyAverages(rows: OrderEfficiencyDto[]): EfficiencySummary {
  let averageTime = 0
  let averageExecutionTime = 0
  let averageWaitTime = 0
  for (const row of rows) {
    averageTime += row.orderAverageTime ?? 0
    averageExecutionTime += row.orderAverageExecutionTime ?? 0
    averageWaitTime += row.orderAverageWaitTime ?? 0
  }
  return {
    averageTime: Number(averageTime.toFixed(2)),
    averageExecutionTime: Number(averageExecutionTime.toFixed(2)),
    averageWaitTime: Number(averageWaitTime.toFixed(2)),
  }
}

/**
 * 秒转「X时X分X秒」展示文本（旧实现 formatSecondsToTime 同语义迁移）。
 * - 非正数显示「0秒」文案（由 translate 提供，避免纯函数依赖 i18n）；
 * - 时/分/秒 单元词由组件层传入当前语言译文；拼接顺序固定 时→分→秒（旧实现同序，
 *   英文单元词拼接效果沿用旧系统真译，如 "1Hour2minute"，不擅自改动旧文案行为）；
 * - translate 的签名刻意收窄为单词翻译，方便测试与复用。
 */
export function formatDuration(
  seconds: number,
  translate: (text: string) => string,
): string {
  if (seconds <= 0) return translate('0秒')
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.round(seconds % 60)
  let result = ''
  if (hours > 0) result += `${hours}${translate('时')}`
  if (minutes > 0) result += `${minutes}${translate('分')}`
  if (secs > 0 || result === '') result += `${secs}${translate('秒')}`
  return result
}
