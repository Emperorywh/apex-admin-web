import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/types/system/user/user.types'
import { resetPersistRecoveryFailures } from '@/store/persist'
import { appSlice } from '@/store/slices/app.slice'
import { pageCacheSlice } from '@/store/slices/pageCache.slice'
import { settingsChanged, settingsSlice } from '@/store/slices/settings.slice'
import { tabOpened, tabsSlice } from '@/store/slices/tabs.slice'
import { profileLoaded, sessionEpochIncremented, tokensStored, userSlice } from '@/store/slices/user.slice'
import { readThemeBootMirror } from '@/store/themeBootMirror'
import { createAppStore, getDefaultAppStore, type AppStore } from '@/store/store'

const userFixture: User = {
  id: 'u-1',
  username: 'admin',
  displayName: '管理员',
  email: 'admin@example.com',
  status: 'enabled',
  roleIds: ['r-1'],
  createdAt: '2026-08-15T00:00:00+08:00',
  updatedAt: '2026-08-15T00:00:00+08:00',
}

/** 构造 redux-persist 写入端格式的 blob（顶层对象 + 每字段一次 stringify），用于手工播种 */
function buildPersistBlob(fields: Record<string, unknown>, version: number): string {
  const staged: Record<string, string> = {}
  for (const [field, value] of Object.entries(fields)) {
    staged[field] = JSON.stringify(value)
  }
  staged['_persist'] = JSON.stringify({ version, rehydrated: true })
  return JSON.stringify(staged)
}

/** 派发变更并等待 persistoid 落盘与恢复完成，保证对 localStorage 的断言确定 */
async function settle(instance: AppStore): Promise<void> {
  await instance.rehydratedPromise
  await instance.persistor.flush()
}

beforeEach(() => {
  window.localStorage.clear()
  resetPersistRecoveryFailures()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createAppStore 持久化白名单（规格 §8.1/§8.2）', () => {
  it('跨实例往返：user 仅双 token + sessionSource，settings 全量，app 仅 sidebarCollapsed', async () => {
    const first = createAppStore()
    first.store.dispatch(tokensStored({ accessToken: 'at-1', refreshToken: 'rt-1', sessionSource: 'demo' }))
    first.store.dispatch(sessionEpochIncremented())
    first.store.dispatch(
      profileLoaded({ user: userFixture, roles: ['admin'], permCodes: ['dashboard:view'], permissionVersion: 'v1' }),
    )
    first.store.dispatch(settingsChanged({ themeMode: 'dark', colorPrimary: '#13c2c2', language: 'en-US' }))
    first.store.dispatch(appSlice.actions.sidebarCollapsedSet({ collapsed: true }))
    first.store.dispatch(appSlice.actions.fullscreenSet({ fullscreen: true }))
    first.store.dispatch(appSlice.actions.loadingStarted())
    first.store.dispatch(
      tabOpened({
        tab: { key: '/dashboard', title: 'Dashboard', affix: true, location: { pathname: '/dashboard', search: '', hash: '', key: '/dashboard', state: null } },
      }),
    )
    first.store.dispatch(pageCacheSlice.actions.cacheEntryTouched({ key: '/dashboard' }))
    await settle(first)

    // 落盘内容核对：写入端白名单生效
    const userBlob = Object.keys(JSON.parse(window.localStorage.getItem('apex_user') ?? '{}'))
    expect(userBlob.sort()).toEqual(['_persist', 'accessToken', 'refreshToken', 'sessionSource'])
    const appBlob = Object.keys(JSON.parse(window.localStorage.getItem('apex_app') ?? '{}'))
    expect(appBlob.sort()).toEqual(['_persist', 'sidebarCollapsed'])
    const settingsBlob = Object.keys(JSON.parse(window.localStorage.getItem('apex_settings') ?? '{}'))
    expect(settingsBlob.sort()).toEqual([
      '_persist',
      'breadcrumbEnabled',
      'colorPrimary',
      'language',
      'layout',
      'themeMode',
    ])

    const second = createAppStore()
    await second.rehydratedPromise

    const { user } = second.store.getState()
    expect(user.accessToken).toBe('at-1')
    expect(user.refreshToken).toBe('rt-1')
    expect(user.sessionSource).toBe('demo')
    // 未持久化字段回到初始：epoch、用户信息、角色、权限码、权限版本每次启动重取
    expect(user.sessionEpoch).toBe(0)
    expect(user.user).toBeNull()
    expect(user.roles).toEqual([])
    expect(user.permCodes).toEqual([])
    expect(user.permissionVersion).toBeNull()

    const { settings } = second.store.getState()
    // 嵌套 persist 会给切片状态附加 _persist 元数据，用子集断言核对业务字段
    expect(settings).toMatchObject({
      ...settingsSlice.getInitialState(),
      themeMode: 'dark',
      colorPrimary: '#13c2c2',
      language: 'en-US',
    })

    const { app } = second.store.getState()
    expect(app.sidebarCollapsed).toBe(true)
    expect(app.fullscreen).toBe(false)
    expect(app.loadingCount).toBe(0)
    expect(app.initialization).toEqual({ rehydrated: true, recoveryFailed: false })

    // tabs/pageCache 不持久化：恢复为初始空态
    expect(second.store.getState().tabs).toEqual(tabsSlice.getInitialState())
    expect(second.store.getState().pageCache).toEqual(pageCacheSlice.getInitialState())
  })

  it('tabs/pageCache 不注册 persist key：localStorage 无对应键', async () => {
    const instance = createAppStore()
    instance.store.dispatch(
      tabOpened({
        tab: { key: '/system/user', title: '用户管理', affix: false, location: { pathname: '/system/user', search: '', hash: '', key: '/system/user', state: null } },
      }),
    )
    instance.store.dispatch(pageCacheSlice.actions.cacheRevisionBumped({ key: '/system/user' }))
    await settle(instance)

    const persistedKeys = Object.keys(window.localStorage).filter((key) => key.startsWith('apex_'))
    expect(persistedKeys).toContain('apex_user')
    expect(persistedKeys).toContain('apex_settings')
    expect(persistedKeys).toContain('apex_app')
    expect(persistedKeys).not.toContain('apex_tabs')
    expect(persistedKeys).not.toContain('apex_pageCache')
  })
})

