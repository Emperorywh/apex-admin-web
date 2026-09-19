/**
 * 调度配置编辑纯函数（P13）：配置值在「协议字符串 ↔ 编辑控件值」之间的
 * 双向转换、取值范围解析与选项拆分。放独立模块避免组件文件混出非组件导出
 * （fast-refresh 纪律），并便于逐项断言旧版行为等价。
 *
 * 旧版对照（C:\code\dd\src\pages\DispatchHub\DispatchTable\EditableCell）：
 * - int/double 的范围解析：形如 "[1,10)" 的字符串 → min/max；
 *   旧版用 parseInt 截断小数，对 double 的范围（如 "[0.1,0.9]"）会解析出
 *   错误边界——本实现改用 parseFloat（整数范围结果不变，小数范围边界正确，
 *   属无害修复，非语义变更）；
 * - 开闭区间纪律沿用旧版：以 "[" 开头左边界取本身，否则 +1（左开）；
 *   以 "]" 结尾右边界取本身，否则 -1（右开）；
 * - enum/select 选项：configValueRange 按 ";" 拆分；
 * - bool 协议值为 "true"/"false" 字符串；select 协议值为 ";" 分隔字符串。
 */

import type { TaskConfigValueType } from '@/services/dispatch-config/dispatch-config.service.types'

/** 范围解析结果：range 无法解析时 min/max 均缺失（不猜边界，控件不限范围） */
export interface ConfigValueRange {
  min?: number
  max?: number
}

/**
 * 解析 "[min,max]" / "(min,max]" 形态的取值范围字符串。
 * 无法提取两个数字时返回空对象（旧版同形态返回 undefined → 控件不设限）。
 */
export function parseConfigValueRange(range: string | undefined | null): ConfigValueRange {
  if (!range) return {}
  // 提取第一段「数字(含小数)、逗号」序列，容忍括号与空白
  const matches = range.match(/[\d,.]+/g)
  if (!matches || matches.length === 0) return {}
  const [rawMin, rawMax] = matches[0].split(',')
  if (rawMin === undefined || rawMax === undefined) return {}
  const min = Number.parseFloat(rawMin)
  const max = Number.parseFloat(rawMax)
  if (Number.isNaN(min) || Number.isNaN(max)) return {}
  return {
    // 左开区间（不以 "[" 开头）边界内收 1；闭区间取本身
    min: range.startsWith('[') ? Math.min(min, max) : Math.min(min, max) + 1,
    max: range.endsWith(']') ? Math.max(min, max) : Math.max(min, max) - 1,
  }
}

/** 拆分 enum/select 的选项集合（";" 分隔）；空 range 返回空数组 */
export function parseConfigValueOptions(range: string | undefined | null): string[] {
  if (!range) return []
  return range
    .split(';')
    .filter((item) => item !== '')
}

/** 已知配置值类型集合：未知类型不开放编辑（只读展示协议原值） */
const KNOWN_VALUE_TYPES: readonly TaskConfigValueType[] = [
  'int',
  'bool',
  'enum',
  'select',
  'double',
  'string',
]

export function isKnownValueType(type: string | undefined): type is TaskConfigValueType {
  return type !== undefined && (KNOWN_VALUE_TYPES as readonly string[]).includes(type)
}

/**
 * 协议字符串 → 编辑控件值（双向转换的入侧）：
 * - bool → 布尔（"true" 才为 true，其余含空值一律 false——协议只有两态）；
 * - int/double → 数值（无法解析时 undefined，交由控件空态展示）；
 * - select → 字符串数组（";" 拆分）；
 * - enum/string → 原文。
 */
export function toEditorValue(
  type: TaskConfigValueType,
  raw: string | undefined | null,
): string | number | boolean | string[] | undefined {
  const text = raw ?? ''
  switch (type) {
    case 'bool':
      return text === 'true'
    case 'int':
    case 'double': {
      if (text === '') return undefined
      const num = Number.parseFloat(text)
      return Number.isNaN(num) ? undefined : num
    }
    case 'select':
      return parseConfigValueOptions(text)
    default:
      return text
  }
}

/**
 * 编辑控件值 → 协议字符串（出侧；批量保存请求体的 configValue 即此结果）：
 * - bool → "true"/"false"；
 * - int/double → 数值字符串（precision 约束由控件保证）；
 * - select → ";" 连接；
 * - enum/string → 原文（undefined/空归一为空串，不落 "undefined" 字样）。
 */
export function fromEditorValue(
  type: TaskConfigValueType,
  value: unknown,
): string {
  switch (type) {
    case 'bool':
      return value === true || value === 'true' ? 'true' : 'false'
    case 'int':
    case 'double':
      return value === null || value === undefined || value === '' ? '' : String(value)
    case 'select':
      return Array.isArray(value) ? value.map(String).join(';') : String(value ?? '')
    default:
      return value === null || value === undefined ? '' : String(value)
  }
}
