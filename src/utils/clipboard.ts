/**
 * 剪贴板纯工具（无业务语义）。
 *
 * 源系统（P02 授权页 / P29 软件信息页 @ e570b8df）均自带同一段复制实现：
 * 系统常部署在 http 内网环境，navigator.clipboard 仅在安全上下文（https /
 * localhost）可用，因此必须保留 execCommand 兜底，保证内网部署下复制可用。
 * 两页行为一致，抽为唯一实现供 P02/P29 及后续页面复用。
 */

/**
 * 复制文本到系统剪贴板；同步返回是否成功（源行为：成功才提示「已复制」）。
 * 安全上下文优先 navigator.clipboard；否则以隐藏 textarea + execCommand 降级。
 */
export function copyTextToClipboard(text: string): boolean {
  if (!text) return false
  if (navigator.clipboard && window.isSecureContext) {
    // writeText 返回 promise，此处不等待：源实现同样发后即认为成功
    void navigator.clipboard.writeText(text)
    return true
  }
  // 非安全上下文（http 内网）降级路径：离屏 textarea 选中后执行复制命令
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-1000px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(textarea)
  return ok
}
