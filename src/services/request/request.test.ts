/**
 * axios 请求封装集成测试（规格 §6.2/§7.4/§17.4/§17.5/§17.12/§17.24/§17.25）：
 * envelope 解包与协议错误、认证头、401 刷新单飞与一次重放（epoch/abort 防护）、
 * refresh 失败一次会话清理、403 三类语义、重复 GET 取消、页签作用域取消、全局进度计数。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { API_ERROR_CODES, GLOBAL_REQUEST_SCOPE, REQUEST_TIMEOUT_MS } from '@/constants/request.constants'
import { registerUiFeedbackInstances, resetUiFeedbackInstances } from '@/services/feedback/uiFeedback'
import type { UiFeedbackInstances } from '@/services/feedback/uiFeedback'
import { registerProfileRefreshFetcher } from '@/services/request/profileRefresh'
import { abortRequestScope } from '@/services/request/requestScope'
import { configureRequestAdapter, createRequestRuntime, type RequestRuntime } from '@/services/request/request'
import type { RequestStore } from '@/services/request/request.types'
import { registerSessionExpiredNavigator } from '@/services/request/sessionCleanup'
import { cacheEntryTouched } from '@/store/slices/pageCache.slice'
import { tabOpened } from '@/store/slices/tabs.slice'
import { profileLoaded } from '@/store/slices/user.slice'
import {
  createMockAdapter,
  createRequestTestStore,
  deferred,
  expectCanceled,
  failureEnvelope,
  flushMicrotasks,
  seedSession,
  successEnvelope,
  userFixture,
  waitForMicrotaskCondition,
  type MockAdapter,
} from '@/test/requestTestHelpers'

/** 每个测试独立的运行时物件 */
interface TestContext {
  store: RequestStore
  actions: { type: string }[]
  countActions: (type: string) => number
  adapter: MockAdapter
  runtime: RequestRuntime
  messageError: ReturnType<typeof vi.fn>
  navigator: ReturnType<typeof vi.fn>
}

let ctx: TestContext

beforeEach(() => {
  const testStore = createRequestTestStore()
  const adapter = createMockAdapter()
  const runtime = createRequestRuntime(testStore.store, { adapter: adapter.adapter })
  const messageError = vi.fn()
  registerUiFeedbackInstances({
    message: { error: messageError },
  } as unknown as UiFeedbackInstances)
  const navigator = vi.fn()
  registerSessionExpiredNavigator(navigator)
  ctx = {
    store: testStore.store,
    actions: testStore.actions,
    countActions: testStore.countActions,
    adapter,
    runtime,
    messageError,
    navigator,
  }
})

afterEach(() => {
  vi.useRealTimers()
  resetUiFeedbackInstances()
  registerProfileRefreshFetcher(null)
  registerSessionExpiredNavigator(null)
  window.localStorage.clear()
})

