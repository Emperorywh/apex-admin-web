/**
 * 关联选项失效处理的统一契约（T00.7，通用 DoD 10 / 规格规格 11.1）。
 *
 * 纪律：地图/节点/动作/车辆/驱动等关联资源失效、删除或不再可访问时，
 * 显示原有标识及不可用状态，禁止静默选择第一项替代、禁止把失效值映射成
 * 其他有效选项。本模块只提供"匹配判定 + 失效标签"纯函数；
 * 「不自动选第一项」是页面行为红线，无需也无法由工具函数代为保证。
 */

import i18next from 'i18next'

/** utils 层翻译入口（同请求层模式，直接依赖 i18next 包单例） */
function tr(key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, options ?? {})
}

/** 匹配结果：matched 携带命中的选项对象；missing 表示值已不在当前选项集合中 */
export type OptionMatch<T> = { status: 'matched'; option: T } | { status: 'missing' }

/**
 * 按标识在选项集合中精确匹配当前已选值。
 * 返回 missing 时，调用方必须以"保留原值 + 不可用说明"的方式呈现
 * （missingOptionLabel 生成展示标签），并按业务阻止错误保存。
 */
export function matchOptionById<T>(
  options: readonly T[],
  value: string | null | undefined,
  getId: (option: T) => string,
): OptionMatch<T> {
  if (value === null || value === undefined || value === '') return { status: 'missing' }
  const hit = options.find((option) => getId(option) === value)
  return hit ? { status: 'matched', option: hit } : { status: 'missing' }
}

/**
 * 失效选项的展示标签：保留原始标识 + 不可用说明（不静默替换、不显示空白）。
 * rawId 为后端协议原值（ID / 名称均可，由页面决定传哪个可识别值）。
 */
export function missingOptionLabel(rawId: string | null | undefined): string {
  if (rawId === null || rawId === undefined || rawId === '') {
    return tr('（原值缺失）')
  }
  return tr('{{id}}（已不在当前选项中）', { id: rawId })
}

/**
 * 判定一批已选值中是否存在失效项（用于保存前校验与"阻止错误保存"）。
 * 返回全部失效的原值列表；空数组表示全部有效。
 */
export function findMissingOptions(
  options: readonly string[],
  selectedValues: readonly (string | null | undefined)[],
): string[] {
  const known = new Set(options)
  return selectedValues.filter((value) => value !== null && value !== undefined && value !== '' && !known.has(value)) as string[]
}