describe('rehydratedPromise 启动闸门（规格 §4.3）', () => {
  it('由 persistor bootstrap 回调完成一次，并把恢复结果写入 app 初始化状态', async () => {
    const instance = createAppStore()
    const bootstrapDispatches: boolean[] = []
    instance.store.subscribe(() => {
      bootstrapDispatches.push(instance.store.getState().app.initialization.rehydrated)
    })
    await instance.rehydratedPromise

    expect(instance.store.getState().app.initialization).toEqual({ rehydrated: true, recoveryFailed: false })
    // Promise 只解析一次：重复 await 立即完成且状态不再翻转
    await expect(instance.rehydratedPromise).resolves.toBeUndefined()
    expect(instance.store.getState().app.initialization.rehydrated).toBe(true)
    await instance.persistor.flush()
  })
})

describe('持久化恢复降级（规格 §8.2/§17.22）', () => {
  it('user JSON 损坏：清认证字段、保留可解析界面设置、记录一次诊断、写入恢复失败标记后继续启动', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // 预先播种合法 settings（v1 旧版 blob，含已移除的 fontSize/fontFamily 遗留字段，迁移时丢弃）与损坏的 user
    window.localStorage.setItem(
      'apex_settings',
      buildPersistBlob(
        {
          themeMode: 'dark',
          colorPrimary: '#13c2c2',
          layout: 'side',
          fontSize: 'medium',
          fontFamily: 'system',
          breadcrumbEnabled: true,
          language: 'en-US',
        },
        1,
      ),
    )
    window.localStorage.setItem('apex_user', '{"accessToken":"at-1"') // 截断 JSON

    const instance = createAppStore()
    await instance.rehydratedPromise

    const { user, settings, app } = instance.store.getState()
    expect(user).toMatchObject(userSlice.getInitialState()) // 认证字段全部清空
    expect(settings.themeMode).toBe('dark') // 可解析界面设置保留
    expect(settings.language).toBe('en-US')
    expect(app.initialization).toEqual({ rehydrated: true, recoveryFailed: true }) // 失败标记供外壳一次性提示
    expect(errorSpy).toHaveBeenCalledTimes(1) // 只记录一次诊断
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('持久化恢复降级')
    expect(window.localStorage.getItem('apex_user')).toBeNull() // 损坏数据被清理
    await instance.persistor.flush()
  })

  it('迁移抛错（存储版本高于当前 schema）：该 slice 按空存储降级，其余 slice 正常恢复', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    window.localStorage.setItem(
      'apex_user',
      buildPersistBlob({ accessToken: 'at-9', refreshToken: 'rt-9', sessionSource: 'real' }, 99),
    )
    window.localStorage.setItem('apex_app', buildPersistBlob({ sidebarCollapsed: true }, 1))

    const instance = createAppStore()
    await instance.rehydratedPromise

    expect(instance.store.getState().user).toMatchObject(userSlice.getInitialState())
    expect(instance.store.getState().app.sidebarCollapsed).toBe(true)
    expect(instance.store.getState().app.initialization.recoveryFailed).toBe(true)
    await instance.persistor.flush()
  })

  it('storage 不可用：全部回落默认值、标记恢复失败，且 rehydratedPromise 仍完成（继续启动）', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })

    const instance = createAppStore()
    await expect(instance.rehydratedPromise).resolves.toBeUndefined()

    expect(instance.store.getState().user).toMatchObject(userSlice.getInitialState())
    expect(instance.store.getState().settings).toMatchObject(settingsSlice.getInitialState())
    expect(instance.store.getState().app.initialization).toEqual({ rehydrated: true, recoveryFailed: true })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    // 清空队列：写失败的 persistoid 不应在后续测试中向真实 localStorage 补写陈旧数据
    await instance.persistor.flush()
  })
})

