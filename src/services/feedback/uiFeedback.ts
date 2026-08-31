/**
 * App.useApp 反馈桥（纯前端模式）：
 * 非组件代码只能调用本模块，不能直接调用 hook 或 antd 静态方法。
 * FeedbackBridge 组件调用 App.useApp() 并把 message/notification/modal 实例注册到此；
 * 实例未就绪时只记录错误、不排队补弹，避免初始化完成后出现过期提示。
 */
import type { App as AntdApp } from 'antd'

/** FeedbackBridge 注册的 antd App.useApp 实例集合 */
export type UiFeedbackInstances = Pick<ReturnType<typeof AntdApp.useApp>, 'message' | 'notification' | 'modal'>

let instances: UiFeedbackInstances | null = null

/** 注册 antd App.useApp 实例；由 FeedbackBridge 挂载时调用 */
export function registerUiFeedbackInstances(api: UiFeedbackInstances): void {
  instances = api
}

/** 清空注册实例；由 FeedbackBridge 卸载时调用，避免持有过期实例 */
export function resetUiFeedbackInstances(): void {
  instances = null
}

/** 反馈桥是否已就绪（FeedbackBridge 已挂载） */
export function isUiFeedbackReady(): boolean {
  return instances !== null
}

/** 展示一条全局错误消息；未就绪时仅记录，不排队补弹 */
export function showUiMessage(text: string): void {
  if (!instances) {
    console.error('[uiFeedback] 实例未就绪，仅记录错误消息：', text)
    return
  }
  instances.message.error(text)
}

/** 展示一条全局警告消息（非错误降级提示，如持久化恢复失败一次性提醒）；未就绪仅记录 */
export function showUiWarning(text: string): void {
  if (!instances) {
    console.error('[uiFeedback] 实例未就绪，仅记录警告消息：', text)
    return
  }
  instances.message.warning(text)
}
