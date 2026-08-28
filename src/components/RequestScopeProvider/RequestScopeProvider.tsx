/**
 * 页面请求 scope：每个缓存页签实例一个独立的 AbortController 生命周期。
 * - revision/scopeKey 变化（刷新页签、重建缓存）时取消在途请求并整体重建子树
 * - 卸载（关闭页签、LRU 淘汰）时取消在途请求
 * - 同时承载页面激活状态，供 usePageActive 消费
 */

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { RequestScopeContext, type RequestScopeValue } from '@/components/RequestScopeProvider/RequestScopeContext'

interface RequestScopeProviderProps {
  /** scope 唯一标识（页签 key） */
  scopeKey: string
  /** 重建计数 */
  revision: number
  /** 页面是否处于激活（Activity visible） */
  isActive: boolean
  children: ReactNode
}

export function RequestScopeProvider({ scopeKey, revision, isActive, children }: RequestScopeProviderProps) {
  const [controller, setController] = useState(() => new AbortController())
  const lastScopeRef = useRef(`${scopeKey}:${revision}`)
  const currentScope = `${scopeKey}:${revision}`

  // 渲染期调整（React 认可的 derived-state 模式）：scope 变化即刻取消旧请求并换新控制器
  if (lastScopeRef.current !== currentScope) {
    lastScopeRef.current = currentScope
    controller.abort()
    setController(new AbortController())
  }

  useEffect(() => {
    // StrictMode 首挂载模拟卸载、<Activity> 隐藏页签都会先走一次 cleanup（abort），
    // 而 controller 是组件 state，不会随之重建；signal 已中止时换新控制器自愈，
    // 否则该页签后续所有请求都被静默取消。
    if (controller.signal.aborted) {
      setController(new AbortController())
      return
    }
    return () => {
      controller.abort()
    }
  }, [controller])

  const value = useMemo<RequestScopeValue>(
    () => ({ signal: controller.signal, revision, isActive }),
    [controller, revision, isActive],
  )

  return (
    <RequestScopeContext.Provider value={value}>
      <Fragment key={currentScope}>{children}</Fragment>
    </RequestScopeContext.Provider>
  )
}
