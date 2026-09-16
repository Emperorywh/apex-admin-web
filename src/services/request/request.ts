/**
 * HTTP 基础设施：新协议（/api/v1）axios 实例。
 * - 成功响应直接返回资源 JSON 本体（协议无 code envelope）
 * - 失败统一收敛为 ApiError（RFC 9457 problem+json / 客户端错误）
 * - 身份协议已切换旧后端（auth.service，T005）：本通道不再持有令牌、
 *   不再有 /auth/refresh 刷新与 401 重放（SPEC §6.2：不启动两套认证）；
 *   存量模板接口在各自迁移卡接入旧协议前保持原样调用。
 */

import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import {
  CLIENT_ERROR_CODES,
  DEFAULT_API_BASE_URL,
  REQUEST_TIMEOUT_MS,
} from '@/services/request/request.constants'
import type { ApiError } from '@/services/request/request.types'

/** 抛出的请求错误；携带规范化 ApiError，调用方用 toApiError 还原 */
export class ApiRequestError extends Error {
  readonly api: ApiError

  constructor(api: ApiError) {
    super(api.title)
    this.name = 'ApiRequestError'
    this.api = api
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiRequestError) return error.api
  if (axios.isAxiosError(error)) return fromAxiosError(error)
  return {
    isApiError: true,
    code: CLIENT_ERROR_CODES.UNKNOWN,
    status: 0,
    title: error instanceof Error ? error.message : '未知错误',
  }
}

/** 提取可展示的错误文案（detail 优先，其次 title）；取消类错误返回空串 */
export function apiErrorMessage(error: unknown): string {
  const api = toApiError(error)
  if (api.code === CLIENT_ERROR_CODES.CANCELLED) return ''
  return api.detail || api.title
}

/** 是否为主动取消（切换页签 / 刷新页签导致），调用方据此跳过报错提示 */
export function isCancelledError(error: unknown): boolean {
  return toApiError(error).code === CLIENT_ERROR_CODES.CANCELLED
}

function fromAxiosError(error: AxiosError): ApiError {
  if (error.code === 'ERR_CANCELED' || axios.isCancel(error)) {
    return { isApiError: true, code: CLIENT_ERROR_CODES.CANCELLED, status: 0, title: '请求已取消' }
  }
  const response = error.response
  if (!response) {
    return {
      isApiError: true,
      code: CLIENT_ERROR_CODES.NETWORK_ERROR,
      status: 0,
      title: '网络不可达，请检查连接或后端服务',
    }
  }
  const body = (response.data ?? {}) as {
    code?: string
    title?: string
    detail?: string
    errors?: ApiError['errors']
  }
  let dataText: string | undefined
  if (typeof response.data === 'string') dataText = response.data.slice(0, 200)
  return {
    isApiError: true,
    code: body.code ?? CLIENT_ERROR_CODES.UNKNOWN,
    status: response.status,
    title: body.title ?? `请求失败（HTTP ${response.status}）`,
    detail: body.detail ?? dataText,
    errors: body.errors,
  }
}

function fail(api: ApiError): never {
  throw new ApiRequestError(api)
}

/* -------------------------------------------------------------------------- */
/* 请求健康状态（顶栏网络指示）                                                    */
/* -------------------------------------------------------------------------- */

export interface RequestHealth {
  lastStatus: 'ok' | 'error' | null
  lastCheckedAt: number
  consecutiveFailures: number
}

let requestHealth: RequestHealth = { lastStatus: null, lastCheckedAt: 0, consecutiveFailures: 0 }
const healthListeners = new Set<(health: RequestHealth) => void>()

function recordHealth(ok: boolean): void {
  requestHealth = {
    lastStatus: ok ? 'ok' : 'error',
    lastCheckedAt: Date.now(),
    consecutiveFailures: ok ? 0 : requestHealth.consecutiveFailures + 1,
  }
  for (const listener of healthListeners) listener(requestHealth)
}

export function getRequestHealth(): RequestHealth {
  return requestHealth
}

export function subscribeRequestHealth(listener: (health: RequestHealth) => void): () => void {
  healthListeners.add(listener)
  return () => healthListeners.delete(listener)
}

/* -------------------------------------------------------------------------- */
/* axios 实例                                                                   */
/* -------------------------------------------------------------------------- */

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL

const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: REQUEST_TIMEOUT_MS,
})

http.interceptors.response.use(
  (response) => {
    recordHealth(true)
    const contentType = String(response.headers?.['content-type'] ?? '')
    if (contentType.includes('text/html')) {
      // 代理目标返回 HTML（后端未启动、端口被其他应用占用等）：按不可达处理
      return handleRequestError(
        Object.assign(new AxiosError('API 目标返回了 HTML 而非 JSON', 'APEX_HTML_RESPONSE', response.config, null, response), {}),
      )
    }
    // 协议无 code envelope：直接返回资源 JSON 本体
    return response.data
  },
  (error: AxiosError) => handleRequestError(error),
)

async function handleRequestError(error: AxiosError): Promise<unknown> {
  const canceled = error.code === 'ERR_CANCELED' || axios.isCancel(error)
  const responded = Boolean(error.response)
  const responseStatus = error.response?.status ?? 0
  const responseJson =
    String(error.response?.headers?.['content-type'] ?? '').includes('json') ||
    // Vite 代理上游不可达时返回 502 text/plain：DEV 下视同网关错误
    (import.meta.env.DEV === false && responseStatus >= 500)
  // HTML 响应 / DEV 下网关级非 JSON 5xx：视同未触达真实后端
  const unreachable =
    !responded ||
    error.code === 'APEX_HTML_RESPONSE' ||
    (import.meta.env.DEV && responseStatus >= 500 && !responseJson)

  if (!canceled) recordHealth(responded && error.code !== 'APEX_HTML_RESPONSE' && !unreachable)

  // 401 不再触发刷新重放：本通道不承载身份；统一按失败抛出，
  // 会话失效编排只由旧协议事件（auth.service 事件桥）驱动
  fail(fromAxiosError(error))
}

/* -------------------------------------------------------------------------- */
/* 类型一致的轻封装：拦截器已把响应收敛为 body，此处仅纠正返回类型                     */
/* -------------------------------------------------------------------------- */

export const api = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return http.get(url, config) as unknown as Promise<T>
  },
  post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return http.post(url, body, config) as unknown as Promise<T>
  },
  put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return http.put(url, body, config) as unknown as Promise<T>
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return http.delete(url, config) as unknown as Promise<T>
  },
}

export default http
