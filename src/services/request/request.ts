/**
 * HTTP 基础设施：唯一 axios 实例（调度协议）。
 *
 * - 成功响应统一解包 Result{code,message,timestamp,data}，HTTP 成功且业务 code=200
 *   才进入成功分支；不依赖 message === 'success' 字符串（迁移规格 4.2）
 * - 文件/流（非 JSON）响应原样透传，不套 Result 解包（文件通道归各页面任务消费）
 * - 失败（HTTP 协议错误 / 业务码非 200 / 响应形状异常）统一收敛为 ApiError
 * - 主动取消静默：不抛可展示错误、不误判离线、不计入服务健康
 * - 会话失效（业务码 1000000）单飞收敛：清令牌、一次性提示，跳转由外壳统一处理；
 *   任何请求都不因 401/过期自动重放（后端无刷新令牌契约，G01/G02）
 * - 系统未激活（业务码 1001000）单飞收敛：一次性提示并派发引导事件，
 *   由 ActivationRedirectListener 导航到软件授权页（P02，真实环境已实证该业务码）
 * - 认证适配点：Authorization: Bearer <token>（旧项目已证实行为）；
 *   密码 MD5 摘要在 auth.service 单点执行（两者最终确认统一登记缺口 G03）
 */

import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import i18next from 'i18next'
import { ROUTE_PATHS } from '@/router/definitions'
import {
  ACTIVATION_REQUIRED_EVENT,
  CLIENT_ERROR_CODES,
  DEFAULT_API_BASE_URL,
  REQUEST_TIMEOUT_MS,
  RESULT_CODES,
} from '@/services/request/request.constants'
import type { ApiError, ResultDto } from '@/services/request/request.types'
import { sessionExpired } from '@/store/slices/authSlice'
import { uiFeedback } from '@/services/feedback/uiFeedback'

/**
 * 请求层文案统一经 i18next 单例翻译（key 即中文文案）。
 * 直接依赖 i18next 包而非 @/i18n/i18n 模块，避免 services ↔ i18n 循环导入；
 * i18n 尚未初始化时 t() 原样返回中文 key，与简体中文缺省语义一致。
 */
function tr(key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, options ?? {})
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

/** 提取可展示的错误文案（后端 message 优先）；取消类错误返回空串 */
export function apiErrorMessage(error: unknown): string {
  const api = toApiError(error)
  if (api.code === CLIENT_ERROR_CODES.CANCELLED) return ''
  return api.detail || api.title
}

/** 是否为主动取消（切换页签 / 刷新页签导致），调用方据此跳过报错提示 */
export function isCancelledError(error: unknown): boolean {
  return toApiError(error).code === CLIENT_ERROR_CODES.CANCELLED
}

function fail(api: ApiError): never {
  throw new ApiRequestError(api)
}

function fromAxiosError(error: AxiosError): ApiError {
  if (error.code === 'ERR_CANCELED' || axios.isCancel(error)) {
    return { isApiError: true, code: CLIENT_ERROR_CODES.CANCELLED, status: 0, title: tr('请求已取消') }
  }
  const response = error.response
  if (!response) {
    return {
      isApiError: true,
      code: CLIENT_ERROR_CODES.NETWORK_ERROR,
      status: 0,
      title: tr('网络不可达，请检查连接或后端服务'),
    }
  }
  // HTTP 协议级错误体：优先提取后端 message 作为详情（body 可能是 Result 或纯文本）
  const body = (response.data ?? {}) as { message?: string; detail?: string }
  let dataText: string | undefined
  if (typeof response.data === 'string') dataText = response.data.slice(0, 200)
  return {
    isApiError: true,
    code: CLIENT_ERROR_CODES.UNKNOWN,
    status: response.status,
    title: tr('请求失败（HTTP {{status}}）', { status: response.status }),
    detail: body.message ?? body.detail ?? dataText,
  }
}

/* -------------------------------------------------------------------------- */
/* 令牌与请求语言（模块态）：由会话桥接与 i18n 治理写入                          */
/* -------------------------------------------------------------------------- */

