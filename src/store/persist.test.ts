import { beforeEach, describe, expect, it } from 'vitest'
import type { PersistMigrate } from 'redux-persist'
import {
  APP_PERSIST_FIELDS,
  SETTINGS_PERSIST_FIELDS,
  USER_PERSIST_FIELDS,
  appPersistConfig,
  createSafePersistStorage,
  getPersistRecoveryFailures,
  recordPersistRecoveryFailure,
  resetPersistRecoveryFailures,
  settingsPersistConfig,
  userPersistConfig,
  type RawStorageEngine,
} from '@/store/persist'

/**
 * 构造 redux-persist 写入端格式的持久化 blob：
 * 顶层对象 + 每个字段值为一次 JSON.stringify 的结果（双层结构）。
 */
function buildPersistBlob(fields: Record<string, unknown>, version: number): string {
  const staged: Record<string, string> = {}
  for (const [field, value] of Object.entries(fields)) {
    staged[field] = JSON.stringify(value)
  }
  staged['_persist'] = JSON.stringify({ version, rehydrated: true })
  return JSON.stringify(staged)
}

/**
 * 还原 redux-persist getStoredState 交给 migrate 的状态形状：
 * 顶层 JSON.parse 之后再逐字段反序列化一次（双层解码）。
 * 返回值对齐 PersistMigrate 入参（外部数据校验边界，用一次受控断言完成类型对接）。
 */
function decodePersistBlob(blob: string): PersistMigrateState {
  const raw: Record<string, string> = JSON.parse(blob)
  const decoded: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(raw)) {
    decoded[field] = JSON.parse(value)
  }
  return decoded as PersistMigrateState
}

/** 可编程内存引擎：模拟 localStorage，可按需抛错 */
function createMemoryEngine(): RawStorageEngine & {
  store: Map<string, string>
  failGetItem: (key: string) => void
  failSetItem: () => void
  failRemoveItem: () => void
} {
  const store = new Map<string, string>()
  const getItemFailures = new Set<string>()
  let setItemFails = false
  let removeItemFails = false
  return {
    store,
    failGetItem(key: string) {
      getItemFailures.add(key)
    },
    failSetItem() {
      setItemFails = true
    },
    failRemoveItem() {
      removeItemFails = true
    },
    getItem(key: string) {
      if (getItemFailures.has(key)) throw new Error('getItem denied')
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      if (setItemFails) throw new Error('setItem denied')
      store.set(key, value)
    },
    removeItem(key: string) {
      if (removeItemFails) throw new Error('removeItem denied')
      store.delete(key)
    },
  }
}

const validUserBlob = buildPersistBlob({ accessToken: 'at-1', refreshToken: 'rt-1', sessionSource: 'demo' }, 1)

/** migrate 入参类型：来自外部存储的未知形状数据 */
type PersistMigrateState = Parameters<PersistMigrate>[0]

describe('持久化降级记录器', () => {
  beforeEach(() => {
    resetPersistRecoveryFailures()
  })

  it('记录、读取与重置', () => {
    recordPersistRecoveryFailure('user', 'json-corrupt')
    recordPersistRecoveryFailure('app', 'write-failed')
    expect(getPersistRecoveryFailures()).toEqual([
      { sliceKey: 'user', reason: 'json-corrupt' },
      { sliceKey: 'app', reason: 'write-failed' },
    ])
    resetPersistRecoveryFailures()
    expect(getPersistRecoveryFailures()).toEqual([])
  })
})

