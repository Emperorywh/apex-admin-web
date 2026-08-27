/**
 * 静态反馈桥：把 App.useApp() 实例注入 uiFeedback，
 * 供请求拦截器等非组件上下文使用（禁止静态调用 antd 反馈 API）。
 */

import { useEffect } from 'react'
import { App } from 'antd'
import { uiFeedback } from '@/services/feedback/uiFeedback'

export function FeedbackBridge() {
  const staticFeedback = App.useApp()

  useEffect(() => {
    uiFeedback.setApi({
      message: staticFeedback.message,
      notification: staticFeedback.notification,
      modal: staticFeedback.modal,
    })
  }, [staticFeedback])

  return null
}
