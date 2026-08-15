/**
 * envelope 解析与 ApiError 构造单元测试（规格 §7.1/§7.4）：
 * 成功解包、协议错误、文件流豁免、错误响应体解析（含 Blob/ArrayBuffer）、
 * requestId 头兜底与 coerceApiError 归一。
 */
import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders, CanceledError, type AxiosResponse } from 'axios'
import {
  axiosErrorToApiError,
  coerceApiError,
  createApiError,
  createCanceledApiError,
  isApiError,
  readRequestIdHeader,
  unwrapSuccessResponse,
} from './envelope'

/** 构造最小 AxiosResponse */
function buildResponse(data: unknown, status = 200, responseType?: string, headers?: unknown): AxiosResponse {
  return {
    data,
    status,
    statusText: '',
    headers: (headers ?? {}) as AxiosResponse['headers'],
    config: responseType ? ({ responseType } as AxiosResponse['config']) : ({} as AxiosResponse['config']),
    request: {},
  }
}

describe('createApiError / isApiError / createCanceledApiError', () => {
  it('构造 ApiError：默认非取消，字段按证据落位', () => {
    const error = createApiError({
      message: '业务失败',
      httpStatus: 403,
      code: 40301,
      errorCode: 'AUTH_FORBIDDEN',
      requestId: 'r-1',
      details: { field: 'user' },
    })
    expect(error.name).toBe('ApiError')
    expect(error.canceled).toBe(false)
    expect(error.httpStatus).toBe(403)
    expect(error.code).toBe(40301)
    expect(error.errorCode).toBe('AUTH_FORBIDDEN')
    expect(error.requestId).toBe('r-1')
    expect(error.details).toEqual({ field: 'user' })
    expect(isApiError(error)).toBe(true)
  })

  it('isApiError 对普通 Error 与字符串返回 false', () => {
    expect(isApiError(new Error('普通错误'))).toBe(false)
    expect(isApiError('字符串')).toBe(false)
    expect(isApiError(null)).toBe(false)
  })

  it('createCanceledApiError 固定 canceled: true', () => {
    const error = createCanceledApiError()
    expect(error.canceled).toBe(true)
    expect(error.message).toBe('请求已取消')
  })
})

describe('unwrapSuccessResponse', () => {
  it('code===0 且 data 键存在时解包 data（含 data:null）', () => {
    expect(unwrapSuccessResponse(buildResponse({ code: 0, message: 'ok', data: { a: 1 } }))).toEqual({ a: 1 })
    expect(unwrapSuccessResponse(buildResponse({ code: 0, message: 'ok', data: null }))).toBeNull()
  })

  it('blob/arraybuffer 文件流豁免 envelope，原样返回', () => {
    const blob = new Blob(['x'])
    expect(unwrapSuccessResponse(buildResponse(blob, 200, 'blob'))).toBe(blob)
    const buffer = new ArrayBuffer(4)
    expect(unwrapSuccessResponse(buildResponse(buffer, 200, 'arraybuffer'))).toBe(buffer)
  })

  it('code!==0 的失败 envelope 转为携带全部证据的 ApiError', () => {
    let thrown: unknown
    try {
      unwrapSuccessResponse(
        buildResponse({ code: 1001, message: '参数缺失', data: null, errorCode: 'VALIDATION_FAILED', requestId: 'r-2' }),
      )
    } catch (error) {
      thrown = error
    }
    expect(thrown).toMatchObject({
      name: 'ApiError',
      httpStatus: 200,
      code: 1001,
      errorCode: 'VALIDATION_FAILED',
      requestId: 'r-2',
      message: '参数缺失',
    })
    // envelope message 缺失时使用兜底文案，不抛出 undefined
    try {
      unwrapSuccessResponse(buildResponse({ code: 7, data: null, errorCode: 'INTERNAL_ERROR' }))
    } catch (error) {
      thrown = error
    }
    expect(thrown).toMatchObject({ message: '业务失败（code 7）' })
  })

  it('协议不合法（非对象、缺 code/errorCode、code 0 缺 data）转协议 ApiError', () => {
    const invalid = (data: unknown) => {
      try {
        unwrapSuccessResponse(buildResponse(data))
        return null
      } catch (error) {
        return error as ReturnType<typeof createApiError>
      }
    }
    expect(invalid('string-body')).toMatchObject({ name: 'ApiError', httpStatus: 200 })
    expect(invalid({ message: 'no-code' })?.message).toBe('接口响应协议不合法')
    expect(invalid({ code: 1001, message: '缺 errorCode' })?.message).toBe('接口响应协议不合法')
    expect(invalid({ code: 0, message: '缺 data' })?.message).toBe('接口响应协议不合法')
    // code===200 的旧协议不再兼容
    expect(invalid({ code: 200, message: '旧协议', data: {} })?.message).toBe('接口响应协议不合法')
  })
})

