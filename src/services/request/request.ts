/**
 * HTTP 基础设施：唯一 axios 实例。
 * - 成功响应直接返回资源 JSON 本体（协议无 code envelope）
 * - 失败统一收敛为 ApiError（RFC 9457 problem+json / 客户端错误）
 * - 401 时以单飞方式刷新令牌（refreshToken 位于 HttpOnly Cookie，不进 JSON）并重放原请求
 * - DEV 环境在网络不可达时回退到内存演示后端（demoFallback），保证模板离线可演示
 */

import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import {
  API_ERROR_CODES,
  CLIENT_ERROR_CODES,
  DEFAULT_API_BASE_URL,
  REFRESH_LOCK_TTL_MS,
  REFRESH_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
} from '@/constants/request.constants'
import { tryDemoFallback } from '@/services/request/demoFallback'
import type { ApiError } from '@/services/request/request.types'
import { sessionExpired } from '@/store/slices/authSlice'

/** axios 配置扩展：演示回退与刷新重放标记，防止循环 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    demoFallbackApplied?: boolean
    _retriedAfterRefresh?: boolean
  }
}

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
/* 令牌持有（内存态；页面刷新后依赖 Cookie refreshToken 恢复）                        */
/* -------------------------------------------------------------------------- */

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
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

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`)
  return config
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
  const config = error.config as (InternalAxiosRequestConfig & AxiosRequestConfig) | undefined
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

  // DEV 演示回退：网络不可达 / HTML 响应且未尝试过时启用
  if (import.meta.env.DEV && !canceled && unreachable && config && !config.demoFallbackApplied) {
    const fallback = await tryDemoFallback(config)
    if (fallback) {
      config.demoFallbackApplied = true
      if (fallback.status < 400) return fallback.data
      fail({
        isApiError: true,
        code: fallback.code ?? CLIENT_ERROR_CODES.UNKNOWN,
        status: fallback.status,
        title: fallback.title ?? `请求失败（HTTP ${fallback.status}）`,
        detail: fallback.detail,
      })
    }
  }

  const isAuthCall =
    config?.url?.includes('/auth/login') === true ||
    config?.url?.includes('/auth/refresh') === true

  // 401 统一码：刷新令牌并重放（登录/刷新自身除外）
  if (
    responded &&
    error.response?.status === 401 &&
    (error.response.data as { code?: string } | undefined)?.code ===
      API_ERROR_CODES.UNAUTHENTICATED &&
    !isAuthCall &&
    config &&
    !config.demoFallbackApplied &&
    !config._retriedAfterRefresh
  ) {
    try {
      await refreshAccessToken()
      const retryConfig: InternalAxiosRequestConfig = { ...config, _retriedAfterRefresh: true }
      return await http.request(retryConfig)
    } catch {
      expireSession()
      fail({
        isApiError: true,
        code: API_ERROR_CODES.UNAUTHENTICATED,
        status: 401,
        title: '登录已过期，请重新登录',
      })
    }
  }

  fail(fromAxiosError(error))
}

/** 重放标记；仅内部使用 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    _retriedAfterRefresh?: boolean
  }
}

/* -------------------------------------------------------------------------- */
/* 刷新令牌单飞                                                                  */
/* -------------------------------------------------------------------------- */

let refreshPromise: Promise<string> | null = null
let refreshLockUntil = 0

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise
  if (Date.now() < refreshLockUntil) {
    return Promise.reject(new Error('刷新令牌处于冷却期'))
  }
  refreshLockUntil = Date.now() + REFRESH_LOCK_TTL_MS
  refreshPromise = axios
    .post('/auth/refresh', null, { baseURL: apiBaseUrl, timeout: REFRESH_TIMEOUT_MS })
    .then((response) => {
      const token = (response.data as { accessToken?: string } | null)?.accessToken
      if (!token) throw new Error('刷新响应缺少 accessToken')
      setAccessToken(token)
      return token
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

/* -------------------------------------------------------------------------- */
/* 会话失效分发                                                                 */
/* -------------------------------------------------------------------------- */

function expireSession(): void {
  setAccessToken(null)
  import('@/store/store').then(({ store }) => {
    store.dispatch(sessionExpired())
  })
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