describe('主题启动镜像同步（规格 §8.3）', () => {
  it('创建时写入初始镜像，settings 每次变化同步重写', async () => {
    const instance = createAppStore()
    await instance.rehydratedPromise
    expect(readThemeBootMirror()).toEqual({ mode: 'system', resolvedMode: 'light' })

    instance.store.dispatch(settingsChanged({ themeMode: 'dark' }))
    expect(readThemeBootMirror()).toEqual({ mode: 'dark', resolvedMode: 'dark' })

    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    )
    instance.store.dispatch(settingsChanged({ themeMode: 'system' }))
    expect(readThemeBootMirror()).toEqual({ mode: 'system', resolvedMode: 'dark' })

    // 恢复的 settings 同样驱动镜像：新实例在恢复完成时以恢复值重写镜像
    await instance.persistor.flush()
    const second = createAppStore()
    await second.rehydratedPromise
    expect(readThemeBootMirror()).toEqual({ mode: 'system', resolvedMode: 'dark' })
    await second.persistor.flush()
  })
})

describe('serializableCheck 仅忽略 redux-persist 官方 action（规格 §8.2）', () => {
  it('检查器仍生效：非序列化 payload 触发告警', async () => {
    // RTK serializableStateInvariantMiddleware 通过 console.error 输出告警
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const instance = createAppStore()
    await instance.rehydratedPromise

    instance.store.dispatch({ type: 'test/nonSerializable', payload: () => {} })
    expect(errorSpy.mock.calls.some((call) => String(call[0]).includes('non-serializable'))).toBe(true)
    await instance.persistor.flush()
  })
})

describe('getDefaultAppStore 懒单例', () => {
  it('重复调用返回同一实例（每页只创建一个 persistor）', async () => {
    const first = getDefaultAppStore()
    const second = getDefaultAppStore()
    expect(second).toBe(first)
    first.persistor.pause()
    await first.rehydratedPromise
    expect(first.store.getState().app.initialization.rehydrated).toBe(true)
  })
})
