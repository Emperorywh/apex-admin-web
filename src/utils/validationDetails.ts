/**
 * VALIDATION.FAILED 错误解析（规格 §14.4 v1.14）：
 * 失败响应 problem+json 的 errors 数组元素固定为 { field, reason, message }，
 * 由 envelope 归一后经 ApiError.details 原样透传。
 * 本函数做防御性窄化：形状不符（含缺失/非数组/条目字段类型不对）时返回 null，
 * 由调用端回退页面级错误呈现；字段级映射只消费本函数的合法输出。
 */

/** problem+json errors 数组的合法条目形状（规格 §14.4 v1.14） */
export interface ValidationFieldIssue {
  field: string
  message: string
}

/** 去掉 FastAPI 定位前缀（body./query./path.）取末段字段名，便于与表单字段名直接匹配 */
function normalizeFieldName(field: string): string {
  const segments = field.split('.')
  return segments[segments.length - 1] ?? field
}

/**
 * 把 ApiError.details（problem+json 的 errors 数组）窄化为字段错误列表。
 * 返回 null 表示 details 不是 §14.4 约定的合法形状；空列表表示约定形状但无字段条目。
 */
export function parseValidationFieldIssues(details: unknown): ValidationFieldIssue[] | null {
  if (!Array.isArray(details)) {
    return null
  }
  const issues: ValidationFieldIssue[] = []
  for (const entry of details) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const { field, message } = entry as { field?: unknown; message?: unknown }
    if (typeof field === 'string' && typeof message === 'string') {
      issues.push({ field: normalizeFieldName(field), message })
    }
  }
  return issues
}