describe('readRequestIdHeader', () => {
  it('优先读取 AxiosHeaders.get；普通对象按下标读取', () => {
    const headers = new AxiosHeaders({ 'x-request-id': 'hdr-1' })
    expect(readRequestIdHeader(headers)).toBe('hdr-1')
    expect(readRequestIdHeader({ 'x-request-id': 'hdr-2' })).toBe('hdr-2')
  })

  it('缺失、空串或非字符串返回 undefined；null 头安全返回', () => {
    expect(readRequestIdHeader(new AxiosHeaders())).toBeUndefined()
    expect(readRequestIdHeader({})).toBeUndefined()
    expect(readRequestIdHeader({ 'x-request-id': '' })).toBeUndefined()
    expect(readRequestIdHeader({ 'x-request-id': 123 })).toBeUndefined()
    expect(readRequestIdHeader(null)).toBeUndefined()
  })
})

describe('axiosErrorToApiError', () => {
  it('取消错误（CanceledError）统一转 canceled ApiError', async () => {
    const canceled = new CanceledError('canceled')
    const apiError = await axiosErrorToApiError(canceled as AxiosError)
    expect(apiError.canceled).toBe(true)
  })

  it('JSON 错误响应解析失败 envelope；envelope requestId 优先于响应头', async () => {
    const response = buildResponse(
      { code: 500, message: '服务器错误', data: null, errorCode: 'INTERNAL_ERROR', requestId: 'env-1' },
      500,
      undefined,
      { 'x-request-id': 'hdr-x' },
    )
    const error = new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, {} as never, {}, response)
    const apiError = await axiosErrorToApiError(error)
    expect(apiError).toMatchObject({
      httpStatus: 500,
      code: 500,
      errorCode: 'INTERNAL_ERROR',
      requestId: 'env-1',
      message: '服务器错误',
    })
  })

  it('无 requestId 的失败 envelope 回退响应头；非 envelope 响应体只保留 httpStatus', async () => {
    const withHeader = new AxiosError('failed', 'ERR', {} as never, {}, buildResponse({ code: 500, message: 'x', data: null, errorCode: 'INTERNAL_ERROR' }, 500, undefined, { 'x-request-id': 'hdr-only' }))
    expect((await axiosErrorToApiError(withHeader)).requestId).toBe('hdr-only')

    const garbage = new AxiosError('failed', 'ERR', {} as never, {}, buildResponse('garbage', 502, undefined, { 'x-request-id': 'hdr-502' }))
    await expect(axiosErrorToApiError(garbage)).resolves.toMatchObject({ httpStatus: 502, requestId: 'hdr-502' })
  })

  it('文件流错误响应体（Blob/ArrayBuffer）尽力解析出失败 envelope（规格 §7.1）', async () => {
    const blob = new Blob([JSON.stringify({ code: 403, message: '无权限', data: null, errorCode: 'AUTH_FORBIDDEN' })], {
      type: 'application/json',
    })
    const blobError = new AxiosError('failed', 'ERR', {} as never, {}, buildResponse(blob, 403, 'blob'))
    await expect(axiosErrorToApiError(blobError)).resolves.toMatchObject({
      httpStatus: 403,
      errorCode: 'AUTH_FORBIDDEN',
    })

    const buffer = new TextEncoder().encode(JSON.stringify({ code: 403, message: '无权限', data: null, errorCode: 'AUTH_FORBIDDEN' }))
    const bufferError = new AxiosError('failed', 'ERR', {} as never, {}, buildResponse(buffer.buffer, 403, 'arraybuffer'))
    await expect(axiosErrorToApiError(bufferError)).resolves.toMatchObject({ errorCode: 'AUTH_FORBIDDEN' })

    // 解析失败的非 JSON Blob 回退为纯 httpStatus 错误
    const badBlob = new Blob(['not-json'], { type: 'text/plain' })
    const badError = new AxiosError('failed', 'ERR', {} as never, {}, buildResponse(badBlob, 500, 'blob'))
    await expect(axiosErrorToApiError(badError)).resolves.toMatchObject({ httpStatus: 500 })
  })

  it('无响应时按超时/网络错误归一', async () => {
    const timeout = new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED')
    await expect(axiosErrorToApiError(timeout)).resolves.toMatchObject({ message: '请求超时，请稍后重试' })
    const network = new AxiosError('Network Error', 'ERR_NETWORK')
    await expect(axiosErrorToApiError(network)).resolves.toMatchObject({ message: '网络错误，请求未送达' })
  })
})

describe('coerceApiError', () => {
  it('ApiError 原样返回；AxiosError 归一；其他值转字符串消息', () => {
    const apiError = createApiError({ message: 'x' })
    expect(coerceApiError(apiError)).toBe(apiError)
    expect(coerceApiError(new CanceledError('canceled'))).toMatchObject({ canceled: true })
    const withResponse = new AxiosError('failed', 'ERR', {} as never, {}, buildResponse('x', 404))
    expect(coerceApiError(withResponse)).toMatchObject({ httpStatus: 404 })
    const noResponse = new AxiosError('Network Error', 'ERR_NETWORK')
    expect(coerceApiError(noResponse)).toMatchObject({ message: '网络错误，请求未送达' })
    expect(coerceApiError(new Error('boom'))).toMatchObject({ message: 'boom' })
    expect(coerceApiError('raw-string')).toMatchObject({ message: 'raw-string' })
  })
})
