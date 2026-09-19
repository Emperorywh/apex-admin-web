/**
 * 任意 JSON 值的展示文本转换（P23 引入；列表单元格与弹窗回显两处消费）。
 *
 * 纪律边界：
 * - 字符串原样返回，null/undefined → 空串（单元格空值一律留白）；
 * - 非字符串（数字/数组/对象等 OpenAPI object 域值）→ JSON 文本——这是展示层
 *   格式化，不改动表单/提交里的原始值（P23 专项「已有动作参数不因未知枚举
 *   丢失」：回显只转显示，不转数据）；
 * - 循环引用等不可序列化值回退 String()，不抛错不伪装。
 */

export function toValueDisplayText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