describe('实例配置与 envelope 契约（规格 §7.1/§7.4）', () => {
  it('主实例与 refresh 实例共用 baseURL 与 timeout', () => {
    expect(ctx.runtime.instance.defaults.baseURL).toBe(import.meta.env.VITE_API_BASE_URL)
    expect(ctx.runtime.instance.defaults.timeout).toBe(REQUEST_TIMEOUT_MS)
    expect(ctx.runtime.refreshInstance.defaults.baseURL).toBe(import.meta.env.VITE_API_BASE_URL)
    expect(ctx.runtime.refreshInstance.defaults.timeout).toBe(REQUEST_TIMEOUT_MS)
  })

  it('HTTP 2xx 且 code===0 时解包 data（data 可为 null）', async () => {
    ctx.adapter.respondWith(() => ({ status: 200, data: successEnvelope({ id: 1 }) }))
    await expect(ctx.runtime.request<{ id: number }>({ url: '/users/1' })).resolves.toEqual({ id: 1 })
    ctx.adapter.respondWith(() => ({ status: 200, data: successEnvelope(null) }))
    await expect(ctx.runtime.request<null>({ url: '/users/1' })).resolves.toBeNull()
  })

  it('2xx 业务失败 envelope 转为携带 httpStatus/code/errorCode 的 ApiError', async () => {
    ctx.adapter.respondWith(() => ({
      status: 200,
      data: failureEnvelope(1001, API_ERROR_CODES.VALIDATION_FAILED, '参数缺失', 'req-1'),
    }))
    const error = await ctx.runtime.request({ url: '/users', method: 'post', data: {} }).catch((e) => e)
    expect(error).toMatchObject({
      name: 'ApiError',
      canceled: false,
      httpStatus: 200,
      code: 1001,
      errorCode: API_ERROR_CODES.VALIDATION_FAILED,
      requestId: 'req-1',
      message: '参数缺失',
    })
    // 已知 errorCode 映射为 i18n 文案（规格 §7.4-3）
    expect(ctx.messageError).toHaveBeenCalledWith('请求参数校验失败')
  })

  it('2xx 协议不合法（code 200 或缺 data）转为 ApiError，不兼容 envelope code===200', async () => {
    ctx.adapter.respondWith(() => ({ status: 200, data: { code: 200, message: 'ok', data: {} } }))
    const error = await ctx.runtime.request({ url: '/users' }).catch((e) => e)
    expect(error).toMatchObject({ name: 'ApiError', httpStatus: 200, message: '接口响应协议不合法' })
    // 未知错误显示固定兜底文案，不把后端 message 当已翻译文案
    expect(ctx.messageError).toHaveBeenCalledWith('请求失败，请稍后重试')
    ctx.messageError.mockClear()
    ctx.adapter.respondWith(() => ({ status: 201, data: { code: 0, message: '缺 data' } }))
    await expect(ctx.runtime.request({ url: '/users' })).rejects.toMatchObject({ httpStatus: 201 })
    expect(ctx.messageError).toHaveBeenCalledTimes(1)
  })

  it('文件流成功响应不经 envelope 解包，原样返回', async () => {
    const blob = new Blob(['binary'], { type: 'application/octet-stream' })
    ctx.adapter.respondWith(() => ({ status: 200, data: blob }))
    const result = await ctx.runtime.request<Blob>({ url: '/export', responseType: 'blob' })
    expect(result).toBe(blob)
  })

  it('HTTP 错误响应解析失败 envelope；响应头 requestId 作为兜底来源', async () => {
    ctx.adapter.respondWith(() => ({
      status: 500,
      data: 'not-json-garbage',
      headers: { 'x-request-id': 'req-h-1' },
    }))
    const error = await ctx.runtime.request({ url: '/users' }).catch((e) => e)
    expect(error).toMatchObject({ name: 'ApiError', httpStatus: 500, requestId: 'req-h-1' })
    // 未知错误固定文案 + requestId
    expect(ctx.messageError).toHaveBeenCalledWith('请求失败，请稍后重试（requestId: req-h-1）')
  })

  it('网络失败与超时转为无 httpStatus 的 ApiError', async () => {
    ctx.adapter.respondWith(() => {
      throw new Error('network down')
    })
    await expect(ctx.runtime.request({ url: '/users' })).rejects.toMatchObject({
      name: 'ApiError',
      message: 'network down',
    })
    // 未知错误提示固定兜底文案，不透出底层异常 message
    expect(ctx.messageError).toHaveBeenCalledWith('请求失败，请稍后重试')

    ctx.adapter.respondWith(() => {
      throw new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED')
    })
    await expect(ctx.runtime.request({ url: '/users' })).rejects.toMatchObject({
      name: 'ApiError',
      message: '请求超时，请稍后重试',
    })
  })

  it('silent 请求不弹全局提示', async () => {
    ctx.adapter.respondWith(() => ({ status: 500, data: failureEnvelope(500, API_ERROR_CODES.INTERNAL_ERROR) }))
    await expect(ctx.runtime.request({ url: '/users', silent: true })).rejects.toMatchObject({
      errorCode: API_ERROR_CODES.INTERNAL_ERROR,
    })
    expect(ctx.messageError).not.toHaveBeenCalled()
  })
})

describe('认证头（规格 §7.4-2）', () => {
  it('请求发送前从 store 读取当下 accessToken 写入 Authorization', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.adapter.respondWith(() => ({ status: 200, data: successEnvelope(null) }))
    await ctx.runtime.request({ url: '/users' })
    expect(ctx.adapter.calls[0]?.headers?.Authorization).toBe('Bearer at-1')
  })

  it('无 token 时不写入认证头；skipAuthHeader 可显式关闭', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.adapter.respondWith(() => ({ status: 200, data: successEnvelope(null) }))
    await ctx.runtime.request({ url: '/users', skipAuthHeader: true })
    expect(ctx.adapter.calls[0]?.headers?.Authorization).toBeUndefined()
    ctx.store.dispatch({ type: 'user/authCleared' })
    await ctx.runtime.request({ url: '/users' })
    expect(ctx.adapter.calls[1]?.headers?.Authorization).toBeUndefined()
  })
})

