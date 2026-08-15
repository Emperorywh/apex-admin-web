/**
 * 页面请求作用域供给（规格 §7.4-6/§3.1）：
 * 为当前页签的组件树提供 scopeId 的 React 上下文，usePageRequest 经它自动附加页签 scopeId。
 * 每个页面缓存实例挂载一个 Provider（由 PageCacheHost 完成）；卸载（页签关闭/缓存淘汰）时
 * 统一 abort 该 scope，页签隐藏时的 abort 由页签系统调用 abortRequestScope 完成。
 */
import { useEffect, type ReactNode } from 'react'
import { abortRequestScope } from '@/services/request/requestScope'
import { RequestScopeContext } from './requestScopeContext'

export function RequestScopeProvider({ scopeId, children }: { scopeId: string; children: ReactNode }) {
  useEffect(() => {
    // 卸载或切换作用域时取消该 scope 的全部在途请求（规格 §17.12）
    return () => {
      abortRequestScope(scopeId)
    }
  }, [scopeId])
  return <RequestScopeContext.Provider value={scopeId}>{children}</RequestScopeContext.Provider>
}
