/**
 * 回跳参数五步同源校验（规格 §4.3/§17.21）：
 * 登录回跳值必须依次通过——① URLSearchParams#get 取已解码一次的值（不再二次解码）
 * 并拒绝控制字符与反斜杠；② 以单个 / 开头且拒绝 //；③ new URL(value, origin) 规范化；
 * ④ 规范化后 origin 与当前 origin 严格相等；⑤ 只返回 pathname + search + hash。
 * 任一步失败统一回退 /dashboard；禁止把未经本模块处理的 redirect 传给 navigate/redirect/<a href>。
 */
import { REDIRECT_QUERY_KEY, ROUTE_FALLBACK_PATH } from '@/constants/route.constants'
import { isSafeRedirectTarget } from '@/utils/redirect'

/**
 * 对「已解码一次」的回跳原始值执行第 ②-⑤ 步校验（规格 §4.3）：
 * 调用方必须先用 URLSearchParams#get 取值，禁止再调用 decodeURIComponent。
 * 返回合法的 pathname + search + hash；任何不安全形态回退 /dashboard。
 */
export function sanitizeRedirectTarget(raw: string | null, origin: string): string {
  // 第 ② 步前置形态校验：空值、相对路径、协议相对地址、反斜杠与控制字符全部拒绝
  if (raw === null || !isSafeRedirectTarget(raw)) {
    return ROUTE_FALLBACK_PATH
  }
  // 第 ③ 步：以当前 origin 为基准规范化，消除 ../、编码等漂移
  let url: URL
  try {
    url = new URL(raw, origin)
  } catch {
    return ROUTE_FALLBACK_PATH
  }
  // 第 ④ 步：规范化后的 origin 必须与当前 origin 严格相等
  if (url.origin !== origin) {
    return ROUTE_FALLBACK_PATH
  }
  // 第 ⑤ 步：只返回站内地址，丢弃凭据等其余成分
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * 完整五步校验入口（规格 §4.3 第 ①-⑤ 步）：
 * 第 ① 步从 search 串经 URLSearchParams#get 取已解码一次的 redirect 值，
 * 随后执行 sanitizeRedirectTarget；参数缺失同样回退 /dashboard。
 */
export function readSanitizedRedirectTarget(search: string, origin: string): string {
  const raw = new URLSearchParams(search).get(REDIRECT_QUERY_KEY)
  return sanitizeRedirectTarget(raw, origin)
}
