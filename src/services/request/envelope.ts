/**
 * problem+json 解析与 ApiError 构造（规格 §7.1/§7.4，v1.14 对齐真实后端）：
 * 成功条件为 HTTP 2xx，响应体即资源 JSON 本体（无 envelope），空响应体归一为 null；
 * 失败统一为 RFC 9457 application/problem+json（稳定错误码在 code 字段），
 * 协议不合法、HTTP 错误、网络失败与全部取消统一转换为 ApiError。
 */
import axios, { AxiosError, type AxiosResponse } from 'axios'
import type { ApiError, ApiProblem } from './request.types'

/** 请求超时提示（axios 超时错误码 ECONNABORTED） */
export const REQUEST_TIMEOUT_MESSAGE = '请求超时，请稍后重试'

/** 网络错误提示：请求未送达服务器 */
export const REQUEST_NETWORK_MESSAGE = '网络错误，请求未送达'

/** 所有 abort 统一使用的取消提示；canceled 请求禁止弹全局错误提示 */
export const REQUEST_CANCELED_MESSAGE = '请求已取消'

/** 响应头中的请求追踪标识（规格 §7.1：优先使用 problem body 中的值） */
const REQUEST_ID_HEADER = 'x-request-id'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** ApiError 构造参数：message 必填，其余字段按证据提供 */
export interface ApiErrorInit {
  message: string
  httpStatus?: number
  errorCode?: ApiProblem['code']
  requestId?: string
  details?: unknown
  canceled?: boolean
}

/** 构造 ApiError：业务层唯一错误形状，name 固定为 ApiError 便于辨识 */
export function createApiError(init: ApiErrorInit): ApiError {
  const error = new Error(init.message) as ApiError
  error.name = 'ApiError'
  error.httpStatus = init.httpStatus
  error.errorCode = init.errorCode
  error.requestId = init.requestId
  error.details = init.details
  error.canceled = init.canceled ?? false
  return error
}

/** 类型守卫：判断未知异常是否为 ApiError */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof Error && value.name === 'ApiError' && typeof (value as ApiError).canceled === 'boolean'
}

/** 构造统一取消错误（规格 §7.4-9） */
export function createCanceledApiError(): ApiError {
  return createApiError({ message: REQUEST_CANCELED_MESSAGE, canceled: true })
}

/** 从 problem+json 对象读取失败字段；非 problem 形状（无字符串 code）返回 null */
function readProblemBody(body: unknown): Omit<ApiErrorInit, 'message' | 'httpStatus'> | null {
  if (!isRecord(body)) {
    return null
  }
  const errorCode = typeof body.code === 'string' ? body.code : undefined
  if (errorCode === undefined) {
    return null
  }
  return {
    errorCode: errorCode as ApiProblem['code'],
    requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    details: Array.isArray(body.errors) ? body.errors : undefined,
  }
}

/** 读取响应头中的 requestId（兼容 AxiosHeaders 与普通对象头） */
export function readRequestIdHeader(headers: unknown): string | undefined {
  if (headers !== null && typeof headers === 'object') {
    const getter = (headers as { get?: (name: string) => unknown }).get
    if (typeof getter === 'function') {
      const value = getter.call(headers, REQUEST_ID_HEADER)
      return typeof value === 'string' && value.length > 0 ? value : undefined
    }
    const raw = (headers as Record<string, unknown>)[REQUEST_ID_HEADER]
    return typeof raw === 'string' && raw.length > 0 ? raw : undefined
  }
  return undefined
}

/**
 * 成功响应解包（HTTP 2xx，规格 §7.1 v1.14）：
 * 响应体即资源 JSON 本体，原样返回；204 等空响应体（'' / null / undefined）归一为 null。
 * 文件流（blob/arraybuffer）同为原样返回，不再单列分支。
 */
export function unwrapSuccessResponse(response: AxiosResponse): unknown {
  const { data: body } = response
  if (body === undefined || body === null || body === '') {
    return null
  }
  return body
}

/** 跨 realm 识别 ArrayBuffer（Object.prototype.toString 读取内部槽，不受构造器 realm 影响） */
function isArrayBufferLike(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]'
}

/** 尽力解析错误响应体中的 problem+json：Blob/ArrayBuffer 先解码文本再 JSON 解析（文件下载失败仍返回 problem JSON） */
async function parseErrorBody(data: unknown): Promise<Omit<ApiErrorInit, 'message' | 'httpStatus'> | null> {
  let body: unknown = data
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      body = JSON.parse(await body.text())
    } catch {
      return null
    }
  } else if (isArrayBufferLike(body) || ArrayBuffer.isView(body)) {
    try {
      // TextDecoder 接受 ArrayBuffer 与 TypedArray 视图
      body = JSON.parse(new TextDecoder().decode(body as BufferSource))
    } catch {
      return null
    }
  }
  return readProblemBody(body)
}

/**
 * 把 AxiosError 转换为 ApiError：
 * - 全部取消（含页签作用域 abort、重复 GET 取消、调用方 signal）→ canceled: true；
 * - 收到 HTTP 错误响应 → 解析 problem+json，取 httpStatus/errorCode/requestId/errors；
 * - 网络失败/超时 → 无 httpStatus 的 ApiError。
 */
export async function axiosErrorToApiError(error: AxiosError): Promise<ApiError> {
  if (axios.isCancel(error)) {
    return createCanceledApiError()
  }
  const response = error.response
  if (response) {
    const problem = await parseErrorBody(response.data)
    if (problem) {
      const rawDetail = isRecord(response.data) && typeof response.data.detail === 'string' ? response.data.detail : ''
      return createApiError({
        httpStatus: response.status,
        ...problem,
        requestId: problem.requestId ?? readRequestIdHeader(response.headers),
        message: rawDetail.length > 0 ? rawDetail : `请求失败（HTTP ${response.status}）`,
      })
    }
    return createApiError({
      httpStatus: response.status,
      requestId: readRequestIdHeader(response.headers),
      message: `请求失败（HTTP ${response.status}）`,
    })
  }
  if (error.code === 'ECONNABORTED') {
    return createApiError({ message: REQUEST_TIMEOUT_MESSAGE })
  }
  return createApiError({ message: REQUEST_NETWORK_MESSAGE })
}

/** 把任意未知异常归一为 ApiError（refresh 编排等内部边界使用） */
export function coerceApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error
  }
  if (error instanceof AxiosError) {
    // 同步路径仅覆盖已收到响应/取消的形态；其余按网络错误归一
    if (axios.isCancel(error)) {
      return createCanceledApiError()
    }
    const status = error.response?.status
    return createApiError({
      httpStatus: status,
      message: status !== undefined ? `请求失败（HTTP ${status}）` : REQUEST_NETWORK_MESSAGE,
    })
  }
  return createApiError({ message: error instanceof Error ? error.message : String(error) })
}
