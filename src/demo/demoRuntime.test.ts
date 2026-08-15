/**
 * 演示模式运行时集成测试（规格 §13.1/§13.2；§20 闸门 ⑤ 结论产品化）：
 * - fallback：真实通道网络级失败 → 提示并切换 demo 来源 → demo adapter 重放一次登录成功，
 *   登录状态机完成 token/来源保存与 profile 拉取（profile 亦由 demo adapter 承载）；
 * - 业务错误不切换；真实登录成功归一 real 来源，后续网络失败不隐式切换（普通拦截器不切 adapter）；
 * - force：首个登录直接由 demo adapter 承载，来源归一 demo；
 * - 整页刷新延续：全新 store 从持久化恢复 sessionSource（先于首个 profile），
 *   新请求运行时 + 重新注册的 demo 运行时使 profile 继续走 demo adapter；
 * - 会话清理订阅重置 demo token 运行态（登出清 demo 运行态）。
 * 真实通道在 jsdom 中天然不可达（无后端），网络级失败无需桩；可控真实响应用 mock adapter 组合。
 */
import { AxiosError, AxiosHeaders } from 'axios'
import type { ProfileData } from '@/types/auth/auth.types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_ENDPOINTS } from '@/constants/auth/auth.constants'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { appI18n, COMMON_NAMESPACE } from '@/i18n/i18n'
import { registerUiFeedbackInstances, resetUiFeedbackInstances, type UiFeedbackInstances } from '@/services/feedback/uiFeedback'
import { login } from '@/services/auth/auth.service'
import { createAuthSessionRuntime } from '@/services/auth/auth.session'
import { configureRequestAdapter, createRequestRuntime } from '@/services/request/request'
import { createMockAdapter, successEnvelope, userFixture } from '@/test/requestTestHelpers'
import { authCleared } from '@/store/slices/user.slice'
import { createAppStore, getDefaultAppStore } from '@/store/store'
import { demoAdapter, demoAdapterTestController } from './adapters/demo.adapter'
import { createDemoRuntime, type DemoRuntimeHandle } from './demoRuntime'

const REAL_LOGIN_DATA = {
  accessToken: 'real-at-1',
  refreshToken: 'real-rt-1',
  user: userFixture,
}

let handles: DemoRuntimeHandle[]
let warningMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'fallback')
  window.localStorage.clear()
  demoAdapterTestController.resetRuntime()
  handles = []
  warningMock = vi.fn()
  registerUiFeedbackInstances({ message: { warning: warningMock } } as unknown as UiFeedbackInstances)
})

afterEach(async () => {
  for (const handle of handles) {
    handle.dispose()
  }
  configureRequestAdapter(null)
  resetUiFeedbackInstances()
  vi.unstubAllGlobals()
  // 默认 store 会话复位并落盘清理，避免跨用例残留
  const { store, persistor } = getDefaultAppStore()
  store.dispatch(authCleared())
  await persistor.flush()
  window.localStorage.clear()
})

function registerRuntime(): DemoRuntimeHandle {
  const handle = createDemoRuntime(getDefaultAppStore().store)
  handles.push(handle)
  return handle
}

/** 以生产默认 api（auth.service 真实现）构造登录状态机，完整走 login→token→profile */
function createDefaultSession() {
  const appStore = getDefaultAppStore()
  return createAuthSessionRuntime({ store: appStore.store, rehydrated: appStore.rehydratedPromise })
}

