/**
 * 回跳目标同源安全校验（规格 §4.3/§17.21）：
 * https://evil.example、//evil.example、反斜杠路径与含控制字符的地址全部判为不安全。
 * 守卫写入 redirect 参数、会话清理跳登录与登录后回跳都复用本纯函数；
 * 调用方在校验失败时按自身语义回退（守卫回 Dashboard，会话清理直接不带 redirect）。
 */

/** 判断是否包含控制字符（C0 区 0x00-0x1f 与 DEL 0x7f）：URL 中出现即判为注入企图 */
function hasControlChar(target: string): boolean {
  for (const ch of target) {
    const code = ch.codePointAt(0) ?? 0
    if (code <= 0x1f || code === 0x7f) {
      return true
    }
  }
  return false
}

/**
 * 判断回跳目标是否为同源安全地址：
 * 必须是以单个 / 开头的站内路径；不得是协议相对地址（// 开头）、
 * 不得包含反斜杠（斜杠反斜杠开头的地址会被浏览器规范化为协议相对地址）、
 * 不得包含控制字符；空串、绝对 URL 与相对路径一律不安全。
 */
export function isSafeRedirectTarget(target: string): boolean {
  if (target.length === 0) {
    return false
  }
  if (!target.startsWith('/')) {
    return false
  }
  if (target.startsWith('//')) {
    return false
  }
  if (target.includes('\\')) {
    return false
  }
  return !hasControlChar(target)
}
