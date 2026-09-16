/**
 * 对象页签身份（SPEC §8.1）：任务/车辆详情按「路由 + 业务对象标识」区分页签。
 *
 * - 目标规范形式：?orderTaskKey=<key> / ?vehicleKey=<key>；
 * - 兼容旧详情的裸 query 形式（/order-info?<rawKey>，整个 search 即对象 ID），
 *   解析后归一到规范参数，不把其余 query 参数误作对象身份；
 * - 缺失/非法参数返回 null：页签退化为路径身份（稳定复用同一错误页签），
 *   页面呈现明确错误，不发送携带 undefined 的业务查询。
 */

/** 从 search 解析对象标识；兼容旧裸 query（无 = 的单段值） */
export function resolveObjectKey(search: string, paramName: string): string | null {
  const raw = search.startsWith('?') ? search.slice(1) : search
  if (!raw) return null
  if (raw.includes('=') || raw.includes('&')) {
    // 规范 query：只认声明参数，其余参数不参与对象身份
    return new URLSearchParams(raw).get(paramName)
  }
  // 旧裸 query：整段即对象 ID（旧实现 search.substring(1) 直接作 key）
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

/** 规范化页签 key：pathname + 仅含对象参数的规范 search；缺失对象时退化为 pathname */
export function buildObjectTabKey(
  pathname: string,
  search: string,
  paramName: string,
): { key: string; objectKey: string | null } {
  const objectKey = resolveObjectKey(search, paramName)
  if (!objectKey) return { key: pathname, objectKey: null }
  return {
    key: `${pathname}?${paramName}=${encodeURIComponent(objectKey)}`,
    objectKey,
  }
}