describe('401 刷新单飞与一次重放（规格 §6.2/§17.4）', () => {
  it('并发 401 只刷新一次，成功后全部重放并携带新 token', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.adapter.respondWith((config) => {
      if (config.url === '/auth/refresh') {
        return { status: 200, data: successEnvelope({ accessToken: 'at-2', refreshToken: 'rt-2' }) }
      }
      // 同一业务请求（同 url）首次 401，重放成功
      const isFirstAttempt = ctx.adapter.countCalls(config.url ?? '') === 1
      return isFirstAttempt
        ? { status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }
        : { status: 200, data: successEnvelope(['ok']) }
    })
    const results = await Promise.all([
      ctx.runtime.request<string[]>({ url: '/users' }),
      ctx.runtime.request<string[]>({ url: '/roles' }),
      ctx.runtime.request<string[]>({ url: '/logs' }),
    ])
    expect(results).toEqual([['ok'], ['ok'], ['ok']])
    expect(ctx.adapter.countCalls('/auth/refresh')).toBe(1)
    // 重放读取替换后的新 token（规格 §7.4-2 当下 token）
    const userCalls = ctx.adapter.calls.filter((call) => call.url === '/users')
    expect(userCalls[0]?.headers?.Authorization).toBe('Bearer at-1')
    expect(userCalls[1]?.headers?.Authorization).toBe('Bearer at-2')
    // 双 token 原子替换
    expect(ctx.store.getState().user.accessToken).toBe('at-2')
    expect(ctx.store.getState().user.refreshToken).toBe('rt-2')
    // 全局进度经历等待与重放后归零、不为负（规格 §17.25）
    expect(ctx.store.getState().app.loadingCount).toBe(0)
    expect(ctx.countActions('app/loadingStarted')).toBe(3)
    expect(ctx.countActions('app/loadingFinished')).toBe(3)
  })

  it('每个业务请求最多重放一次：重放再遇 401 直接终态', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.adapter.respondWith((config) => {
      if (config.url === '/auth/refresh') {
        return { status: 200, data: successEnvelope({ accessToken: 'at-2', refreshToken: 'rt-2' }) }
      }
      return { status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }
    })
    await expect(ctx.runtime.request({ url: '/users' })).rejects.toMatchObject({
      httpStatus: 401,
      errorCode: API_ERROR_CODES.AUTH_ACCESS_EXPIRED,
    })
    expect(ctx.adapter.countCalls('/auth/refresh')).toBe(1)
    expect(ctx.adapter.countCalls('/users')).toBe(2)
  })

  it('等待 refresh 期间 signal abort：以取消结束且不重放', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    const gate = deferred<void>()
    ctx.adapter.respondWith((config) => {
      if (config.url === '/users') {
        return { status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }
      }
      return gate.promise.then(() => ({ status: 200, data: successEnvelope({ accessToken: 'at-2', refreshToken: 'rt-2' }) }))
    })
    const caller = new AbortController()
    const pending = ctx.runtime.request({ url: '/users', signal: caller.signal })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/auth/refresh') === 1)
    // refresh 在途时只有这一个逻辑请求在计数（只计一次）
    expect(ctx.store.getState().app.loadingCount).toBe(1)
    caller.abort()
    gate.resolve()
    await expectCanceled(pending)
    expect(ctx.adapter.countCalls('/users')).toBe(1)
    expect(ctx.store.getState().app.loadingCount).toBe(0)
  })

  it('等待 refresh 期间 sessionEpoch 变化：以取消结束且不重放（规格 §17.5）', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    const gate = deferred<void>()
    ctx.adapter.respondWith((config) => {
      if (config.url === '/users') {
        return { status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }
      }
      return gate.promise.then(() => ({ status: 200, data: successEnvelope({ accessToken: 'at-2', refreshToken: 'rt-2' }) }))
    })
    const pending = ctx.runtime.request({ url: '/users' })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/auth/refresh') === 1)
    ctx.store.dispatch({ type: 'user/sessionEpochIncremented' })
    gate.resolve()
    await expectCanceled(pending)
    expect(ctx.adapter.countCalls('/users')).toBe(1)
  })

  it('refresh 成功但 epoch 已变化：结果被丢弃、token 不写回（规格 §6.2/§17.5）', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    const gate = deferred<void>()
    ctx.adapter.respondWith((config) => {
      if (config.url === '/users') {
        return { status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }
      }
      return gate.promise.then(() => ({ status: 200, data: successEnvelope({ accessToken: 'at-2', refreshToken: 'rt-2' }) }))
    })
    const pending = ctx.runtime.request({ url: '/users' })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/auth/refresh') === 1)
    ctx.store.dispatch({ type: 'user/sessionEpochIncremented' })
    gate.resolve()
    await expectCanceled(pending)
    expect(ctx.store.getState().user.accessToken).toBe('at-1')
  })

  it('refresh 返回 AUTH_REFRESH_EXPIRED：只执行一次会话清理并跳登录', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.store.dispatch(tabOpened({ tab: { key: '/dashboard', title: 'Dashboard', affix: true, location: { pathname: '/dashboard', search: '', hash: '', key: 'k', state: null } } }))
    ctx.store.dispatch(cacheEntryTouched({ key: '/dashboard' }))
    window.history.pushState({}, '', '/system/user?id=1')
    ctx.adapter.respondWith((config) => {
      if (config.url === '/auth/refresh') {
        return { status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_REFRESH_EXPIRED) }
      }
      return { status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }
    })
    const [first, second] = [
      ctx.runtime.request({ url: '/users' }).catch((e) => e),
      ctx.runtime.request({ url: '/roles' }).catch((e) => e),
    ]
    await Promise.all([first, second])
    // 清理：epoch 递增一次、认证清空、页签与缓存销毁
    expect(ctx.countActions('user/sessionEpochIncremented')).toBe(1)
    expect(ctx.countActions('user/authCleared')).toBe(1)
    expect(ctx.countActions('tabs/tabsCleared')).toBe(1)
    expect(ctx.countActions('pageCache/pageCacheCleared')).toBe(1)
    expect(ctx.store.getState().user.accessToken).toBeNull()
    expect(ctx.store.getState().tabs.items).toEqual([])
    // 跳登录一次，携带经校验的当前地址
    expect(ctx.navigator).toHaveBeenCalledTimes(1)
    expect(ctx.navigator).toHaveBeenCalledWith('/login?redirect=' + encodeURIComponent('/system/user?id=1'))
    // 两个等待请求都以 ApiError 终态结束且不弹错（由清理与跳转表达）
    expect(await first).toMatchObject({ name: 'ApiError' })
    expect(await second).toMatchObject({ name: 'ApiError' })
    expect(ctx.messageError).not.toHaveBeenCalled()
  })

  it('refresh 网络失败与协议错误同样只清理一次会话', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.adapter.respondWith((config) => {
      if (config.url === '/users') {
        return { status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }
      }
      throw new Error('refresh network down')
    })
    await expect(ctx.runtime.request({ url: '/users' })).rejects.toMatchObject({ name: 'ApiError' })
    expect(ctx.navigator).toHaveBeenCalledTimes(1)
    expect(ctx.store.getState().user.accessToken).toBeNull()

    // 协议错误：refresh 返回 code 200 旧协议
    seedSession(ctx.store, { accessToken: 'at-3', refreshToken: 'rt-3' })
    ctx.navigator.mockClear()
    ctx.adapter.respondWith((config) => {
      if (config.url === '/users') {
        return { status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }
      }
      return { status: 200, data: { code: 200, message: '旧协议', data: {} } }
    })
    await expect(ctx.runtime.request({ url: '/users' })).rejects.toMatchObject({ name: 'ApiError' })
    expect(ctx.navigator).toHaveBeenCalledTimes(1)
  })

  it('refresh 期间 epoch 已变化时失败结果被丢弃，不清理新会话（规格 §17.5）', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    const gate = deferred<void>()
    ctx.adapter.respondWith((config) => {
      if (config.url === '/users') {
        return { status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }
      }
      return gate.promise.then(() => {
        throw new Error('refresh failed after switch')
      })
    })
    const pending = ctx.runtime.request({ url: '/users' }).catch((e) => e)
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/auth/refresh') === 1)
    // 模拟登出/切账号：epoch 递增且换上新 token
    ctx.store.dispatch({ type: 'user/sessionEpochIncremented' })
    seedSession(ctx.store, { accessToken: 'at-new', refreshToken: 'rt-new' })
    gate.resolve()
    await expect(pending).resolves.toMatchObject({ name: 'ApiError' })
    expect(ctx.navigator).not.toHaveBeenCalled()
    expect(ctx.store.getState().user.accessToken).toBe('at-new')
  })

  it('skipAuthRefresh 固定关闭刷新流程（login/refresh/logout 语义）', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.adapter.respondWith(() => ({ status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }))
    await expect(ctx.runtime.request({ url: '/auth/login', method: 'post', skipAuthRefresh: true })).rejects.toMatchObject({
      errorCode: API_ERROR_CODES.AUTH_ACCESS_EXPIRED,
    })
    expect(ctx.adapter.countCalls('/auth/refresh')).toBe(0)
    expect(ctx.messageError).toHaveBeenCalledWith('登录状态已过期，请重新登录')
  })

  it('refresh 专用实例不安装业务拦截器：不携带认证头', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.adapter.respondWith(() => ({ status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }))
    await ctx.runtime.request({ url: '/users' }).catch(() => undefined)
    const refreshCall = ctx.adapter.calls.find((call) => call.url === '/auth/refresh')
    expect(refreshCall?.headers?.Authorization).toBeUndefined()
  })
})

