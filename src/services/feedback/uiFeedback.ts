/**
 * App.useApp 反馈桥（规格 §7.2）：
 * axios 拦截器与请求编排只能调用本模块，不能直接调用 hook 或 antd 静态方法。
 * FeedbackBridge 组件调用 App.useApp() 并把 message/notification/modal 实例注册到此；
 * 实例未就绪时只记录错误、不排队补弹，避免初始化完成后出现过期提示。
 */
import type { App as AntdApp } from 'antd'
import { API_ERROR_MESSAGE_KEYS, getApiErrorText } from '@/i18n/errorTexts'
import type { ApiError } from '@/services/request/request.types'

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

/** 未知错误 requestId 提示格式：固定文案后附请求追踪标识 */
function withRequestId(text: string, requestId?: string): string {
  return requestId ? `${text}（requestId: ${requestId}）` : text
}

/** 展示一条全局错误消息；未就绪时仅记录，不排队补弹（规格 §7.2） */
export function showUiMessage(text: string): void {
  if (!instances) {
    console.error('[uiFeedback] 实例未就绪，仅记录错误消息：', text)
    return
  }
  instances.message.error(text)
}

/**
 * 展示 API 错误（规格 §7.4-3）：
 * 已知 errorCode 映射为前端 i18n 文案；未知错误显示固定兜底文案和 requestId，
 * 不直接把后端 message 当作已翻译文案。
 */
export function showUiApiError(error: ApiError): void {
  const known =
    error.errorCode !== undefined && Object.prototype.hasOwnProperty.call(API_ERROR_MESSAGE_KEYS, error.errorCode)
  if (known) {
    showUiMessage(getApiErrorText(error.errorCode))
    return
  }
  showUiMessage(withRequestId(getApiErrorText(undefined), error.requestId))
}
