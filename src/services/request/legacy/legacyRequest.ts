/**
 * 旧调度后端（/fms、/rcsFlow）请求通道：唯一 axios 实例 + 信封解包 + 事件分发。
 *
 * 与 /api/v1 新协议通道（../request.ts）的关系：
 * - 两通道并存，各自独立实例；旧协议不做任何刷新令牌或失败重放，
 *   写请求与查询一律单次发送（SPEC §6.3），业务接口由后续任务按合同接入。
 * - 旧协议路径自带 /fms、/rcsFlow 前缀，baseURL 留空，绝不前置 /api/v1。
 * - 认证失效（1000000）/授权缺失（1001000）只发事件，不在此做路由跳转；
 *   会话与授权编排由 T005/T015 消费本事件接口实现。
 */

import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
  type Method,
} from 'axios'
import i18next from 'i18next'
import { toApiError } from '@/services/request/request'
import type { ApiError } from '@/services/request/request.types'
import {
  LEGACY_ERROR_CODES,
  type LegacyDownloadOptions,
  type LegacyDownloadResult,
  type LegacyEventListener,
  type LegacyRequestEvent,
  type LegacyRequestOptions,
} from '@/services/request/legacy/legacy.types'
import {
  buildAuthorizationHeader,
  describeLegacyFailure,
  isLegacyEnvelope,
  isLegacySuccess,
  parseDispositionFilename,
  sniffLegacyErrorBlob,
} from '@/services/request/legacy/legacyProtocol'

/** 旧协议 JSON 请求默认超时；旧系统实际为 1 小时不超时，迁移收紧为 15 秒，可按调用覆盖 */
export const LEGACY_JSON_TIMEOUT_MS = 15_000

/** 旧协议二进制下载默认超时；导出/下载可能超过 JSON 默认值，不与 15 秒共用 */
export const LEGACY_DOWNLOAD_TIMEOUT_MS = 60_000

/* -------------------------------------------------------------------------- */
/* 旧协议 token 持有（传输层头部来源；会话状态归 T005 唯一身份模型，不在此存储）      */
/* -------------------------------------------------------------------------- */

let legacyToken: string | null = null

/** T005 身份层登录/恢复/失效时调用；null 表示未登录，请求不携带 Authorization */
export function setLegacyToken(token: string | null): void {
  legacyToken = token
}

/* -------------------------------------------------------------------------- */
/* 事件总线：认证失效 / 授权缺失 / 请求错误                                        */
/* -------------------------------------------------------------------------- */

const legacyEventListeners = new Set<LegacyEventListener>()

/** 订阅旧协议请求事件；返回取消订阅函数。T005/T015/T017 据此编排会话与提示 */
export function subscribeLegacyEvents(listener: LegacyEventListener): () => void {
  legacyEventListeners.add(listener)
  return () => {
    legacyEventListeners.delete(listener)
  }
}

function emitLegacyEvent(event: LegacyRequestEvent): void {
  for (const listener of legacyEventListeners) listener(event)
}

/**
 * 重复错误去重器：同一 code+message 在窗口期内只放行一次（SPEC §6.1）。
 * 返回 true 表示该错误应提示。提示层（页面/弹窗）调用，事件本身不去重，
 * 避免掩盖需要逐条记录的合同证据。
 */
export function createLegacyErrorDeduper(windowMs = 1_500) {
  let lastKey = ''
  let lastAt = 0
  return (error: ApiError): boolean => {
    const key = `${error.code}|${error.bizCode ?? ''}|${error.bizMessage ?? ''}|${error.title}`
    const now = Date.now()
    if (key === lastKey && now - lastAt < windowMs) return false
    lastKey = key
    lastAt = now
    return true
  }
}

/* -------------------------------------------------------------------------- */
/* axios 实例：baseURL 留空（路径自带 /fms、/rcsFlow），携带凭据与源行为一致          */
/* -------------------------------------------------------------------------- */

const legacyHttp = axios.create({
  // 不设 baseURL：旧接口路径以 /fms、/rcsFlow 开头，由 dev 代理或网关路由
  timeout: LEGACY_JSON_TIMEOUT_MS,
  withCredentials: true,
})

