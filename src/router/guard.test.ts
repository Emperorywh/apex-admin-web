/**
 * 守卫 loader 测试（规格 §4.3）：
 * 启动闸门等待与 ensureProfile 单飞复用、无 token 编码跳登录、权限链 403、
 * 会话被清理后的登录回跳、网络失败上抛、/login 已登录直达与 index 固定重定向。
 */
import { configureStore } from '@reduxjs/toolkit'
import { describe, expect, it, vi } from 'vitest'
import { ROUTE_FALLBACK_PATH, ROUTE_PATHS } from '@/constants/route.constants'
import type { ProfileData } from '@/types/auth/auth.types'
import { authCleared, profileLoaded, tokensStored, userSlice } from '@/store/slices/user.slice'
import { appSlice } from '@/store/slices/app.slice'
import { pageCacheSlice } from '@/store/slices/pageCache.slice'
import { tabsSlice } from '@/store/slices/tabs.slice'
import { settingsSlice } from '@/store/slices/settings.slice'
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router'
import {
  createIndexRedirectLoader,
  createLoginRouteLoader,
  createProtectedRouteLoader,
  type RouteGuardDeps,
} from './guard'

/** 构造测试 store：只装配守卫读取的切片 */
function createGuardTestStore() {
  return configureStore({
    reducer: {
      user: userSlice.reducer,
      settings: settingsSlice.reducer,
      app: appSlice.reducer,
      tabs: tabsSlice.reducer,
      pageCache: pageCacheSlice.reducer,
    },
  })
}

type GuardTestStore = ReturnType<typeof createGuardTestStore>

/** 测试依赖：立即完成的启动闸门 + 受控 ensureProfile 桩 */
function createDeps(overrides: Partial<RouteGuardDeps> & { store: GuardTestStore }): RouteGuardDeps {
  return {
    rehydrated: Promise.resolve(),
    ensureProfile: async () => null,
    ...overrides,
  }
}

const profileFixture: ProfileData = {
  user: {
    id: 'u-1',
    username: 'admin',
    displayName: '管理员',
    email: 'admin@example.com',
    status: 'enabled',
    roleIds: ['r-1'],
    createdAt: '2026-08-15T00:00:00+08:00',
    updatedAt: '2026-08-15T00:00:00+08:00',
  },
  roleCodes: ['admin'],
  permCodes: ['dashboard:view'],
  permissionVersion: 'v1',
}

/** 调用 loader：以完整 URL 构造最小 LoaderFunctionArgs（v8 含 url/pattern/context 扩展字段，测试只填 request） */
async function callLoader(loader: LoaderFunction, url: string): Promise<unknown> {
  return loader({ request: new Request(url) } as LoaderFunctionArgs, undefined as never)
}

/** 解析 replace() 返回的 Response Location 头 */
function redirectLocation(result: unknown): string {
  const response = result as Response | undefined
  expect(response).toBeInstanceOf(Response)
  return response!.headers.get('Location') ?? ''
}