describe('403 三类语义（规格 §5.4/§6.2）', () => {
  it('AUTH_ACCOUNT_DISABLED 直接一次会话清理并跳登录，不提示', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    window.history.pushState({}, '', '/dashboard')
    ctx.adapter.respondWith(() => ({ status: 403, data: failureEnvelope(403, API_ERROR_CODES.AUTH_ACCOUNT_DISABLED) }))
    await expect(ctx.runtime.request({ url: '/users' })).rejects.toMatchObject({
      errorCode: API_ERROR_CODES.AUTH_ACCOUNT_DISABLED,
    })
    await ctx.runtime.request({ url: '/users' }).catch(() => undefined)
    expect(ctx.navigator).toHaveBeenCalledTimes(1)
    expect(ctx.countActions('user/authCleared')).toBe(1)
    expect(ctx.messageError).not.toHaveBeenCalled()
  })

  it('AUTH_PERMISSION_CHANGED 触发 profileRefreshSingleFlight：并发共享一次刷新与一次提示', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.store.dispatch(
      profileLoaded({ user: userFixture, roles: [], permCodes: [], permissionVersion: 'v1' }),
    )
    const fetcher = vi.fn(async () => {
      ctx.store.dispatch(profileLoaded({ user: userFixture, roles: [], permCodes: [], permissionVersion: 'v2' }))
    })
    registerProfileRefreshFetcher(fetcher)
    ctx.adapter.respondWith(() => ({ status: 403, data: failureEnvelope(403, API_ERROR_CODES.AUTH_PERMISSION_CHANGED) }))
    await Promise.allSettled([
      ctx.runtime.request({ url: '/users' }).catch(() => undefined),
      ctx.runtime.request({ url: '/roles' }).catch(() => undefined),
    ])
    await waitForMicrotaskCondition(() => fetcher.mock.calls.length >= 1)
    await flushMicrotasks(8)
    // 并发权限变更共享一个 Promise：fetcher 只执行一次、提示一次（规格 §5.4）
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(ctx.messageError).toHaveBeenCalledTimes(1)
    expect(ctx.messageError).toHaveBeenCalledWith('权限已变更，请刷新后重试')
    // 不清会话
    expect(ctx.store.getState().user.accessToken).toBe('at-1')
    expect(ctx.navigator).not.toHaveBeenCalled()
  })

  it('30 秒内相同 permissionVersion 不重复提示（规格 §5.4）', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.store.dispatch(
      profileLoaded({ user: userFixture, roles: [], permCodes: [], permissionVersion: 'v1' }),
    )
    const fetcher = vi.fn(async () => {
      ctx.store.dispatch(profileLoaded({ user: userFixture, roles: [], permCodes: [], permissionVersion: 'v1' }))
    })
    registerProfileRefreshFetcher(fetcher)
    ctx.adapter.respondWith(() => ({ status: 403, data: failureEnvelope(403, API_ERROR_CODES.AUTH_PERMISSION_CHANGED) }))
    await ctx.runtime.request({ url: '/users' }).catch(() => undefined)
    await flushMicrotasks(8)
    expect(ctx.messageError).toHaveBeenCalledTimes(1)
    // 10 秒后再次触发：刷新执行但同版本不重复提示
    vi.setSystemTime(new Date(Date.now() + 10_000))
    await ctx.runtime.request({ url: '/users' }).catch(() => undefined)
    await flushMicrotasks(8)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(ctx.messageError).toHaveBeenCalledTimes(1)
    // 超过 30 秒冷却窗口后恢复提示
    vi.setSystemTime(new Date(Date.now() + 21_000))
    await ctx.runtime.request({ url: '/users' }).catch(() => undefined)
    await flushMicrotasks(8)
    expect(ctx.messageError).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('/auth/profile 自身的 403 不递归触发刷新（规格 §5.4）', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.store.dispatch(
      profileLoaded({ user: userFixture, roles: [], permCodes: [], permissionVersion: 'v1' }),
    )
    let triggerCount = 0
    registerProfileRefreshFetcher(async () => {
      triggerCount += 1
      // 模拟 /auth/profile 自身返回 403 AUTH_PERMISSION_CHANGED 的真实路径
      await ctx.runtime.request({ url: '/auth/profile' }).catch(() => undefined)
    })
    ctx.adapter.respondWith(() => ({ status: 403, data: failureEnvelope(403, API_ERROR_CODES.AUTH_PERMISSION_CHANGED) }))
    await ctx.runtime.request({ url: '/users' }).catch(() => undefined)
    await flushMicrotasks(10)
    // 单飞在途期间的新触发共享同一 Promise，不产生第二次 profile 请求
    expect(triggerCount).toBe(1)
    expect(ctx.adapter.countCalls('/auth/profile')).toBe(1)
  })

  it('普通 AUTH_FORBIDDEN 仅提示，不刷新 profile、不清会话', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    const fetcher = vi.fn()
    registerProfileRefreshFetcher(fetcher)
    ctx.adapter.respondWith(() => ({ status: 403, data: failureEnvelope(403, API_ERROR_CODES.AUTH_FORBIDDEN) }))
    await expect(ctx.runtime.request({ url: '/users' })).rejects.toMatchObject({
      errorCode: API_ERROR_CODES.AUTH_FORBIDDEN,
    })
    await flushMicrotasks(8)
    expect(fetcher).not.toHaveBeenCalled()
    expect(ctx.messageError).toHaveBeenCalledWith('没有权限执行此操作')
    expect(ctx.navigator).not.toHaveBeenCalled()
  })

  it('HTTP 401/403 之外不触发认证状态机（400 只提示）', async () => {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    ctx.adapter.respondWith(() => ({ status: 400, data: failureEnvelope(400, API_ERROR_CODES.VALIDATION_FAILED) }))
    await expect(ctx.runtime.request({ url: '/users' })).rejects.toMatchObject({ httpStatus: 400 })
    expect(ctx.adapter.countCalls('/auth/refresh')).toBe(0)
    expect(ctx.navigator).not.toHaveBeenCalled()
    expect(ctx.messageError).toHaveBeenCalledWith('请求参数校验失败')
  })
})

