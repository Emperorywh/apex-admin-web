/**
 * 无业务语义的 URL 纯工具。
 */

/**
 * 规范化 search 字符串：按参数名稳定排序，同名重复参数保持原顺序。
 * 用于页签 key 的稳定性。
 */
export function normalizeSearchString(search: string): string {
  if (!search) return ''
  const params = new URLSearchParams(search)
  params.sort()
  const normalized = params.toString()
  return normalized ? `?${normalized}` : ''
}
