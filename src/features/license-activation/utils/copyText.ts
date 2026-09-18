/**
 * 剪贴板复制工具（license-activation 业务域内共享；P02 硬件码复制，
 * P29 如需复制授权信息可复用）。
 *
 * 系统常部署在 http 内网环境：navigator.clipboard 仅在安全上下文（https/localhost）
 * 可用，因此保留 execCommand 兜底，保证内网 http 环境复制功能始终可用
 * （沿用旧系统已证实行为，非新增猜测协议）。
 */

/** 复制文本到剪贴板；返回是否复制成功，由调用方决定用户反馈 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  // 安全上下文优先使用异步 Clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 权限被拒等异常时继续尝试兜底方案，不直接判失败
    }
  }
  // 兜底：临时挂载不可见 textarea + execCommand（deprecated 但内网 http 环境唯一可用）
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(textarea)
  return ok
}
