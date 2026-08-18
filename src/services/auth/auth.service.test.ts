/**
 * 认证六接口测试（规格 §6.3/§7.1）：
 * 每个接口经 request<T>() 完成类型解包；login/refresh/logout 固定 skipAuthRefresh；
 * 请求方法、路径、请求体与请求扩展配置逐一断言；失败 envelope 转 ApiError。
 * 经 configureRequestAdapter 注入 mock adapter 走默认请求运行时（与生产路径一致）。
 */
import type { InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_ERROR_CODES, GLOBAL_REQUEST_SCOPE } from '@/constants/request.constants'
import { registerUiFeedbackInstances, resetUiFeedbackInstances } from '@/services/feedback/uiFeedback'
import type { UiFeedbackInstances } from '@/services/feedback/uiFeedback'
import { configureRequestAdapter } from '@/services/request/request'
import { createApiError } from '@/services/request/envelope'
import {
  createMockAdapter,
  failureEnvelope,
  successEnvelope,
  userFixture,
  type MockAdapter,
} from '@/test/requestTestHelpers'
import {
  changePassword,
  getProfile,
  login,
  loginViaTransport,
  logout,
  refreshTokens,
  registerLoginTransportExtension,
  updateProfile,
  type LoginTransportExtension,
} from './auth.service'

const profileFixture = {
  user: userFixture,
  roleCodes: ['viewer'],
  permCodes: ['dashboard:view'],
  permissionVersion: 'v1',
}

let adapter: MockAdapter
let messageError: ReturnType<typeof vi.fn>

beforeEach(() => {
  adapter = createMockAdapter()
  configureRequestAdapter(() => adapter.adapter)
  messageError = vi.fn()
  registerUiFeedbackInstances({ message: { error: messageError } } as unknown as UiFeedbackInstances)
})

afterEach(() => {
  configureRequestAdapter(null)
  resetUiFeedbackInstances()
  window.localStorage.clear()
})

/** 取第一个（也是唯一一个）被记录的请求配置 */
function firstCall(): InternalAxiosRequestConfig {
  expect(adapter.calls.length).toBe(1)
  return adapter.calls[0]
}

/** 读取请求体：adapter 层收到的 data 已由 axios 序列化为 JSON 字符串 */
function requestBody(config: InternalAxiosRequestConfig): unknown {
  return typeof config.data === 'string' ? JSON.parse(config.data) : config.data
}

describe('POST /auth/login（规格 §6.3）', () => {
  it('解包 envelope data 并固定 skipAuthRefresh/skipAuthHeader/silent', async () => {
    const data = { accessToken: 'at-1', refreshToken: 'rt-1', user: userFixture }
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(data) }))
    await expect(login({ username: 'admin', password: 'secret' })).resolves.toEqual(data)
    const config = firstCall()
    expect(config.url).toBe('/auth/login')
    expect(config.method).toBe('post')
    expect(requestBody(config)).toEqual({ username: 'admin', password: 'secret' })
    expect(config.skipAuthRefresh).toBe(true)
    expect(config.skipAuthHeader).toBe(true)
    expect(config.silent).toBe(true)
  })

  it('AUTH_INVALID_CREDENTIALS 转为 ApiError 且不触发全局提示（silent）', async () => {
    adapter.respondWith(() => ({
      status: 401,
      data: failureEnvelope(1001, API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, '凭证错误'),
    }))
    const error = await login({ username: 'admin', password: 'wrong' }).catch((e) => e)
    expect(error).toMatchObject({
      name: 'ApiError',
      httpStatus: 401,
      errorCode: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    })
    expect(messageError).not.toHaveBeenCalled()
  })
})

describe('POST /auth/refresh（规格 §6.3）', () => {
  it('返回旋转后的双 token，固定 skipAuthRefresh/skipAuthHeader', async () => {
    const data = { accessToken: 'at-2', refreshToken: 'rt-2' }
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(data) }))
    await expect(refreshTokens({ refreshToken: 'rt-1' })).resolves.toEqual(data)
    const config = firstCall()
    expect(config.url).toBe('/auth/refresh')
    expect(config.method).toBe('post')
    expect(requestBody(config)).toEqual({ refreshToken: 'rt-1' })
    expect(config.skipAuthRefresh).toBe(true)
    expect(config.skipAuthHeader).toBe(true)
  })
})

describe('POST /auth/logout（规格 §6.3）', () => {
  it('data 为 null 仍按成功解包，固定 skipAuthRefresh 且 silent', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(null) }))
    await expect(logout({ refreshToken: 'rt-1' })).resolves.toBeNull()
    const config = firstCall()
    expect(config.url).toBe('/auth/logout')
    expect(config.method).toBe('post')
    expect(requestBody(config)).toEqual({ refreshToken: 'rt-1' })
    expect(config.skipAuthRefresh).toBe(true)
    expect(config.silent).toBe(true)
    expect(messageError).not.toHaveBeenCalled()
  })
})

