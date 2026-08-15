/**
 * 认证会话编排测试（规格 §4.3/§5.4/§6.2/§17.2/§17.3/§17.5/§17.6/§17.7）：
 * 登录/登出状态机（epoch、清理、settings 保留、导航意图）、ensureProfile 单飞与启动时序、
 * profile 失败与会话资格处理、权限变更闭环（版本比较、失权页签关闭、403 意图、并发共享单飞）。
 * 认证接口以桩实现注入隔离网络；并发单飞经请求运行时 403 AUTH_PERMISSION_CHANGED 集成验证。
 */
import { configureStore, type Middleware, type UnknownAction } from '@reduxjs/toolkit'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { PERMISSIONS } from '@/constants/permission.constants'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { ROUTE_FALLBACK_PATH, ROUTE_PATHS } from '@/constants/route.constants'
import { registerUiFeedbackInstances, resetUiFeedbackInstances } from '@/services/feedback/uiFeedback'
import type { UiFeedbackInstances } from '@/services/feedback/uiFeedback'
import { createApiError } from '@/services/request/envelope'
import { registerSessionExpiredNavigator } from '@/services/request/sessionCleanup'
import { createRequestRuntime } from '@/services/request/request'
import type { RequestStore } from '@/services/request/request.types'
import { cacheEntryTouched } from '@/store/slices/pageCache.slice'
import { settingsSlice, type SettingsState } from '@/store/slices/settings.slice'
import { tabActivated, tabOpened } from '@/store/slices/tabs.slice'
import { appSlice } from '@/store/slices/app.slice'
import { pageCacheSlice } from '@/store/slices/pageCache.slice'
import { profileLoaded, userSlice } from '@/store/slices/user.slice'
import { tabsSlice } from '@/store/slices/tabs.slice'
import type { ProfileData } from '@/types/auth/auth.types'
import {
  createMockAdapter,
  deferred,
  failureEnvelope,
  flushMicrotasks,
  seedSession,
  userFixture,
  waitForMicrotaskCondition,
} from '@/test/requestTestHelpers'
import { createAuthSessionRuntime, registerTabPermissionResolver, type AuthSessionApi } from './auth.session'
import { registerAuthNavigator } from './authNavigation'