describe('createSafePersistStorage 安全存储适配器', () => {
  beforeEach(() => {
    resetPersistRecoveryFailures()
  })

  it('合法 blob（双层 JSON）原样返回原始字符串，交由 redux-persist 自行反序列化', async () => {
    const engine = createMemoryEngine()
    engine.store.set('apex_user', validUserBlob)
    const storage = createSafePersistStorage(() => engine)
    expect(await storage.getItem('apex_user')).toBe(validUserBlob)
    expect(getPersistRecoveryFailures()).toEqual([])
  })

  it('键不存在时返回 null 且不记录降级', async () => {
    const storage = createSafePersistStorage(() => createMemoryEngine())
    expect(await storage.getItem('apex_user')).toBeNull()
    expect(getPersistRecoveryFailures()).toEqual([])
  })

  it('整体 JSON 损坏：记录 json-corrupt、移除损坏键并返回 null', async () => {
    const engine = createMemoryEngine()
    engine.store.set('apex_user', '{"accessToken":"at-1"') // 截断的 JSON
    const storage = createSafePersistStorage(() => engine)
    expect(await storage.getItem('apex_user')).toBeNull()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'apex_user', reason: 'json-corrupt' }])
    expect(engine.store.has('apex_user')).toBe(false)
  })

  it('顶层不是对象：按损坏处理', async () => {
    const engine = createMemoryEngine()
    engine.store.set('apex_user', '123')
    const storage = createSafePersistStorage(() => engine)
    expect(await storage.getItem('apex_user')).toBeNull()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'apex_user', reason: 'json-corrupt' }])
  })

  it('字段值不是合法 JSON 字符串（单层格式/被篡改）：按损坏处理', async () => {
    const engine = createMemoryEngine()
    engine.store.set('apex_user', '{"accessToken":"at-1"}')
    const storage = createSafePersistStorage(() => engine)
    expect(await storage.getItem('apex_user')).toBeNull()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'apex_user', reason: 'json-corrupt' }])
  })

  it('引擎不可用（localStorage 访问抛出）：记录 storage-unavailable 并返回 null', async () => {
    const storage = createSafePersistStorage(() => {
      throw new Error('localStorage denied')
    })
    expect(await storage.getItem('apex_user')).toBeNull()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'apex_user', reason: 'storage-unavailable' }])
  })

  it('getItem 抛出：记录 storage-unavailable 并返回 null', async () => {
    const engine = createMemoryEngine()
    engine.failGetItem('apex_user')
    const storage = createSafePersistStorage(() => engine)
    expect(await storage.getItem('apex_user')).toBeNull()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'apex_user', reason: 'storage-unavailable' }])
  })

  it('setItem 抛出或引擎不可用：记录 write-failed，不向上抛出', () => {
    const engine = createMemoryEngine()
    engine.failSetItem()
    const storage = createSafePersistStorage(() => engine)
    expect(() => void storage.setItem('apex_user', validUserBlob)).not.toThrow()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'apex_user', reason: 'write-failed' }])

    resetPersistRecoveryFailures()
    const noEngine = createSafePersistStorage(() => null)
    expect(() => void noEngine.setItem('apex_user', validUserBlob)).not.toThrow()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'apex_user', reason: 'write-failed' }])
  })

  it('removeItem 抛出时静默吞掉', () => {
    const engine = createMemoryEngine()
    engine.failRemoveItem()
    const storage = createSafePersistStorage(() => engine)
    expect(() => void storage.removeItem('apex_user')).not.toThrow()
    expect(getPersistRecoveryFailures()).toEqual([])
  })
})

describe('安全迁移：user slice', () => {
  beforeEach(() => {
    resetPersistRecoveryFailures()
  })

  it('空存储（undefined）与无字段 blob 都按空迁移处理', async () => {
    await expect(userPersistConfig.migrate!(undefined, 1)).resolves.toBeUndefined()
    await expect(userPersistConfig.migrate!(decodePersistBlob(buildPersistBlob({}, 1)), 1)).resolves.toEqual({})
    expect(getPersistRecoveryFailures()).toEqual([])
  })

  it('合法数据返回白名单字段，null token 原样保留', async () => {
    const blob = buildPersistBlob({ accessToken: null, refreshToken: null, sessionSource: null }, 1)
    await expect(userPersistConfig.migrate!(decodePersistBlob(blob), 1)).resolves.toEqual({
      accessToken: null,
      refreshToken: null,
      sessionSource: null,
    })
  })

  it('字段类型非法（token 非字符串）抛错被包装：记录 migration-failed 并返回 undefined', async () => {
    const blob = buildPersistBlob({ accessToken: 123, refreshToken: 'rt', sessionSource: 'real' }, 1)
    await expect(userPersistConfig.migrate!(decodePersistBlob(blob), 1)).resolves.toBeUndefined()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'user', reason: 'migration-failed' }])
  })

  it('sessionSource 非法取值：按迁移失败降级', async () => {
    const blob = buildPersistBlob({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'ghost' }, 1)
    await expect(userPersistConfig.migrate!(decodePersistBlob(blob), 1)).resolves.toBeUndefined()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'user', reason: 'migration-failed' }])
  })

  it('未知字段（结构漂移）按不可信数据降级', async () => {
    const blob = buildPersistBlob({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real', user: {} }, 1)
    await expect(userPersistConfig.migrate!(decodePersistBlob(blob), 1)).resolves.toBeUndefined()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'user', reason: 'migration-failed' }])
  })

  it('存储版本高于当前 schema（降级运行旧代码）：拒绝迁移并降级', async () => {
    const blob = buildPersistBlob({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }, 99)
    await expect(userPersistConfig.migrate!(decodePersistBlob(blob), 1)).resolves.toBeUndefined()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'user', reason: 'migration-failed' }])
  })

  it('白名单只含双 token 与 sessionSource（规格 §8.1/§8.2）', () => {
    expect(USER_PERSIST_FIELDS).toEqual(['accessToken', 'refreshToken', 'sessionSource'])
    expect(userPersistConfig.key).toBe('user')
    expect(userPersistConfig.keyPrefix).toBe('apex_')
    expect(userPersistConfig.version).toBe(1)
  })
})