legacyHttp.interceptors.request.use((config) => {
  // Authorization 最终只含一份 Bearer 前缀（SPEC §6.2），组装规则见纯函数
  const authorization = buildAuthorizationHeader(legacyToken)
  if (authorization) config.headers.set('Authorization', authorization)
  // 请求携带当前语言（SPEC §6.2）：i18next 为全局单例，T016 五语切换后自动生效
  config.headers.set('Accept-Language', i18next.language || 'zh-CN')
  return config
})

/* -------------------------------------------------------------------------- */
/* 信封解包与错误规范化                                                           */
/* -------------------------------------------------------------------------- */

/** 非认证/授权的业务失败是否已作为事件外发（1000000/1001000 有专属事件，不重复发 request-error） */
function emitErrorEvent(
  error: ApiError,
  url: string | undefined,
  method: string | undefined,
): void {
  if (error.code === 'CLIENT.CANCELLED') return
  if (
    error.code === LEGACY_ERROR_CODES.SESSION_EXPIRED ||
    error.code === LEGACY_ERROR_CODES.SOFTWARE_UNAUTHORIZED
  ) {
    emitLegacyEvent({ type: error.code === LEGACY_ERROR_CODES.SESSION_EXPIRED ? 'session-expired' : 'authorization-required', error, url, method })
    return
  }
  emitLegacyEvent({ type: 'request-error', error, url, method })
}

/**
 * 解包旧协议信封：成功返回 data；失败抛 ApiError（含 bizCode/bizMessage 原文）。
 * 信封形状不合法（代理回退 HTML、网关错误页）按 MALFORMED_RESPONSE 处理，
 * 避免对 undefined.code 取值产生难排查的 TypeError。
 */
function unwrapLegacyEnvelope(
  raw: unknown,
  url: string | undefined,
  method: string | undefined,
): unknown {
  if (!isLegacyEnvelope(raw)) {
    const error: ApiError = {
      isApiError: true,
      code: LEGACY_ERROR_CODES.MALFORMED_RESPONSE,
      status: 200,
      title: '接口响应不是有效的旧协议数据',
      detail: url,
    }
    emitErrorEvent(error, url, method)
    throw error
  }
  if (isLegacySuccess(raw)) return raw.data
  const error = describeLegacyFailure(raw.code, raw.message)
  emitErrorEvent(error, url, method)
  throw error
}

/** 统一收口：axios 层错误转 ApiError；信封错误保持原样；事件只发一次 */
function normalizeLegacyError(
  error: unknown,
  url: string | undefined,
  method: string | undefined,
): ApiError {
  // 信封失败/形状错误已在 unwrap 中发过事件，直接透传
  if (
    error !== null &&
    typeof error === 'object' &&
    (error as ApiError).isApiError === true
  ) {
    return error as ApiError
  }
  const api = toApiError(error)
  emitErrorEvent(api, url, method)
  return api
}

/* -------------------------------------------------------------------------- */
/* 类型一致的旧协议调用入口                                                       */
/* -------------------------------------------------------------------------- */

interface LegacyCallOptions extends LegacyRequestOptions {
  data?: unknown
  params?: Record<string, unknown>
}

async function legacyCall<T>(
  method: Method,
  url: string,
  options: LegacyCallOptions = {},
): Promise<T> {
  const config: AxiosRequestConfig = {
    method,
    url,
    params: options.params,
    data: options.data,
    signal: options.signal,
    timeout: options.timeoutMs,
    headers: options.headers,
  }
  try {
    const response = await legacyHttp.request(config)
    // 旧实例没有收敛拦截器，信封在响应体 data 字段，需显式取出一层
    const raw: unknown = response.data
    return (await unwrapLegacyEnvelope(raw, url, method)) as T
  } catch (error) {
    throw normalizeLegacyError(error, url, method)
  }
}

/** GET：params 进 query；信封解包后返回 data */
export function legacyGet<T>(
  url: string,
  params?: Record<string, unknown>,
  options?: LegacyRequestOptions,
): Promise<T> {
  return legacyCall<T>('GET', url, { ...options, params })
}

