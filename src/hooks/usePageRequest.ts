/**
 * 页面请求 scope：把当前缓存实例的取消信号透传给 service 调用。
 * 页签关闭、缓存淘汰或刷新（revision 变化）时信号中止，在途请求被取消。
 */

import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'

/** 无 scope 场景（登录页等）使用的常驻空闲信号 */
const IDLE_SIGNAL = new AbortController().signal

export interface PageRequestScope {
  signal: AbortSignal
  revision: number
}

export function usePageRequest(): PageRequestScope {
  const scope = useRequestScope()
  return {
    signal: scope?.signal ?? IDLE_SIGNAL,
    revision: scope?.revision ?? 0,
  }
}