describe('重复 GET 取消（规格 §7.4-5/§17.24）', () => {
  it('同 key 的后请求取消前请求，且前请求结果不覆盖后请求', async () => {
    const gate = deferred<void>()
    ctx.adapter.respondWith((config) => {
      const params = config.params as { page?: number }
      if (params?.page === 1) {
        return gate.promise.then(() => ({ status: 200, data: successEnvelope('stale-page-1') }))
      }
      return { status: 200, data: successEnvelope('page-2') }
    })
    const first = ctx.runtime.request<string>({ url: '/users', params: { page: 1 } })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/users') === 1)
    const second = ctx.runtime.request<string>({ url: '/users', params: { page: 2 } })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/users') === 2)
    const third = ctx.runtime.request<string>({ url: '/users', params: { page: 2 } })
    // second 与 third 同 key：third 取消 second；first key 不同仍在途
    await expectCanceled(second)
    await expect(third).resolves.toBe('page-2')
    gate.resolve()
    await expect(first).resolves.toBe('stale-page-1')
  })

  it('同 key 快速重复查询：前请求被取消，后请求结果生效（规格 §17.24）', async () => {
    const gate = deferred<void>()
    ctx.adapter.respondWith((config) => {
      const params = config.params as { page: number }
      if (params?.page === 2 && ctx.adapter.countCalls('/users') === 1) {
        // 第一发 page-2 挂起等待，让同 key 的第二发把它取消
        return gate.promise.then(() => ({ status: 200, data: successEnvelope('slow-page-2') }))
      }
      return { status: 200, data: successEnvelope('fast-page-2') }
    })
    const slow = ctx.runtime.request<string>({ url: '/users', params: { page: 2 } })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/users') === 1)
    const fast = ctx.runtime.request<string>({ url: '/users', params: { page: 2 } })
    await expect(fast).resolves.toBe('fast-page-2')
    gate.resolve()
    await expectCanceled(slow)
  })

  it('对象 key 顺序不影响 key；数组顺序影响 key', async () => {
    const gate = deferred<void>()
    ctx.adapter.respondWith((_config, attempt) =>
      attempt === 1 ? gate.promise.then(() => ({ status: 200, data: successEnvelope('v') })) : { status: 200, data: successEnvelope('v') },
    )
    const first = ctx.runtime.request<string>({ url: '/users', params: { page: 1, size: 10 } })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/users') === 1)
    const second = ctx.runtime.request<string>({ url: '/users', params: { size: 10, page: 1 } })
    // 同 key：first 被 second 取消
    await expectCanceled(first)
    await expect(second).resolves.toBe('v')
    gate.resolve()
    const arrA = ctx.runtime.request<string>({ url: '/users', params: { ids: [1, 2] } })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/users') === 3)
    const arrB = ctx.runtime.request<string>({ url: '/users', params: { ids: [2, 1] } })
    await expect(arrA).resolves.toBe('v')
    await expect(arrB).resolves.toBe('v')
  })

  it('不同 scopeId、Accept、responseType、sessionEpoch 不碰撞；写操作不去重', async () => {
    const gate = deferred<void>()
    let hold = true
    ctx.adapter.respondWith(() =>
      hold ? gate.promise.then(() => ({ status: 200, data: successEnvelope('held') })) : { status: 200, data: successEnvelope('fast') },
    )
    const inScope = ctx.runtime.request<string>({ url: '/users', scopeId: 'tab-1' })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/users') === 1)
    hold = false
    const inOtherScope = ctx.runtime.request<string>({ url: '/users', scopeId: 'tab-2' })
    const withAccept = ctx.runtime.request<string>({ url: '/users', headers: { Accept: 'text/csv' } })
    const asBlob = ctx.runtime.request<string>({ url: '/users', responseType: 'blob' })
    await Promise.all([inOtherScope, withAccept, asBlob])
    // epoch 变化后同地址请求 key 不同：held 请求不被取消
    ctx.store.dispatch({ type: 'user/sessionEpochIncremented' })
    const nextEpoch = ctx.runtime.request<string>({ url: '/users', scopeId: 'tab-1' })
    await expect(nextEpoch).resolves.toBe('fast')
    gate.resolve()
    await expect(inScope).resolves.toBe('held')
    // 写操作不去重：两次相同地址的 POST 都完整执行
    await ctx.runtime.request({ url: '/users', method: 'post', data: { a: 1 } })
    await ctx.runtime.request({ url: '/users', method: 'post', data: { a: 1 } })
    expect(ctx.adapter.calls.filter((call) => call.method === 'post')).toHaveLength(2)
  })

  it('dedupe none 显式关闭去重', async () => {
    const gate = deferred<void>()
    let hold = true
    ctx.adapter.respondWith((config) => {
      void config
      return hold ? gate.promise.then(() => ({ status: 200, data: successEnvelope('x') })) : { status: 200, data: successEnvelope('y') }
    })
    const first = ctx.runtime.request<string>({ url: '/users', dedupe: 'none' })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/users') === 1)
    hold = false
    const second = ctx.runtime.request<string>({ url: '/users', dedupe: 'none' })
    gate.resolve()
    await expect(first).resolves.toBe('x')
    await expect(second).resolves.toBe('y')
  })

  it('params 含函数或循环引用时以 ApiError 拒绝且不发请求', async () => {
    await expect(ctx.runtime.request({ url: '/users', params: { bad: () => 1 } })).rejects.toMatchObject({
      name: 'ApiError',
      message: '请求参数包含函数或循环引用，无法计算去重 key',
    })
    const circular: Record<string, unknown> = {}
    circular.self = circular
    await expect(ctx.runtime.request({ url: '/users', params: circular })).rejects.toMatchObject({ name: 'ApiError' })
    expect(ctx.adapter.calls).toHaveLength(0)
  })
})