let accessToken: string | null = null

/** 请求语言（Accept-Language 头取值）；随 i18n 语言变化同步，zh-CN 为缺省 */
let acceptLanguage: string = 'zh-CN'

/**
 * 会话失效已收敛标记：并发多个请求同时收到 1000000 时只处理一次，
 * 避免"重复通知 + 重定向风暴"（规格 4.2）；新令牌写入时复位。
 */
let sessionExpiryHandled = false

/**
 * 未激活引导已收敛标记（P02）：并发多个请求同时收到 1001000 时只提示/引导一次，
 * 与会话失效同款单飞收敛；新令牌（重新登录）写入时复位。
 */
let activationGuidanceHandled = false

export function setAccessToken(token: string | null): void {
  accessToken = token
  if (token !== null) {
    // 换取新令牌即新会话：允许下一次会话失效/未激活再次收敛提示
    sessionExpiryHandled = false
    activationGuidanceHandled = false
  }
}

/** i18n 语言变化时同步请求头语言（含上传通道；I07 待真实复核） */
export function setRequestLanguage(language: string): void {
  acceptLanguage = language
}

/* -------------------------------------------------------------------------- */
/* 请求健康状态（顶栏网络指示）                                                   */
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

/** 判定为登录自身的调用：登录失败与会话失效是两回事，不得触发过期收敛 */
function isAuthCall(config: InternalAxiosRequestConfig | undefined): boolean {
  return config?.url?.includes('/auth/authorize/login') === true
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`)
  config.headers.set('Accept-Language', acceptLanguage)
  return config
})

http.interceptors.response.use(
  (response) => {
    const contentType = String(response.headers?.['content-type'] ?? '')
    if (contentType.includes('text/html')) {
      // 代理目标返回 HTML（后端未启动、端口被其他应用占用等）：按不可达处理
      recordHealth(false)
      return fail({
        isApiError: true,
        code: CLIENT_ERROR_CODES.NETWORK_ERROR,
        status: response.status,
        title: tr('API 目标返回了 HTML 而非 JSON，请检查代理与后端服务'),
      })
    }
    if (!contentType.includes('json')) {
      // 文件/流通道：Blob、二进制等原样透传，绝不套 Result 解包（规格 4.2 文件行）
      recordHealth(true)
      return response.data
    }
    return unwrapResult(response.data as unknown)
  },
  (error: AxiosError) => handleRequestError(error),
)

/**
 * Result 解包：HTTP 成功仅代表传输层成功，业务成败以 code=200 判定。
 * 业务码非 200（含 1000000/1001000）绝不进入成功分支。
 */
function unwrapResult(payload: unknown): unknown {
  if (!isResultShape(payload)) {
    // HTTP 200 但响应体不是 Result 形状：协议异常，按畸形响应处理，不猜数据
    recordHealth(false)
    return fail({
      isApiError: true,
      code: CLIENT_ERROR_CODES.MALFORMED_RESPONSE,
      status: 200,
      title: tr('响应不符合调度协议（缺少 Result 包装）'),
    })
  }
  const result = payload as ResultDto<unknown>
  if (result.code === RESULT_CODES.SUCCESS) {
    recordHealth(true)
    return result.data
  }
  // 业务拒绝是后端真实可达的正常反馈，不计入"服务离线"
  recordHealth(true)
  if (result.code === RESULT_CODES.SESSION_EXPIRED) {
    handleSessionExpired()
    return fail({
      isApiError: true,
      code: `BIZ.${result.code}`,
      status: 200,
      businessCode: result.code,
      title: tr('登录已过期，请重新登录'),
      detail: result.message,
    })
  }
  if (result.code === RESULT_CODES.UNAUTHORIZED) {
    // 系统未被激活（1001000，真实环境实证）：单飞提示并引导至授权页；
    // 授权页自身的请求不再引导（页面自行展示后端信息），避免循环
    handleActivationRequired()
  }
  return fail({
    isApiError: true,
    code: `BIZ.${result.code}`,
    status: 200,
    businessCode: result.code,
    title: result.message || tr('业务处理失败（code={{code}}）', { code: result.code }),
  })
}

/** Result 形状判定：对象且 code 为 number（message/timestamp/data 允许缺省容错） */
function isResultShape(payload: unknown): payload is ResultDto<unknown> {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    !Array.isArray(payload) &&
    typeof (payload as { code?: unknown }).code === 'number'
  )
}

async function handleRequestError(error: AxiosError): Promise<never> {
  const canceled = error.code === 'ERR_CANCELED' || axios.isCancel(error)
  const responded = Boolean(error.response)
  const responseStatus = error.response?.status ?? 0
  const responseJson =
    String(error.response?.headers?.['content-type'] ?? '').includes('json') ||
    // Vite 代理上游不可达时返回 502 text/plain：DEV 下视同网关错误
    (import.meta.env.DEV === false && responseStatus >= 500)
  // HTML 响应 / DEV 下网关级非 JSON 5xx / 无响应：视同未触达真实后端
  const unreachable =
    !responded ||
    error.code === 'APEX_HTML_RESPONSE' ||
    (import.meta.env.DEV && responseStatus >= 500 && !responseJson)

  // 主动取消不参与健康统计，也不产生可展示错误（调用方以 isCancelledError 静默）
  if (canceled) {
    return fail({
      isApiError: true,
      code: CLIENT_ERROR_CODES.CANCELLED,
      status: 0,
      title: tr('请求已取消'),
    })
  }
  recordHealth(responded && error.code !== 'APEX_HTML_RESPONSE' && !unreachable)
  if (isAuthCall(error.config)) {
    // 登录自身失败：保持原始状态码与后端信息，不做会话收敛
    fail(fromAxiosError(error))
  }
  // 后端实际以 HTTP 200 + 业务码 1000000 表达会话失效（真实环境已实证）；
  // 若未来出现 HTTP 401，同样按会话失效收敛，且一律不自动重放请求（G01/G02）
  if (responseStatus === 401) {
    handleSessionExpired()
    fail({
      isApiError: true,
      code: `BIZ.${RESULT_CODES.SESSION_EXPIRED}`,
      status: 401,
      businessCode: RESULT_CODES.SESSION_EXPIRED,
      title: tr('登录已过期，请重新登录'),
    })
  }
  fail(fromAxiosError(error))
}

/* -------------------------------------------------------------------------- */
/* 会话失效收敛（单飞）：清令牌 → 一次性提示 → 派发过期 → 外壳跳登录              */
/* -------------------------------------------------------------------------- */

function handleSessionExpired(): void {
  if (sessionExpiryHandled) return
  sessionExpiryHandled = true
  setAccessToken(null)
  // 一次性可见反馈：并发失效不再重复弹（单飞标记已拦截后续调用）
  uiFeedback.message.warning(tr('登录已过期，请重新登录'))
  // 动态引入避免模块初始化环；派发后由 BasicLayout 的会话守卫统一跳登录页
  import('@/store/store').then(({ store }) => {
    store.dispatch(sessionExpired())
  })
}

/**
 * 未激活引导收敛（P02）：业务码 1001000 时一次性提示并派发引导事件，
 * 由 App 根常驻的 ActivationRedirectListener 监听并 SPA 导航到授权页。
 * 不在此直接操作路由（请求层保持非 React、不依赖具体路由实例）；
 * 与会话失效一致采用单飞标记，新令牌写入时复位（重新登录后可再次引导）。
 */
function handleActivationRequired(): void {
  // 授权页自身的请求触发 1001000 时不提示不引导：页面已在处理激活流程
  if (window.location.pathname === ROUTE_PATHS['authorize-ingress']) return
  if (activationGuidanceHandled) return
  activationGuidanceHandled = true
  uiFeedback.message.warning(tr('系统尚未激活，请先完成软件授权'))
  window.dispatchEvent(new CustomEvent(ACTIVATION_REQUIRED_EVENT))
}

/* -------------------------------------------------------------------------- */
/* 类型一致的轻封装：拦截器已完成 Result 解包与错误收敛，此处仅纠正返回类型        */
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
