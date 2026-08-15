/**
 * VALIDATION_FAILED.details 解析（规格 §14.4）：
 * 失败 envelope 的 details 固定为 { fields: Array<{ field: string; message: string }> }。
 * 本函数做防御性窄化：形状不符（含缺失/非对象/字段类型不对）时返回 null，
 * 由调用端回退页面级错误呈现；字段级映射只消费本函数的合法输出。
 */

/** details.fields 的合法条目形状（规格 §14.4） */
export interface ValidationFieldIssue {
  field: string
  message: string
}

/**
 * 把 ApiError.details 窄化为字段错误列表。
 * 返回 null 表示 details 不是 §14.4 约定的合法形状；空列表表示约定形状但无字段条目。
 */
export function parseValidationFieldIssues(details: unknown): ValidationFieldIssue[] | null {
  if (typeof details !== 'object' || details === null) {
    return null
  }
  const fields = (details as { fields?: unknown }).fields
  if (!Array.isArray(fields)) {
    return null
  }
  const issues: ValidationFieldIssue[] = []
  for (const entry of fields) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const { field, message } = entry as { field?: unknown; message?: unknown }
    if (typeof field === 'string' && typeof message === 'string') {
      issues.push({ field, message })
    }
  }
  return issues
}