describe('页签作用域取消（规格 §7.4-6/§17.12）', () => {
  it('页签隐藏/关闭统一 abort 该 scope，全局 scope 不被误杀', async () => {
    const gate = deferred<void>()
    ctx.adapter.respondWith(() => gate.promise.then(() => ({ status: 200, data: successEnvelope('late') })))
    const tabRequest = ctx.runtime.request<string>({ url: '/users', scopeId: 'tab-1' })
    const globalRequest = ctx.runtime.request<string>({ url: '/auth/profile', scopeId: GLOBAL_REQUEST_SCOPE })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/auth/profile') === 1)
    abortRequestScope('tab-1')
    await expectCanceled(tabRequest)
    gate.resolve()
    // 全局 profile 请求不受页签作用域取消影响
    await expect(globalRequest).resolves.toBe('late')
    // 取消后 loading 归零不悬挂（规格 §17.25）
    expect(ctx.store.getState().app.loadingCount).toBe(0)
  })

  it('调用方 signal（loader 透传）abort 时以取消结束', async () => {
    const gate = deferred<void>()
    ctx.adapter.respondWith(() => gate.promise.then(() => ({ status: 200, data: successEnvelope('late') })))
    const controller = new AbortController()
    const pending = ctx.runtime.request<string>({ url: '/loader-data', signal: controller.signal })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/loader-data') === 1)
    controller.abort()
    await expectCanceled(pending)
    gate.resolve()
  })
})

