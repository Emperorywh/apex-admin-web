/**
 * 请求层测试共享工具：可控 axios mock adapter 与无持久化的测试 store。
 * 只被各请求测试文件导入，不参与生产代码与覆盖率统计。
 */
import { configureStore, type Middleware, type UnknownAction } from '@reduxjs/toolkit'
import { expect } from 'vitest'
import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import type { RequestStore } from '@/services/request/request.types'
import { appSlice } from '@/store/slices/app.slice'
import { pageCacheSlice } from '@/store/slices/pageCache.slice'
import { tabsSlice } from '@/store/slices/tabs.slice'
import { tokensStored, userSlice } from '@/store/slices/user.slice'
import type { User } from '@/types/system/user/user.types'

/** 测试用用户资料（满足 User 形状的最小完整字段） */
export const userFixture: User = {
  id: 'u-1',
  username: 'admin',
  displayName: '管理员',
  email: 'admin@example.com',
  status: 'enabled',
  roleIds: ['r-1'],
  createdAt: '2026-08-15T00:00:00+08:00',
  updatedAt: '2026-08-15T00:00:00+08:00',
}

/** mock 响应脚本：status 必填，data/headers 可选 */
export interface MockResponse {
  status: number
  data?: unknown
  headers?: Record<string, string>
}

/** 按请求配置决定响应的处理器 */
export type MockResponder = (config: InternalAxiosRequestConfig, attempt: number) => MockResponse | Promise<MockResponse>

/** 成功 envelope 快捷构造 */
export function successEnvelope<T>(data: T): { code: 0; message: string; data: T } {
  return { code: 0, message: 'ok', data }
}

/** 失败 envelope 快捷构造 */
export function failureEnvelope(code: number, errorCode: string, message = '业务失败', requestId?: string) {
  return { code, message, data: null, errorCode, ...(requestId !== undefined ? { requestId } : {}) }
}

/** 手工受控 Promise */
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * 可控 mock adapter：记录全部请求配置，响应由 respondWith 注入的处理器决定；
 * 等待响应期间 abort 会立即以 CanceledError 结束，模拟真实 adapter 的取消时序。
 */
export type MockAdapter = ReturnType<typeof createMockAdapter>

export function createMockAdapter() {
  const calls: InternalAxiosRequestConfig[] = []
  let responder: MockResponder = () => ({ status: 200, data: successEnvelope(null) })
  const adapter: AxiosAdapter = (config) =>
    new Promise((resolve, reject) => {
      // axios 的 AbortSignalLike 方法可选，统一按标准 AbortSignal 使用（与运行时封装一致）
      const signal = config.signal as AbortSignal | undefined
      const cancel = () => reject(new CanceledError('canceled', config))
      if (signal?.aborted) {
        cancel()
        return
      }
      signal?.addEventListener('abort', cancel, { once: true })
      const settle = () => {
        signal?.removeEventListener('abort', cancel)
      }
      calls.push(config)
      const attempt = calls.length
      Promise.resolve(responder(config, attempt)).then(
        (result) => {
          settle()
          if (signal?.aborted) {
            reject(new CanceledError('canceled', config))
            return
          }
          const response = {
            data: result.data,
            status: result.status,
            statusText: '',
            headers: new AxiosHeaders(result.headers ?? {}),
            config,
            request: {},
          }
          if (result.status < 200 || result.status >= 300) {
            reject(
              new AxiosError(
                `Request failed with status code ${result.status}`,
                AxiosError.ERR_BAD_REQUEST,
                config,
                {},
                response,
              ),
            )
            return
          }
          resolve(response)
        },
        (error) => {
          settle()
          reject(error)
        },
      )
    })
  return {
    adapter,
    calls,
    /** 统计某个 url 的请求次数 */
    countCalls(url: string): number {
      return calls.filter((config) => config.url === url).length
    },
    respondWith(next: MockResponder): void {
      responder = next
    },
  }
}

/** 记录全部 action 的无持久化测试 store，结构与请求运行时所需切片一致 */
export function createRequestTestStore() {
  const actions: UnknownAction[] = []
  const actionLog: Middleware = () => (next) => (action) => {
    actions.push(action as UnknownAction)
    return next(action)
  }
  const store = configureStore({
    reducer: {
      user: userSlice.reducer,
      tabs: tabsSlice.reducer,
      pageCache: pageCacheSlice.reducer,
      app: appSlice.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(actionLog),
  })
  return {
    store: store as unknown as RequestStore,
    actions,
    /** 统计指定类型 action 的派发次数 */
    countActions(type: string): number {
      return actions.filter((action) => action.type === type).length
    },
  }
}

/** 播种双 token 会话（默认 real 来源、epoch 0） */
export function seedSession(
  store: RequestStore,
  tokens: { accessToken: string; refreshToken: string },
  sessionSource: 'real' | 'demo' = 'real',
): void {
  store.dispatch(tokensStored({ ...tokens, sessionSource }))
}

/** 断言值是 ApiError 且 canceled 为 true（规格 §7.4-9） */
export async function expectCanceled(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({ name: 'ApiError', canceled: true })
}

/** 静默工具：等待微任务队列排空（拦截器链与 Promise 回调全部落定） */
export async function flushMicrotasks(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve()
  }
}

/** 确定性等待：逐个微任务轮询直到条件成立（用于等 adapter 收到请求等异步时序） */
export async function waitForMicrotaskCondition(predicate: () => boolean, maxTicks = 500): Promise<void> {
  for (let i = 0; i < maxTicks && !predicate(); i += 1) {
    await Promise.resolve()
  }
  if (!predicate()) {
    throw new Error('waitForMicrotaskCondition 条件在限定微任务轮数内未成立')
  }
}
