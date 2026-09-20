/**
 * KPI 展示模型纯函数（P34 私有；旧 DashboardShared/model/kpiViewModel.ts 等价迁移）。
 *
 * 职责边界：领域数据（realtime.ts 的 ComparableMetric）只提供数值；
 * 本模块决定格式化与环比语义，KPI 卡组件不计算公式、不访问服务层。
 *
 * 口径纪律：
 * - null = 不可计算（分母为 0 / 缺失），展示「--」，绝不补 0（规格 11.2）；
 * - 0 是有效值，正常展示；
 * - 环比颜色统一按涨跌方向：上升红、下降绿、持平中性（旧实现统一口径，
 *   不按指标业务好坏反转颜色——避免「故障数上升」显示绿色的误导）；
 * - baseline 缺失（null）不显示环比文案。
 */

import type { ComparableMetric } from '@/features/dashboard/realtime'
import { formatDurationMs } from '@/features/dashboard/realtime'

/** KPI 数值格式：整数（千分位）/ 百分比（0–1 小数输入）/ 时长（毫秒输入）/ 一位小数 */
export type KpiFormat = 'integer' | 'percentage' | 'duration' | 'decimal'

/** 环比色调：good 绿 / bad 红 / neutral 中性 */
export type KpiTone = 'good' | 'bad' | 'neutral'

/** KPI 卡渲染所需的展示模型（不含业务数值，组件无公式） */
export interface KpiViewModel {
  /** 主值展示文本（已本地化格式化；不可计算为「--」） */
  display: string
  /** 环比文案（如「↑ 12.5%」）；无基线时缺省不渲染 */
  changeText?: string
  /** 环比颜色语义（涨=bad 红 / 跌=good 绿 / 平=neutral） */
  changeTone: KpiTone
  /** 强调边框：danger 故障告急 / warn 积压偏高 */
  accent?: 'danger' | 'warn'
}

/** 五语言 locale 归一化（Intl 用；未识别回退 zh-CN，与旧 normalizeLocale 同口径） */
function normalizeLocale(locale: string): string {
  return ['zh-CN', 'en-US', 'zh-TW', 'ja-JP', 'ko-KR'].includes(locale) ? locale : 'zh-CN'
}

/** 整数千分位（Intl，不手拼字符串——规格 18.4 数值纪律） */
export function formatInteger(value: number, locale: string): string {
  return new Intl.NumberFormat(normalizeLocale(locale), { maximumFractionDigits: 0 }).format(value)
}

/** 百分比：0–1 小数输入 → 百分比文本（1 位小数）；null 不可计算 */
export function formatRatio(ratio: number | null, locale: string): string {
  if (ratio === null || Number.isNaN(ratio)) return '--'
  return new Intl.NumberFormat(normalizeLocale(locale), {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratio)
}

/** 一位小数数值（平均每小时完成任务数等无单位派生值） */
function formatDecimal1(value: number, locale: string): string {
  return new Intl.NumberFormat(normalizeLocale(locale), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

/** 按格式把单个数值转为展示文本；null/NaN 一律「--」 */
function formatValue(value: number | null, format: KpiFormat, locale: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  switch (format) {
    case 'integer':
      return formatInteger(value, locale)
    case 'percentage':
      return formatRatio(value, locale)
    case 'duration':
      return formatDurationMs(value)
    case 'decimal':
      return formatDecimal1(value, locale)
  }
}

/**
 * 计算环比：current 相对 baseline 的变化比例与方向语义。
 * baseline 为 null 不显示；两者皆 0 显示「→ 0%」；baseline 0 而 current 非零
 * 用绝对方向（±100%）代替除零比例（旧实现同口径，不产生 Infinity）。
 */
function computeChange(
  current: number | null,
  baseline: number | null,
  locale: string,
): { text?: string; tone: KpiTone } {
  if (baseline === null || current === null) return { tone: 'neutral' }
  if (baseline === 0 && current === 0) return { text: `→ ${formatRatio(0, locale)}`, tone: 'neutral' }
  const ratio =
    baseline === 0 ? (current > 0 ? 1 : -1) : (current - baseline) / Math.abs(baseline)
  const up = current > baseline
  const down = current < baseline
  const arrow = up ? '↑' : down ? '↓' : '→'
  // 涨跌颜色与方向绑定：上升红（bad）、下降绿（good）、持平中性
  const tone: KpiTone = up ? 'bad' : down ? 'good' : 'neutral'
  return { text: `${arrow} ${formatRatio(ratio, locale)}`, tone }
}

/** 可环比 KPI → 展示模型（不含 accent；强调边框由调用方按业务阈值补充） */
export function buildKpiViewModel(
  metric: ComparableMetric,
  format: KpiFormat,
  locale: string,
): KpiViewModel {
  const change = computeChange(metric.current, metric.baseline, locale)
  return {
    display: formatValue(metric.current, format, locale),
    changeText: change.text,
    changeTone: change.tone,
  }
}

/** 纯数值（无环比）KPI → 展示模型（在线/总数、积压等快照指标） */
export function buildScalarKpiViewModel(
  value: number,
  format: KpiFormat,
  locale: string,
): KpiViewModel {
  return { display: formatValue(value, format, locale), changeTone: 'neutral' }
}
