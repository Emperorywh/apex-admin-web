/**
 * 统计空值与单位格式化基础纯函数（T00.7，迁移规格 11.2 指标口径 / A19）。
 *
 * 空值纪律（不得用代码"修复"业务语义）：
 * - 后端明确返回 0 → 正常显示 0（0 是真实统计值，绝不与缺失混淆）；
 * - 缺字段 / null / undefined / 未知分母 → 显示不可计算占位符，绝不填 0；
 * - 除零 → 不可计算，绝不产生 Infinity / NaN / 虚假 0%；
 * - 未知状态、异常记录的取舍归页面 owner（本模块不做状态映射、不编造公式）。
 *
 * 本模块只提供"空值安全 + 单位拼接"的基础能力；具体指标公式（利用率分母、
 * 状态集合、日边界等）必须由各报表页面的专属纯计算模块实现并登记口径。
 */

/** 统计"缺失/不可计算"的统一展示占位符（与时间工具口径一致） */
export const UNCOMPUTABLE = '—'

/** 判定一个原始数值是否可作为真实统计值参与计算（null/NaN/Infinity 一律不可） */
export function isComputableNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 数值指标格式化：缺失/不可计算 → 占位符；真实 0 → '0'。
 * thousand 分组默认关闭——统计口径核对期间不加千分位，避免与协议值比对混淆；
 * 展示层确需分组时传 true（仅影响呈现，不改业务值）。
 */
export function formatMetricValue(value: number | null | undefined, thousand = false): string {
  if (!isComputableNumber(value)) return UNCOMPUTABLE
  return thousand ? value.toLocaleString('en-US') : String(value)
}

/**
 * 安全比值：分子或分母缺失 → null（不可计算）；分母为 0 → null（除零不可计算）。
 * 返回原始浮点比值，格式化（百分比/小数位）交给 formatPercent 等展示函数；
 * 调用方拿到 null 必须呈现"不可计算"，不得转 0。
 */
export function safeRatio(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (!isComputableNumber(numerator) || !isComputableNumber(denominator)) return null
  if (denominator === 0) return null
  const ratio = numerator / denominator
  return Number.isFinite(ratio) ? ratio : null
}

/**
 * 比值 → 百分比字符串：null → 占位符；数值按 digits 位小数输出。
 * 0 → '0.0%'（真实零参与率正常显示）；负值属于后端数据异常，原样呈现不矫正。
 */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined) return UNCOMPUTABLE
  const factor = 10 ** digits
  const rounded = Math.round(ratio * 100 * factor) / factor
  return `${rounded.toFixed(digits)}%`
}

/**
 * 数值 + 单位拼接：value 缺失 → 占位符（单位不单独出现，避免"— 秒"这种歧义）。
 * unit 必须由调用方传已翻译的单位文案（i18n key 的 t() 结果），
 * 本模块不内置任何语言的单位词表。
 */
export function formatWithUnit(value: number | null | undefined, unit: string, thousand = false): string {
  if (!isComputableNumber(value)) return UNCOMPUTABLE
  const text = thousand ? value.toLocaleString('en-US') : String(value)
  return unit ? `${text} ${unit}` : text
}

/**
 * 秒数 → 小时数值（保留 decimals 位小数）：车辆状态等报表的
 * totalDurationSeconds 已证实单位为秒；小时为跨语言最稳的展示单位，
 * 单位词由调用方翻译拼接（formatWithUnit(value, t('小时'))）。
 * 负值/缺失按缺失处理不参与聚合（异常记录取舍归页面 owner）。
 */
export function secondsToHours(seconds: number | null | undefined, decimals = 2): number | null {
  if (!isComputableNumber(seconds) || seconds < 0) return null
  const factor = 10 ** decimals
  const hours = Math.round((seconds / 3600) * factor) / factor
  return Number.isFinite(hours) ? hours : null
}
