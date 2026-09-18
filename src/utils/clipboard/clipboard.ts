/**
 * 剪贴板复制工具（P03 提取为共享 utils）。
 *
 * 安全上下文（https/localhost）优先 navigator.clipboard；
 * 部署环境可能为 http（clipboard API 不可用），降级 execCommand 兜底——
 * 与 P02 license-activation 域内实现同口径，后续任务可统一收口到本模块。
 */

/** 复制文本到剪贴板：成功返回 true；两种通道都失败时返回 false（调用方提示） */
export async function copyText(text: string): Promise<boolean> {
  // 非安全上下文下的降级复制：临时 textarea + execCommand
  const fallbackCopy = (value: string): boolean => {
    const textarea = document.createElement('textarea')
    textarea.value = value
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

  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    return fallbackCopy(text)
  } catch {
    return fallbackCopy(text)
  }
}
