/**
 * 车辆状态统计：展示格式化（owner=P37；旧 DashboardShared formatters 中
 * 本页消费的 formatDecimalHours 等价迁移，入参改用协议单位「秒」）。
 *
 * 时长的人性化组合（Xh Ym / Xm Ys）复用 dashboard/formatDurationMs（P34/P36
 * 已交付）；百分比复用 kpiViewModel/formatRatio（Intl percent，1 位小数）——
 * 两者为只读复用，本模块不重复实现同义格式化。
 */

/** 十进制小时数（Intl 2 位小数；秒 → 小时）。明细「时长（小时）」列与排行标签共用 */
export function formatDecimalHours(seconds: number, locale: string, fractionDigits = 2): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(seconds / 3600)
}