describe('GET /auth/profile（规格 §6.3/§7.2/§7.4-6）', () => {
  it('解包 ProfileData，silent 且使用全局作用域', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(profileFixture) }))
    await expect(getProfile()).resolves.toEqual(profileFixture)
    const config = firstCall()
    expect(config.url).toBe('/auth/profile')
    expect(config.method).toBe('get')
    expect(config.silent).toBe(true)
    expect(config.scopeId).toBe(GLOBAL_REQUEST_SCOPE)
  })
})

describe('PUT /auth/profile（规格 §6.3/§14.3）', () => {
  it('提交资料编辑契约并解包 User', async () => {
    const dto = { displayName: '新名称', email: 'new@example.com', phone: '13800000000' }
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(userFixture) }))
    await expect(updateProfile(dto)).resolves.toEqual(userFixture)
    const config = firstCall()
    expect(config.url).toBe('/auth/profile')
    expect(config.method).toBe('put')
    expect(requestBody(config)).toEqual(dto)
  })
})

describe('PUT /auth/password（规格 §6.3/§14.3）', () => {
  it('提交新旧密码并解包 null', async () => {
    const dto = { oldPassword: 'old1234ab', newPassword: 'new5678cd' }
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(null) }))
    await expect(changePassword(dto)).resolves.toBeNull()
    const config = firstCall()
    expect(config.url).toBe('/auth/password')
    expect(config.method).toBe('put')
    expect(requestBody(config)).toEqual(dto)
  })
})

describe('登录传输扩展（规格 §13.2：off 构建不注册，登录保持纯真实通道）', () => {
  const dto = { username: 'admin', password: 'any' }

  afterEach(() => {
    registerLoginTransportExtension(null)
  })

  it('成功路径调用 normalizeSourceAfterRealLogin 并返回真实结果', async () => {
    const data = { accessToken: 'at-1', refreshToken: 'rt-1', user: userFixture }
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(data) }))
    const normalize = vi.fn()
    registerLoginTransportExtension({ normalizeSourceAfterRealLogin: normalize, replayViaDemoAfterNetworkFailure: vi.fn() })

    await expect(login(dto)).resolves.toEqual(data)
    expect(normalize).toHaveBeenCalledTimes(1)
  })

  it('失败被扩展重放接管时返回重放结果', async () => {
    adapter.respondWith(() => Promise.reject(new Error('Network Error')))
    const replayResult = { accessToken: 'demo-at', refreshToken: 'demo-rt', user: userFixture }
    const replay = vi.fn().mockResolvedValue(replayResult)
    registerLoginTransportExtension({ normalizeSourceAfterRealLogin: vi.fn(), replayViaDemoAfterNetworkFailure: replay })

    await expect(login(dto)).resolves.toEqual(replayResult)
    expect(replay).toHaveBeenCalledTimes(1)
    expect(replay.mock.calls[0][0]).toEqual(dto)
  })

  it('扩展返回 null（业务错误/取消/未启用）时原错误上抛', async () => {
    adapter.respondWith(() => ({
      status: 401,
      data: failureEnvelope(401, API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, '凭证错误'),
    }))
    const replay = vi.fn().mockResolvedValue(null)
    registerLoginTransportExtension({ normalizeSourceAfterRealLogin: vi.fn(), replayViaDemoAfterNetworkFailure: replay })

    await expect(login(dto)).rejects.toMatchObject({
      name: 'ApiError',
      errorCode: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    })
    expect(replay).toHaveBeenCalledTimes(1)
  })

  it('未注册扩展时失败原样上抛且不吞错误', async () => {
    adapter.respondWith(() => Promise.reject(createApiError({ message: '网络错误，请求未送达' })))
    registerLoginTransportExtension(null)
    await expect(login(dto)).rejects.toMatchObject({ name: 'ApiError', canceled: false })
  })

  it('loginViaTransport 是不含扩展编排的原始通道：成功不触发扩展', async () => {
    const data = { accessToken: 'at-2', refreshToken: 'rt-2', user: userFixture }
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(data) }))
    const extension: LoginTransportExtension = {
      normalizeSourceAfterRealLogin: vi.fn(),
      replayViaDemoAfterNetworkFailure: vi.fn(),
    }
    registerLoginTransportExtension(extension)

    await expect(loginViaTransport(dto)).resolves.toEqual(data)
    expect(extension.normalizeSourceAfterRealLogin).not.toHaveBeenCalled()
    expect(extension.replayViaDemoAfterNetworkFailure).not.toHaveBeenCalled()
  })
})
