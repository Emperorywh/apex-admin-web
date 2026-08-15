/**
 * 页面激活态 Hook（规格 §9.2）：
 * 用于视频、音频、iframe、ECharts、焦点、Portal 等 DOM 型副作用感知所在缓存实例
 * 是否可见，并提供激活变化通知（隐藏清理、重新激活重建由 Effect 与本通知共同承担）。
 * 上下文默认 true：不在 PageCacheHost 内的组件（如登录页）始终视为激活。
 * 具体副作用管理（图表 resize、视频暂停等）归各业务实现，本文件只提供 API。
 */
import { createContext, useContext, useEffect, useRef } from 'react'

/** 当前缓存实例是否可见（Activity mode='visible'）；由 PageCacheHost 按实例供给 */
export const PageActiveContext = createContext<boolean>(true)

/** 读取当前页面（缓存实例）激活态 */
export function usePageActive(): boolean {
  return useContext(PageActiveContext)
}

/**
 * 激活态变化通知：首次挂载与每次激活态翻转时回调（true→false 隐藏、false→true 重新激活）。
 * handler 经 ref 转发，调用方无需保持引用稳定。
 */
export function usePageActiveChange(handler: (active: boolean) => void): void {
  const isActive = usePageActive()
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    handlerRef.current(isActive)
  }, [isActive])
}