describe('全局进度计数（规格 §7.4-8/§17.25）', () => {
  it('skipGlobalLoading 不计数；归零后不悬挂、不为负', async () => {
    ctx.adapter.respondWith(() => ({ status: 200, data: successEnvelope(null) }))
    await ctx.runtime.request({ url: '/a', skipGlobalLoading: true })
    expect(ctx.store.getState().app.loadingCount).toBe(0)
    expect(ctx.countActions('app/loadingStarted')).toBe(0)

    const gate = deferred<void>()
    ctx.adapter.respondWith(() => gate.promise.then(() => ({ status: 200, data: successEnvelope(null) })))
    const pending = ctx.runtime.request({ url: '/b' })
    await waitForMicrotaskCondition(() => ctx.adapter.countCalls('/b') === 1)
    expect(ctx.store.getState().app.loadingCount).toBe(1)
    gate.resolve()
    await pending
    expect(ctx.store.getState().app.loadingCount).toBe(0)
    expect(ctx.countActions('app/loadingFinished')).toBe(1)
  })
})

describe('adapter 选择（规格 §6.2：主实例与 refresh 实例复用同一选择）', () => {
  it('动态 adapter 解析器按请求生效，主/refresh 实例同一选择', async () => {
    const dynamicAdapter = createMockAdapter()
    configureRequestAdapter(() => dynamicAdapter.adapter)
    try {
      seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
      dynamicAdapter.respondWith(() => ({ status: 401, data: failureEnvelope(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED) }))
      await ctx.runtime.request({ url: '/users' }).catch(() => undefined)
      // 主实例与 refresh 请求都命中动态 adapter
      expect(dynamicAdapter.countCalls('/users')).toBe(1)
      expect(dynamicAdapter.countCalls('/auth/refresh')).toBe(1)
    } finally {
      configureRequestAdapter(null)
    }
  })

  it('未注册动态 adapter 且未注入显式 adapter 时回落 axios 默认实现', async () => {
    const fallbackRuntime = createRequestRuntime(createRequestTestStore().store)
    const adapter = fallbackRuntime.instance.defaults.adapter as AxiosAdapter
    await expect(adapter({ headers: {} } as InternalAxiosRequestConfig)).rejects.toThrow()
  })
})
