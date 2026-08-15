/**
 * App.useApp 反馈桥（规格 §7.2）：
 * antd App 的子组件，调用 App.useApp() 并把 message/notification/modal 实例注册到 uiFeedback 模块；
 * axios 拦截器与请求编排只能经 uiFeedback 间接使用这些实例。
 * 卸载时清空注册，避免 uiFeedback 持有过期实例。
 */
import { App as AntdApp } from 'antd'
import { useEffect, type ReactNode } from 'react'
import { registerUiFeedbackInstances, resetUiFeedbackInstances } from '@/services/feedback/uiFeedback'

export function FeedbackBridge({ children }: { children: ReactNode }) {
  const { message, notification, modal } = AntdApp.useApp()
  useEffect(() => {
    registerUiFeedbackInstances({ message, notification, modal })
    return () => {
      resetUiFeedbackInstances()
    }
  }, [message, notification, modal])
  return <>{children}</>
}
