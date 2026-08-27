/**
 * 静态反馈桥接：非组件上下文（请求拦截器、路由守卫等）使用 antd
 * message/notification/modal 的唯一入口。
 * App.useApp() 的实例由 components/FeedbackBridge 在应用挂载时注入；
 * 注入前调用只记录到 console，不抛错，避免初始化竞态导致白屏。
 */

import type { MessageInstance } from 'antd/es/message/interface'
import type { NotificationInstance } from 'antd/es/notification/interface'
import type { HookAPI as ModalHookAPI } from 'antd/es/modal/useModal'

interface FeedbackApi {
  message: MessageInstance
  notification: NotificationInstance
  modal: ModalHookAPI
}

let api: FeedbackApi | null = null

/** 未注入前的降级实现：仅输出到控制台 */
const consoleShim = new Proxy(
  {},
  {
    get:
      (_target, prop) =>
      (...args: unknown[]) => {
        // eslint-disable-next-line no-console
        console.warn(`[uiFeedback] 尚未注入，忽略调用 ${String(prop)}`, ...args)
      },
  },
) as unknown as FeedbackApi

export const uiFeedback = {
  /** 由 FeedbackBridge 调用，注入 App.useApp() 实例 */
  setApi(next: FeedbackApi): void {
    api = next
  },
  get message(): MessageInstance {
    return api?.message ?? consoleShim.message
  },
  get notification(): NotificationInstance {
    return api?.notification ?? consoleShim.notification
  },
  get modal(): ModalHookAPI {
    return api?.modal ?? consoleShim.modal
  },
}