describe('fallback 登录（规格 §13.1/§13.2）', () => {
  it('网络级失败：提示一次并切换 demo 来源，demo 重放成功后状态机完成 token/来源保存与 profile 拉取', async () => {
    registerRuntime()
    await createDefaultSession().loginWithCredentials({ username: 'admin', password: '任意密码' })

    const user = getDefaultAppStore().store.getState().user
    expect(user.sessionSource).toBe('demo')
    expect(user.accessToken?.startsWith('demo-at.admin.')).toBe(true)
    // 登录状态机内的 profile 请求同样由 demo adapter 承载并写入派生数据
    expect(user.user?.username).toBe('admin')
    expect(user.roles).toEqual(['admin'])
    expect(warningMock).toHaveBeenCalledTimes(1)
    expect(warningMock).toHaveBeenCalledWith(appI18n.t('无法连接真实后端，已切换到演示模式', { ns: COMMON_NAMESPACE }))
  })

  it('业务错误不切换：真实通道 401 AUTH_INVALID_CREDENTIALS 原样上抛，来源保持未登录', async () => {
    const handle = registerRuntime()
    const real = createMockAdapter()
    real.respondWith(() => ({
      status: 401,
      data: { code: 401, message: '用户名或密码错误', data: null, errorCode: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS },
    }))
    configureRequestAdapter((config) => handle.resolver(config) ?? real.adapter)

    const error = await login({ username: 'admin', password: 'wrong' }).catch((caught: unknown) => caught)
    expect(error).toMatchObject({
      name: 'ApiError',
      httpStatus: 401,
      errorCode: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    })
    expect(getDefaultAppStore().store.getState().user.sessionSource).toBeNull()
    expect(warningMock).not.toHaveBeenCalled()
  })

  it('真实登录成功归一 real 来源；后续 profile 网络失败不隐式切换（普通拦截器不切 adapter）', async () => {
    const handle = registerRuntime()
    const real = createMockAdapter()
    real.respondWith((config) => {
      if (config.url === AUTH_ENDPOINTS.LOGIN) {
        return { status: 200, data: successEnvelope(REAL_LOGIN_DATA) }
      }
      // profile：模拟网络级失败（无 HTTP 响应）
      return Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config))
    })
    configureRequestAdapter((config) => handle.resolver(config) ?? real.adapter)

    const result = await login({ username: 'real-user', password: 'secret' })
    expect(result.accessToken).toBe('real-at-1')
    expect(getDefaultAppStore().store.getState().user.sessionSource).toBe('real')

    const { getProfile } = await import('@/services/auth/auth.service')
    await expect(getProfile()).rejects.toMatchObject({ name: 'ApiError', httpStatus: undefined })
    // 不因普通请求网络失败隐式切换来源（切换只发生在登录 fallback，规格 §13.2）
    expect(getDefaultAppStore().store.getState().user.sessionSource).toBe('real')
  })
})

describe('force 模式（规格 §13.1）', () => {
  it('首个登录直接由 demo adapter 承载，无需真实通道失败，来源归一 demo', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'force')
    registerRuntime()
    await createDefaultSession().loginWithCredentials({ username: 'viewer', password: '任意密码' })

    const user = getDefaultAppStore().store.getState().user
    expect(user.sessionSource).toBe('demo')
    expect(user.accessToken?.startsWith('demo-at.viewer.')).toBe(true)
    expect(user.user?.username).toBe('viewer')
    expect(warningMock).not.toHaveBeenCalled()
  })
})

describe('整页刷新延续（闸门 ⑤ 产品化，规格 §13.2/§6.1）', () => {
  it('刷新后 sessionSource 先于首个 profile 恢复，profile 继续走 demo adapter', async () => {
    registerRuntime()
    await createDefaultSession().loginWithCredentials({ username: 'admin', password: '任意密码' })
    await getDefaultAppStore().persistor.flush()
    // 持久化白名单：双 token + sessionSource（规格 §8.1）
    const persisted = JSON.parse(window.localStorage.getItem('apex_user') ?? '{}')
    expect(JSON.parse(persisted.sessionSource)).toBe('demo')
    expect(JSON.parse(persisted.accessToken).startsWith('demo-at.admin.')).toBe(true)

    // 模拟整页刷新：全新 store 从同一 localStorage 恢复（新 persistor 重新 rehydrate）
    const reloaded = createAppStore()
    await reloaded.rehydratedPromise
    expect(reloaded.store.getState().user.sessionSource).toBe('demo')
    expect(reloaded.store.getState().user.accessToken).not.toBeNull()

    // 新页面重新注册 demo 运行时并创建新请求运行时；真实通道在本环境不可达，
    // profile 能成功即证明请求由 demo adapter 承载（来源在首个 profile 之前已恢复）
    const handle = createDemoRuntime(reloaded.store)
    handles.push(handle)
    const runtime = createRequestRuntime(reloaded.store)
    const profile = await runtime.request<ProfileData>({ url: '/auth/profile', method: 'get', silent: true })
    expect(profile.user.username).toBe('admin')
    expect(profile.permissionVersion).toBe('demo-admin-v1')
  })
})

describe('会话清理订阅（规格 §13.2：登出清 demo 运行态）', () => {
  it('token 与来源归空后重置 demo token 运行态（失效标记清零）', async () => {
    registerRuntime()
    const { accessToken } = await login({ username: 'admin', password: '任意密码' })
    const config = () =>
      ({
        url: '/auth/profile',
        method: 'get',
        headers: new AxiosHeaders({ Authorization: `Bearer ${accessToken}` }),
      }) as Parameters<typeof demoAdapter>[0]

    demoAdapterTestController.invalidateAccessTokens('admin')
    await expect(demoAdapter(config())).rejects.toMatchObject({ response: { status: 401 } })

    // 登出本地清理：authCleared 使 token/来源归空，订阅同步重置 demo token 运行态
    getDefaultAppStore().store.dispatch(authCleared())
    const response = await demoAdapter(config())
    expect((response.data as { data: ProfileData }).data.user.username).toBe('admin')
  })
})