/** 带动作日志与 settings 切片的会话测试 store（settings 用于断言「登出保留 settings」） */
function createSessionTestStore() {
  const actions: UnknownAction[] = []
  const actionLog: Middleware = () => (next) => (action) => {
    actions.push(action as UnknownAction)
    return next(action)
  }
  const store = configureStore({
    reducer: {
      user: userSlice.reducer,
      settings: settingsSlice.reducer,
      app: appSlice.reducer,
      tabs: tabsSlice.reducer,
      pageCache: pageCacheSlice.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(actionLog),
  })
  return {
    store: store as unknown as RequestStore,
    actions,
    countActions(type: string): number {
      return actions.filter((action) => action.type === type).length
    },
  }
}

/** profile 夹具：默认 viewer（含 dashboard:view），可按需覆盖 */
function profileFixture(overrides: Partial<ProfileData> = {}): ProfileData {
  return {
    user: userFixture,
    roleCodes: ['viewer'],
    permCodes: [PERMISSIONS.DASHBOARD_VIEW],
    permissionVersion: 'v1',
    ...overrides,
  }
}

/** 认证接口桩：保留 Mock 断言能力，形状满足 AuthSessionApi */
interface ApiStubs {
  login: Mock<AuthSessionApi['login']>
  logout: Mock<AuthSessionApi['logout']>
  getProfile: Mock<AuthSessionApi['getProfile']>
}

interface SessionContext {
  store: RequestStore
  countActions: (type: string) => number
  api: ApiStubs
  session: ReturnType<typeof createAuthSessionRuntime>
  authNavigator: ReturnType<typeof vi.fn>
  sessionNavigator: ReturnType<typeof vi.fn>
}

function setup(rehydrated: Promise<void> = Promise.resolve()): SessionContext {
  const testStore = createSessionTestStore()
  const api: ApiStubs = {
    login: vi.fn<AuthSessionApi['login']>(),
    logout: vi.fn<AuthSessionApi['logout']>(),
    getProfile: vi.fn<AuthSessionApi['getProfile']>(),
  }
  const session = createAuthSessionRuntime({ store: testStore.store, rehydrated, api })
  const authNavigator = vi.fn()
  registerAuthNavigator(authNavigator)
  const sessionNavigator = vi.fn()
  registerSessionExpiredNavigator(sessionNavigator)
  registerUiFeedbackInstances({ message: { error: vi.fn() } } as unknown as UiFeedbackInstances)
  return {
    store: testStore.store,
    countActions: testStore.countActions,
    api,
    session,
    authNavigator,
    sessionNavigator,
  }
}

/** 播种一个页签与其缓存条目（tabOpened 同时激活该页签） */
function seedTab(store: RequestStore, key: string, pathname: string, affix = false): void {
  store.dispatch(
    tabOpened({
      tab: {
        key,
        title: key,
        affix,
        location: { pathname, search: '', hash: '', key, state: null },
      },
    }) as UnknownAction,
  )
  store.dispatch(cacheEntryTouched({ key }) as UnknownAction)
}

/** 播种 profile 派生数据 */
function seedProfile(store: RequestStore, profile: ProfileData): void {
  store.dispatch(
    profileLoaded({
      user: profile.user,
      roles: profile.roleCodes,
      permCodes: profile.permCodes,
      permissionVersion: profile.permissionVersion,
    }) as UnknownAction,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  registerAuthNavigator(null)
  registerSessionExpiredNavigator(null)
  registerTabPermissionResolver(null)
  resetUiFeedbackInstances()
  window.localStorage.clear()
})

describe('登录状态机（规格 §6.2）', () => {
  it('登录成功：保存双 token 与 real 来源、递增 epoch、经 ensureProfile 写入派生数据并产出 /dashboard 导航意图', async () => {
    const { store, api, session, authNavigator } = setup()
    api.login.mockResolvedValue({ accessToken: 'at-1', refreshToken: 'rt-1', user: userFixture })
    api.getProfile.mockResolvedValue(profileFixture())

    await session.loginWithCredentials({ username: 'admin', password: 'secret' })

    expect(store.getState().user).toMatchObject({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      sessionSource: 'real',
      sessionEpoch: 1,
      user: userFixture,
      roles: ['viewer'],
      permCodes: [PERMISSIONS.DASHBOARD_VIEW],
      permissionVersion: 'v1',
    })
    // profile 经 ensureProfile 单飞拉取：登录后恰好一次
    expect(api.getProfile).toHaveBeenCalledTimes(1)
    // 登录成功产出路由无关导航意图：默认目标为 /dashboard 常量
    expect(ROUTE_FALLBACK_PATH).toBe('/dashboard')
    expect(authNavigator).toHaveBeenCalledTimes(1)
    expect(authNavigator).toHaveBeenCalledWith({ kind: 'post-login', target: ROUTE_FALLBACK_PATH })
  })

  it('登录失败：不保存 token、不拉 profile、无导航意图', async () => {
    const { store, api, session, authNavigator } = setup()
    api.login.mockRejectedValue(
      createApiError({ httpStatus: 401, errorCode: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, message: '凭证错误' }),
    )

    await expect(session.loginWithCredentials({ username: 'admin', password: 'wrong' })).rejects.toMatchObject({
      errorCode: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    })

    expect(store.getState().user.accessToken).toBeNull()
    expect(store.getState().user.sessionEpoch).toBe(0)
    expect(api.getProfile).not.toHaveBeenCalled()
    expect(authNavigator).not.toHaveBeenCalled()
  })

  it('登录成功但 profile 网络失败：token 保留不误清、不产出登录意图', async () => {
    const { store, api, session, authNavigator } = setup()
    api.login.mockResolvedValue({ accessToken: 'at-1', refreshToken: 'rt-1', user: userFixture })
    api.getProfile.mockRejectedValue(createApiError({ message: '网络错误，请求未送达' }))

    await expect(session.loginWithCredentials({ username: 'admin', password: 'secret' })).rejects.toMatchObject({
      message: '网络错误，请求未送达',
    })

    // §6.2 状态机：token 保存先于 profile；profile 网络失败不清理会话
    expect(store.getState().user.accessToken).toBe('at-1')
    expect(authNavigator).not.toHaveBeenCalled()
  })

  it('登录前的空 token 单飞缓存被登录流程重置，登录后重新拉取 profile', async () => {
    const { store, api, session } = setup()
    await expect(session.ensureProfile()).resolves.toBeNull()
    api.login.mockResolvedValue({ accessToken: 'at-1', refreshToken: 'rt-1', user: userFixture })
    api.getProfile.mockResolvedValue(profileFixture())

    await session.loginWithCredentials({ username: 'admin', password: 'secret' })

    expect(api.getProfile).toHaveBeenCalledTimes(1)
    expect(store.getState().user.user).toEqual(userFixture)
  })
})

describe('ensureProfile 启动单飞（规格 §4.3）', () => {
  it('并发调用共享单飞，一次整页启动最多一个 profile 请求；成功结果缓存', async () => {
    const { store, api, session } = setup()
    seedSession(store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    api.getProfile.mockResolvedValue(profileFixture())

    const [first, second, third] = await Promise.all([
      session.ensureProfile(),
      session.ensureProfile(),
      session.ensureProfile(),
    ])
    expect(api.getProfile).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
    expect(third).toBe(first)

    // 成功结果在本次整页启动内缓存：后续调用不再发请求
    await expect(session.ensureProfile()).resolves.toBe(first)
    expect(api.getProfile).toHaveBeenCalledTimes(1)
  })

  it('rehydratedPromise 完成前不读取 token 也不发请求', async () => {
    const gate = deferred<void>()
    const { store, api, session } = setup(gate.promise)
    seedSession(store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    api.getProfile.mockResolvedValue(profileFixture())

    const pending = session.ensureProfile()
    await flushMicrotasks()
    expect(api.getProfile).not.toHaveBeenCalled()

    gate.resolve()
    await expect(pending).resolves.toMatchObject({ permissionVersion: 'v1' })
    expect(api.getProfile).toHaveBeenCalledTimes(1)
  })

  it('无 token 时并发调用共享同一 null 结果且不发请求', async () => {
    const { api, session } = setup()
    const [first, second] = await Promise.all([session.ensureProfile(), session.ensureProfile()])
    expect(first).toBeNull()
    expect(second).toBeNull()
    expect(api.getProfile).not.toHaveBeenCalled()
  })

  it('失败后清除单飞缓存：路由错误页重试可再次发起并成功', async () => {
    const { store, api, session } = setup()
    seedSession(store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    api.getProfile
      .mockRejectedValueOnce(createApiError({ message: '网络错误，请求未送达' }))
      .mockResolvedValueOnce(profileFixture())

    await expect(session.ensureProfile()).rejects.toMatchObject({ message: '网络错误，请求未送达' })
    // 重试语义：网络失败不误清 token（规格 §17.3）
    expect(store.getState().user.accessToken).toBe('at-1')
    await expect(session.ensureProfile()).resolves.toBeTruthy()
    expect(api.getProfile).toHaveBeenCalledTimes(2)
  })
})

describe('会话规则（规格 §4.2/§6.2）', () => {
  it('profile 返回 AUTH_FORBIDDEN：清理会话（含页签/缓存）并发出回登录页导航', async () => {
    const { store, api, session, sessionNavigator } = setup()
    seedSession(store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    seedTab(store, 'tab-dashboard', '/dashboard', true)
    api.getProfile.mockRejectedValue(
      createApiError({ httpStatus: 403, errorCode: API_ERROR_CODES.AUTH_FORBIDDEN, message: '禁用' }),
    )

    await expect(session.ensureProfile()).rejects.toMatchObject({ errorCode: API_ERROR_CODES.AUTH_FORBIDDEN })

    const state = store.getState()
    expect(state.user.accessToken).toBeNull()
    expect(state.user.sessionEpoch).toBeGreaterThan(0)
    expect(state.tabs.items).toHaveLength(0)
    expect(state.pageCache.revisions).toEqual({})
    // 回登录页导航经 sessionCleanup 通道（含同源校验后的 redirect 参数）
    expect(sessionNavigator).toHaveBeenCalledTimes(1)
    expect(sessionNavigator.mock.calls[0][0]).toMatch(/^\/login/)
  })

  it('profile 成功但 hasAuth(dashboard:view) 为 false：清理会话回登录且不写入派生数据', async () => {
    const { store, api, session, sessionNavigator } = setup()
    seedSession(store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    api.getProfile.mockResolvedValue(profileFixture({ roleCodes: ['limited'], permCodes: [] }))

    await expect(session.ensureProfile()).rejects.toMatchObject({ errorCode: API_ERROR_CODES.AUTH_FORBIDDEN })

    const state = store.getState()
    expect(state.user.accessToken).toBeNull()
    expect(state.user.permCodes).toEqual([])
    expect(state.user.user).toBeNull()
    expect(sessionNavigator).toHaveBeenCalledTimes(1)
  })

  it('admin 角色按 * 通配通过会话资格校验', async () => {
    const { store, api, session, sessionNavigator } = setup()
    seedSession(store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    api.getProfile.mockResolvedValue(profileFixture({ roleCodes: ['admin'], permCodes: [] }))

    await expect(session.ensureProfile()).resolves.toBeTruthy()
    expect(store.getState().user.roles).toEqual(['admin'])
    expect(store.getState().user.permCodes).toEqual([])
    expect(sessionNavigator).not.toHaveBeenCalled()
  })

  it('等待期间登出：profile 结果按 epoch 比对丢弃，不回写已清理的新会话（规格 §6.1）', async () => {
    const { store, api, session } = setup()
    seedSession(store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    api.logout.mockResolvedValue(null)
    const gate = deferred<ProfileData>()
    api.getProfile.mockReturnValue(gate.promise)

    const pending = session.ensureProfile()
    await flushMicrotasks()
    expect(api.getProfile).toHaveBeenCalledTimes(1)

    await session.logoutSession()
    gate.resolve(profileFixture())

    await expect(pending).rejects.toMatchObject({ canceled: true })
    expect(store.getState().user.user).toBeNull()
    expect(store.getState().user.accessToken).toBeNull()
  })
})

describe('登出状态机（规格 §6.2）', () => {
  it('先递增 epoch 再提交 refreshToken；成功后 finally 清理认证/页签/缓存并保留 settings，产出回登录意图', async () => {
    const { store, api, session, authNavigator } = setup()
    seedSession(store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    seedProfile(store, profileFixture())
    seedTab(store, 'tab-dashboard', '/dashboard', true)
    seedTab(store, 'tab-user', '/system/user')
    store.dispatch({ type: 'settings/settingsChanged', payload: { breadcrumbEnabled: false } } as UnknownAction)

    let epochAtLogoutCall = -1
    api.logout.mockImplementation(async () => {
      epochAtLogoutCall = store.getState().user.sessionEpoch
      return null
    })

    await session.logoutSession()

    expect(api.logout).toHaveBeenCalledTimes(1)
    expect(api.logout).toHaveBeenCalledWith({ refreshToken: 'rt-1' })
    // 网络提交前 epoch 已递增：阻止旧异步任务回写与在途重放
    expect(epochAtLogoutCall).toBe(1)

    const state = store.getState()
    expect(state.user).toMatchObject({
      accessToken: null,
      refreshToken: null,
      sessionSource: null,
      user: null,
      permCodes: [],
      permissionVersion: null,
    })
    expect(state.user.sessionEpoch).toBeGreaterThan(1)
    // 销毁含 affix 的全部页签与页面缓存
    expect(state.tabs.items).toHaveLength(0)
    expect(state.pageCache.revisions).toEqual({})
    // settings 保留（规格 §6.2）：会话测试 store 在 RequestStateTree 之外附加了 settings 切片
    const stateWithSettings = state as typeof state & { settings: SettingsState }
    expect(stateWithSettings.settings.breadcrumbEnabled).toBe(false)
    // 主动登出回登录页：不携带 redirect 参数
    expect(authNavigator).toHaveBeenCalledTimes(1)
    expect(authNavigator).toHaveBeenCalledWith({ kind: 'post-logout', target: ROUTE_PATHS.LOGIN })
  })

  it('登出请求失败/超时：finally 同样完成本地清理与导航意图', async () => {
    const { store, api, session, authNavigator } = setup()
    seedSession(store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    seedTab(store, 'tab-dashboard', '/dashboard', true)
    api.logout.mockRejectedValue(createApiError({ message: '请求超时，请稍后重试' }))

    await expect(session.logoutSession()).rejects.toMatchObject({ message: '请求超时，请稍后重试' })

    const state = store.getState()
    expect(state.user.accessToken).toBeNull()
    expect(state.tabs.items).toHaveLength(0)
    expect(authNavigator).toHaveBeenCalledWith({ kind: 'post-logout', target: ROUTE_PATHS.LOGIN })
  })

  it('无 refreshToken：跳过网络调用，仅本地清理并回登录', async () => {
    const { store, api, session, authNavigator } = setup()
    await expect(session.logoutSession()).resolves.toBeUndefined()
    expect(api.logout).not.toHaveBeenCalled()
    expect(store.getState().user.accessToken).toBeNull()
    expect(authNavigator).toHaveBeenCalledWith({ kind: 'post-logout', target: ROUTE_PATHS.LOGIN })
  })
})

describe('会话内权限变更闭环（规格 §5.4/§17.6/§17.7）', () => {
  function seedPermissionNarrowedTabs(ctx: SessionContext): void {
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    seedProfile(ctx.store, profileFixture({ permCodes: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SYSTEM_USER_LIST] }))
    seedTab(ctx.store, 'tab-dashboard', '/dashboard', true)
    seedTab(ctx.store, 'tab-user', '/system/user')
    seedTab(ctx.store, 'tab-role', '/system/role')
    ctx.store.dispatch(tabActivated({ key: 'tab-role' }) as UnknownAction)
    registerTabPermissionResolver((pathname) => {
      if (pathname === '/system/user') return [PERMISSIONS.SYSTEM_USER_LIST]
      if (pathname === '/system/role') return [PERMISSIONS.SYSTEM_ROLE_LIST]
      return [PERMISSIONS.DASHBOARD_VIEW]
    })
  }

  it('版本变化：重算派生数据，关闭失权普通页签与缓存，当前页失权产出 /403 导航意图', async () => {
    const ctx = setup()
    seedPermissionNarrowedTabs(ctx)
    ctx.api.getProfile.mockResolvedValue(
      profileFixture({ permCodes: [PERMISSIONS.DASHBOARD_VIEW], permissionVersion: 'v2' }),
    )

    await ctx.session.refreshProfileAfterPermissionChange()

    const state = ctx.store.getState()
    // 权限派生数据重算
    expect(state.user.permissionVersion).toBe('v2')
    expect(state.user.permCodes).toEqual([PERMISSIONS.DASHBOARD_VIEW])
    // 失权普通页签与缓存关闭，affix 保留（规格 §9.3）
    expect(state.tabs.items.map((tab) => tab.key)).toEqual(['tab-dashboard'])
    expect(state.pageCache.revisions).toEqual({ 'tab-dashboard': 0 })
    expect(state.pageCache.lruOrder).toEqual(['tab-dashboard'])
    // 当前页（/system/role）失权：replace('/403') 导航意图
    expect(ctx.authNavigator).toHaveBeenCalledTimes(1)
    expect(ctx.authNavigator).toHaveBeenCalledWith({ kind: 'route-forbidden', target: ROUTE_PATHS.FORBIDDEN })
  })

  it('版本未变：写入最新 profile 但不关闭任何页签、不产出错权意图', async () => {
    const ctx = setup()
    seedPermissionNarrowedTabs(ctx)
    ctx.api.getProfile.mockResolvedValue(
      profileFixture({ permCodes: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SYSTEM_USER_LIST], permissionVersion: 'v1' }),
    )

    await ctx.session.refreshProfileAfterPermissionChange()

    expect(ctx.store.getState().user.permissionVersion).toBe('v1')
    expect(ctx.store.getState().tabs.items).toHaveLength(3)
    expect(ctx.authNavigator).not.toHaveBeenCalled()
  })

  it('未注册页签权限解析器：无法判定路径归属时不关闭页签', async () => {
    const ctx = setup()
    seedSession(ctx.store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    seedProfile(ctx.store, profileFixture({ permCodes: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SYSTEM_USER_LIST] }))
    seedTab(ctx.store, 'tab-user', '/system/user')
    ctx.api.getProfile.mockResolvedValue(
      profileFixture({ permCodes: [PERMISSIONS.DASHBOARD_VIEW], permissionVersion: 'v2' }),
    )

    await ctx.session.refreshProfileAfterPermissionChange()

    expect(ctx.store.getState().user.permissionVersion).toBe('v2')
    expect(ctx.store.getState().tabs.items).toHaveLength(1)
    expect(ctx.authNavigator).not.toHaveBeenCalled()
  })

  it('并发 403 AUTH_PERMISSION_CHANGED 共享一个 profile 请求并完成闭环（经请求运行时集成）', async () => {
    const ctx = setup()
    seedPermissionNarrowedTabs(ctx)
    const adapter = createMockAdapter()
    const runtime = createRequestRuntime(ctx.store, { adapter: adapter.adapter })
    adapter.respondWith(() => ({
      status: 403,
      data: failureEnvelope(1003, API_ERROR_CODES.AUTH_PERMISSION_CHANGED, '权限已变更'),
    }))
    ctx.api.getProfile.mockResolvedValue(
      profileFixture({ permCodes: [PERMISSIONS.DASHBOARD_VIEW], permissionVersion: 'v2' }),
    )

    const results = await Promise.allSettled([
      runtime.request({ url: '/users', silent: true }),
      runtime.request({ url: '/roles', silent: true }),
    ])
    expect(results.every((result) => result.status === 'rejected')).toBe(true)

    // 单飞：两个并发权限变更响应只触发一次 profile 拉取
    await waitForMicrotaskCondition(() => ctx.api.getProfile.mock.calls.length === 1)
    expect(ctx.api.getProfile).toHaveBeenCalledTimes(1)
    // 闭环完成：派生数据重算 + 失权页签关闭 + 403 意图
    await waitForMicrotaskCondition(() => ctx.store.getState().tabs.items.length === 1)
    expect(ctx.store.getState().user.permissionVersion).toBe('v2')
    expect(ctx.store.getState().tabs.items.map((tab) => tab.key)).toEqual(['tab-dashboard'])
    expect(ctx.authNavigator).toHaveBeenCalledWith({ kind: 'route-forbidden', target: ROUTE_PATHS.FORBIDDEN })
  })
})
