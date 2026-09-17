/**
 * 请求 scope 上下文：由 RequestScopeProvider 提供，
 * usePageActive / usePageRequest 消费（无 Provider 场景返回 null）。
 */

import { createContext, useContext } from 'react'

export interface RequestScopeValue {
  /** scope 唯一标识：页签 key 或 current:<routeId>:<locationKey>（T00.6 脏状态登记用） */
  scopeKey: string
  signal: AbortSignal
  revision: number
  isActive: boolean
}

export const RequestScopeContext = createContext<RequestScopeValue | null>(null)

/** 无 Provider 场景（登录页等）返回 null */
export function useRequestScope(): RequestScopeValue | null {
  return useContext(RequestScopeContext)
}
