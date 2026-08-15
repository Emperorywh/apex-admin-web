/**
 * 页面请求 Hook（规格 §7.4-6）：
 * 经 RequestScopeProvider 读取当前页签 scopeId，返回自动附加 scopeId 的请求函数；
 * 页签隐藏、关闭或缓存淘汰时该 scope 的请求被统一取消。
 * Data Router loader 必须透传自身 request.signal，不使用本 Hook、不进入页面 scope。
 */
import { useCallback, useContext } from 'react'
import { RequestScopeContext } from '@/components/RequestScopeProvider/requestScopeContext'
import { request } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { AxiosRequestConfig } from 'axios'

/** 读取当前页签请求作用域；不在 RequestScopeProvider 内时为 null */
export function useRequestScopeId(): string | null {
  return useContext(RequestScopeContext)
}

/** 附加了页签 scopeId 的请求函数：入参与 request 完全一致（scopeId 由 Hook 注入） */
export type PageRequest = <T>(config: AxiosRequestConfig & RequestOptions) => Promise<T>

export function usePageRequest(): PageRequest {
  const scopeId = useContext(RequestScopeContext)
  if (scopeId === null) {
    throw new Error('usePageRequest 必须在 RequestScopeProvider 内使用')
  }
  return useCallback(
    <T>(config: AxiosRequestConfig & RequestOptions) => request<T>({ ...config, scopeId }),
    [scopeId],
  )
}