/** POST：data 进 body；旧系统删除等写操作也是 POST，方法与地址按合同保留 */
export function legacyPost<T>(
  url: string,
  data?: unknown,
  options?: LegacyRequestOptions,
): Promise<T> {
  return legacyCall<T>('POST', url, { ...options, data })
}

/** PUT：data 进 body（如 uploadSystemImage 走 typed 方法时复用，multipart 由调用方组 FormData） */
export function legacyPut<T>(
  url: string,
  data?: unknown,
  options?: LegacyRequestOptions,
): Promise<T> {
  return legacyCall<T>('PUT', url, { ...options, data })
}

/* -------------------------------------------------------------------------- */
/* 二进制下载：读入内存返回 blob + 文件名；JSON 业务错误不落为损坏文件               */
/* -------------------------------------------------------------------------- */

/**
 * 二进制下载（内存态）：保留响应头与文件名（SPEC §10.2）。
 * - 响应为 JSON 业务错误（含 content-type 误标为二进制的情况）时解析信封并抛错，
 *   调用方拿不到 blob，不会把错误报文保存成损坏文件。
 * - 大文件受浏览器内存限制，本方法不做流式；能走原生下载的接口优先原生移交
 *   （见 nativeDownload 与合同说明）。
 * - 下载鉴权：与 JSON 请求同一 Authorization 头，不得改裸 a 链接（SPEC §10.2）。
 */
export async function downloadBinary(
  url: string,
  options: LegacyDownloadOptions = {},
): Promise<LegacyDownloadResult> {
  const method = options.method ?? 'GET'
  const config: AxiosRequestConfig = {
    method,
    url,
    params: options.params,
    data: options.data,
    signal: options.signal,
    responseType: 'blob',
    timeout: options.timeoutMs ?? LEGACY_DOWNLOAD_TIMEOUT_MS,
  }
  try {
    const response = await legacyHttp.request<Blob>(config)
    const blob = response.data
    const contentType = headerValue(response.headers, 'content-type') ?? ''
    // 二进制响应可能是 JSON 业务错误（SPEC §6.1）：不区分 content-type 是否标注，
    // 一律嗅探前部字节——既覆盖标注 json 的错误，也覆盖误标为二进制的错误报文
    const envelopeFromHead = await sniffLegacyErrorBlob(blob)
    if (envelopeFromHead) {
      if (isLegacySuccess(envelopeFromHead)) {
        // 理论上不应出现（成功响应不会是 JSON 对象），防御性按形状错误处理
        throw {
          isApiError: true,
          code: LEGACY_ERROR_CODES.MALFORMED_RESPONSE,
          status: response.status,
          title: '下载响应内容不是有效文件',
          detail: url,
        } satisfies ApiError
      }
      throw describeLegacyFailure(envelopeFromHead.code, envelopeFromHead.message, response.status)
    }
    return {
      blob,
      filename: parseDispositionFilename(headerValue(response.headers, 'content-disposition')),
      contentType,
      status: response.status,
    }
  } catch (error) {
    throw normalizeLegacyError(error, url, method)
  }
}

/** 读取响应头为单值字符串（axios 头值可能为数组/数值，统一转字符串） */
function headerValue(
  headers: AxiosResponse['headers'] | undefined,
  name: string,
): string | undefined {
  const value: unknown = headers?.[name]
  if (value === undefined || value === null) return undefined
  return Array.isArray(value) ? value.join('; ') : String(value)
}

/**
 * 原生移交下载（SPEC §10.2）：不经过 Authorization 头的 GET 下载才可使用
 * （同源 Cookie 随请求自动携带）。触发后仅代表“已开始下载”，前端无法感知
 * 完成与失败，也不能取消浏览器下载；需要鉴权头的接口必须走 downloadBinary。
 */
export function nativeDownload(url: string, params?: Record<string, unknown>): void {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    // undefined/null 不入参；数组按旧接口习惯以逗号拼接由调用方自行决定，这里逐项展开
    if (value === undefined || value === null) continue
    search.set(key, String(value))
  }
  const query = search.toString()
  const anchor = document.createElement('a')
  anchor.href = query ? `${url}?${query}` : url
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}