describe('createProtectedRouteLoader（规格 §4.3）', () => {
  it('先等待 rehydratedPromise 再读取 token：闸门未完成时不跳登录', async () => {
    const store = createGuardTestStore()
    store.dispatch(tokensStored({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }))
    let releaseRehydrated!: () => void
    const rehydrated = new Promise<void>((resolve) => {
      releaseRehydrated = resolve
    })
    const ensureProfile = vi.fn(async () => profileFixture)
    const loader = createProtectedRouteLoader(() => createDeps({ store, rehydrated, ensureProfile }), [])
    const pending = callLoader(loader, 'http://localhost/system/user?id=1')
    // 闸门未放行：loader 仍挂起，未调用 ensureProfile，也未误跳登录
    await Promise.resolve()
    expect(ensureProfile).not.toHaveBeenCalled()
    releaseRehydrated()
    const result = await pending
    expect(result).toBeUndefined()
    expect(ensureProfile).toHaveBeenCalledTimes(1)
  })

  it('无 token：URLSearchParams#set 一次性编码 pathname+search+hash 跳 /login', async () => {
    const store = createGuardTestStore()
    const loader = createProtectedRouteLoader(() => createDeps({ store }), [])
    const response = await callLoader(loader, 'http://localhost/system/user?id=1#frag')
    const location = redirectLocation(response)
    expect(location.startsWith(`${ROUTE_PATHS.LOGIN}?`)).toBe(true)
    // 解码一次后还原完整地址；编码由 URLSearchParams#set 完成（不重复编码）
    const params = new URLSearchParams(location.slice(ROUTE_PATHS.LOGIN.length + 1))
    expect(params.get('redirect')).toBe('/system/user?id=1#frag')
  })

  it('有 token 且权限链满足：loader 通过，不发任何重定向', async () => {
    const store = createGuardTestStore()
    store.dispatch(
      tokensStored({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }),
    )
    // 生产语义：ensureProfile 成功时已把 profile 派发进 store，守卫从 store 读取权限快照
    const ensureProfile = async () => {
      store.dispatch(
        profileLoaded({ user: profileFixture.user, roles: profileFixture.roleCodes, permCodes: profileFixture.permCodes, permissionVersion: profileFixture.permissionVersion }),
      )
      return profileFixture
    }
    const loader = createProtectedRouteLoader(() => createDeps({ store, ensureProfile }), ['dashboard:view'])
    const result = await callLoader(loader, 'http://localhost/dashboard')
    expect(result).toBeUndefined()
  })

  it('权限链任一不满足：replace /403（祖先与叶子 AND 语义）', async () => {
    const store = createGuardTestStore()
    store.dispatch(tokensStored({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }))
    store.dispatch(profileLoaded({ user: profileFixture.user, roles: ['viewer'], permCodes: ['dashboard:view'], permissionVersion: 'v1' }))
    const loader = createProtectedRouteLoader(
      () => createDeps({ store }),
      ['dashboard:view', 'system:role:list'],
    )
    const response = await callLoader(loader, 'http://localhost/system/role')
    expect(redirectLocation(response)).toBe(ROUTE_PATHS.FORBIDDEN)
  })

  it('profile 期间会话被清理（token 清空）：按未登录跳登录并携带当前地址', async () => {
    const store = createGuardTestStore()
    store.dispatch(tokensStored({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }))
    const ensureProfile = async () => {
      store.dispatch(authCleared())
      throw new Error('AUTH_FORBIDDEN 会话清理')
    }
    const loader = createProtectedRouteLoader(() => createDeps({ store, ensureProfile }), [])
    const response = await callLoader(loader, 'http://localhost/system/menu')
    const location = redirectLocation(response)
    expect(location.startsWith(`${ROUTE_PATHS.LOGIN}?`)).toBe(true)
    expect(new URLSearchParams(location.split('?')[1]).get('redirect')).toBe('/system/menu')
  })

  it('profile 网络失败且会话仍在：原样上抛，由路由错误边界承接（不误判未登录）', async () => {
    const store = createGuardTestStore()
    store.dispatch(tokensStored({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }))
    const ensureProfile = async () => {
      throw new Error('network down')
    }
    const loader = createProtectedRouteLoader(() => createDeps({ store, ensureProfile }), [])
    await expect(callLoader(loader, 'http://localhost/dashboard')).rejects.toThrow('network down')
  })

  it('父子并行 loader 调用同一 ensureProfile：底层 profile 请求只发一次（单飞契约）', async () => {
    const store = createGuardTestStore()
    store.dispatch(tokensStored({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }))
    // 模拟 auth.session 的单飞 ensureProfile：并发调用共享同一 Promise，底层请求只发一次
    let requestCount = 0
    let flight: Promise<ProfileData | null> | null = null
    const ensureProfile = vi.fn(() => {
      if (flight === null) {
        requestCount += 1
        flight = Promise.resolve(profileFixture)
      }
      return flight
    })
    const deps = createDeps({ store, ensureProfile })
    const parent = createProtectedRouteLoader(() => deps, [])
    const child = createProtectedRouteLoader(() => deps, ['dashboard:view'])
    await Promise.all([callLoader(parent, 'http://localhost/dashboard'), callLoader(child, 'http://localhost/dashboard')])
    expect(requestCount).toBe(1)
  })
})

describe('createLoginRouteLoader（规格 §4.3）', () => {
  it('无 token：显示登录页（loader 返回 undefined）', async () => {
    const store = createGuardTestStore()
    const loader = createLoginRouteLoader(() => createDeps({ store }))
    const result = await callLoader(loader, 'http://localhost/login')
    expect(result).toBeUndefined()
  })

  it('有 token 且认证有效：replace 合法 redirect 参数地址', async () => {
    const store = createGuardTestStore()
    store.dispatch(tokensStored({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }))
    const loader = createLoginRouteLoader(() => createDeps({ store, ensureProfile: async () => profileFixture }))
    const response = await callLoader(loader, 'http://localhost/login?redirect=%2Fsystem%2Fuser%3Fid%3D1')
    expect(redirectLocation(response)).toBe('/system/user?id=1')
  })

  it('redirect 参数非法：回退 /dashboard（五步同源校验）', async () => {
    const store = createGuardTestStore()
    store.dispatch(tokensStored({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }))
    const loader = createLoginRouteLoader(() => createDeps({ store, ensureProfile: async () => profileFixture }))
    const response = await callLoader(loader, 'http://localhost/login?redirect=%2F%2Fevil.example')
    expect(redirectLocation(response)).toBe(ROUTE_FALLBACK_PATH)
  })

  it('token 无效并完成清理：继续显示登录页', async () => {
    const store = createGuardTestStore()
    store.dispatch(tokensStored({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }))
    const ensureProfile = async () => {
      store.dispatch(authCleared())
      throw new Error('AUTH_FORBIDDEN')
    }
    const loader = createLoginRouteLoader(() => createDeps({ store, ensureProfile }))
    const result = await callLoader(loader, 'http://localhost/login')
    expect(result).toBeUndefined()
  })

  it('网络失败且会话仍在：原样上抛（登录页不做未登录误判）', async () => {
    const store = createGuardTestStore()
    store.dispatch(tokensStored({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }))
    const loader = createLoginRouteLoader(() => createDeps({ store, ensureProfile: async () => { throw new Error('network down') } }))
    await expect(callLoader(loader, 'http://localhost/login')).rejects.toThrow('network down')
  })
})

describe('createIndexRedirectLoader（规格 §4.2）', () => {
  it('受保护 index route 固定 replace /dashboard', async () => {
    const response = await callLoader(createIndexRedirectLoader(), 'http://localhost/')
    expect(redirectLocation(response)).toBe(ROUTE_PATHS.DASHBOARD)
  })
})