describe('安全迁移：settings slice', () => {
  beforeEach(() => {
    resetPersistRecoveryFailures()
  })

  it('合法全量设置原样返回', async () => {
    const blob = buildPersistBlob(
      {
        themeMode: 'dark',
        colorPrimary: '#13c2c2',
        layout: 'top',
        fontSize: 'large',
        fontFamily: 'serif',
        breadcrumbEnabled: false,
        language: 'en-US',
      },
      1,
    )
    await expect(settingsPersistConfig.migrate!(decodePersistBlob(blob), 1)).resolves.toEqual({
      themeMode: 'dark',
      colorPrimary: '#13c2c2',
      layout: 'top',
      fontSize: 'large',
      fontFamily: 'serif',
      breadcrumbEnabled: false,
      language: 'en-US',
    })
    expect(getPersistRecoveryFailures()).toEqual([])
  })

  it('部分字段缺失：缺失键被省略，恢复时由默认值兜底', async () => {
    const blob = buildPersistBlob({ themeMode: 'dark' }, 1)
    await expect(settingsPersistConfig.migrate!(decodePersistBlob(blob), 1)).resolves.toEqual({ themeMode: 'dark' })
  })

  it('非法主题色 / 非法枚举取值 / 非法布尔：按迁移失败降级', async () => {
    const badColor = buildPersistBlob({ colorPrimary: 'red' }, 1)
    await expect(settingsPersistConfig.migrate!(decodePersistBlob(badColor), 1)).resolves.toBeUndefined()

    const badMode = buildPersistBlob({ themeMode: 'pink' }, 1)
    await expect(settingsPersistConfig.migrate!(decodePersistBlob(badMode), 1)).resolves.toBeUndefined()

    const badBoolean = buildPersistBlob({ breadcrumbEnabled: 'yes' }, 1)
    await expect(settingsPersistConfig.migrate!(decodePersistBlob(badBoolean), 1)).resolves.toBeUndefined()

    expect(getPersistRecoveryFailures()).toEqual([
      { sliceKey: 'settings', reason: 'migration-failed' },
      { sliceKey: 'settings', reason: 'migration-failed' },
      { sliceKey: 'settings', reason: 'migration-failed' },
    ])
  })

  it('settings 全量持久化：字段清单覆盖 §8.1 全部七项，无白名单裁剪', () => {
    expect(SETTINGS_PERSIST_FIELDS).toEqual([
      'themeMode',
      'colorPrimary',
      'layout',
      'fontSize',
      'fontFamily',
      'breadcrumbEnabled',
      'language',
    ])
    expect(settingsPersistConfig.whitelist).toBeUndefined()
    expect(settingsPersistConfig.key).toBe('settings')
  })
})

describe('安全迁移：app slice', () => {
  beforeEach(() => {
    resetPersistRecoveryFailures()
  })

  it('合法 sidebarCollapsed 原样返回；非法类型降级', async () => {
    const blob = buildPersistBlob({ sidebarCollapsed: true }, 1)
    await expect(appPersistConfig.migrate!(decodePersistBlob(blob), 1)).resolves.toEqual({ sidebarCollapsed: true })

    const bad = buildPersistBlob({ sidebarCollapsed: 'yes' }, 1)
    await expect(appPersistConfig.migrate!(decodePersistBlob(bad), 1)).resolves.toBeUndefined()
    expect(getPersistRecoveryFailures()).toEqual([{ sliceKey: 'app', reason: 'migration-failed' }])
  })

  it('白名单只含 sidebarCollapsed（loadingCount/fullscreen/initialization 不持久化）', () => {
    expect(APP_PERSIST_FIELDS).toEqual(['sidebarCollapsed'])
    expect(appPersistConfig.whitelist).toEqual(['sidebarCollapsed'])
    expect(appPersistConfig.key).toBe('app')
  })
})
