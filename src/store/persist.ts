/**
 * redux-persist 基础设施（规格 §8.2/§17.22）：slice 级嵌套 persist 配置、字段级白名单、
 * 安全存储适配器与安全迁移包装。
 *
 * 可预测降级语义：JSON 损坏、迁移抛错或 storage 不可用时，对应 slice 回落初始状态
 * （认证字段因此被清空），其他 slice 已通过校验的界面设置照常恢复；
 * 每次失败记录到本页启动周期的降级清单，由 store 启动闸门统一输出一次诊断，
 * 并把恢复失败标记写入 app 初始化状态（规格 §4.3）后继续启动。
 */
import { persistReducer } from 'redux-persist'
import type { PersistConfig, PersistMigrate, PersistedState } from 'redux-persist'
import { SESSION_SOURCES, type SessionSource } from '@/constants/auth/auth.constants'
import { PERSIST_SCHEMA_VERSION, STORAGE_KEY_PREFIX } from '@/constants/storage.constants'
import { appSlice, type AppState } from '@/store/slices/app.slice'
import {
  SETTINGS_FONT_FAMILIES,
  SETTINGS_FONT_SIZES,
  SETTINGS_LANGUAGES,
  SETTINGS_LAYOUTS,
  SETTINGS_THEME_MODES,
  settingsSlice,
  type SettingsFontFamily,
  type SettingsFontSize,
  type SettingsLanguage,
  type SettingsLayout,
  type SettingsState,
  type SettingsThemeMode,
} from '@/store/slices/settings.slice'
import { userSlice, type UserState } from '@/store/slices/user.slice'

/** 持久化恢复降级原因 */
export type PersistRecoveryReason = 'json-corrupt' | 'storage-unavailable' | 'migration-failed' | 'write-failed'

/** 单条持久化恢复降级记录：sliceKey 为 persist key（不含前缀），reason 为降级原因 */
export interface PersistRecoveryFailure {
  readonly sliceKey: string
  readonly reason: PersistRecoveryReason
}

/** 本页启动周期内的降级记录：createAppStore 创建时重置，persistor bootstrap 回调统一消费 */
const recoveryFailures: PersistRecoveryFailure[] = []

export function recordPersistRecoveryFailure(sliceKey: string, reason: PersistRecoveryReason): void {
  recoveryFailures.push({ sliceKey, reason })
}

export function getPersistRecoveryFailures(): readonly PersistRecoveryFailure[] {
  return recoveryFailures
}

export function resetPersistRecoveryFailures(): void {
  recoveryFailures.length = 0
}

/** 底层字符串存储引擎：与 localStorage 同形，便于测试注入 */
export interface RawStorageEngine {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** 解析默认引擎：window.localStorage 属性访问在部分隐私模式下会直接抛出 */
function resolveDefaultEngine(): RawStorageEngine | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 安全持久化存储适配器：满足 redux-persist Storage 的异步契约，返回值一律为 Promise */
export interface SafePersistStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/**
 * 安全持久化存储适配器：包装原始 localStorage，getItem 返回原始字符串
 * （整体 JSON 解析由 redux-persist getStoredState 完成）。
 * 返回值统一包装为 Promise，满足 redux-persist Storage 的异步契约。
 *
 * 读取侧在交还 redux-persist 前提前校验其双层 JSON 结构：
 * 整体必须是对象，且每个字段值必须是已被字符串化的 JSON（写入端的固定格式）。
 * 损坏数据被移除并按 null 处理（slice 回落初始状态）；所有异常都记录为降级，绝不向上抛出。
 */
export function createSafePersistStorage(
  resolveEngine: () => RawStorageEngine | null = resolveDefaultEngine,
): SafePersistStorage {
  return {
    getItem(key: string): Promise<string | null> {
      let engine: RawStorageEngine | null
      try {
        engine = resolveEngine()
      } catch {
        engine = null
      }
      if (!engine) {
        recordPersistRecoveryFailure(key, 'storage-unavailable')
        return Promise.resolve(null)
      }
      let raw: string | null
      try {
        raw = engine.getItem(key)
      } catch {
        recordPersistRecoveryFailure(key, 'storage-unavailable')
        return Promise.resolve(null)
      }
      if (raw === null || raw === undefined) {
        return Promise.resolve(null)
      }
      try {
        const outer: unknown = JSON.parse(raw)
        if (!isRecord(outer)) {
          throw new Error('persist blob 顶层不是对象')
        }
        for (const field of Object.keys(outer)) {
          // 每个字段值必须是写入端序列化得到的 JSON 字符串
          JSON.parse(outer[field] as string)
        }
        return Promise.resolve(raw)
      } catch {
        recordPersistRecoveryFailure(key, 'json-corrupt')
        try {
          engine.removeItem(key)
        } catch {
          // 尽力清理损坏数据，清理失败不放大影响
        }
        return Promise.resolve(null)
      }
    },
    setItem(key: string, value: string): Promise<void> {
      let engine: RawStorageEngine | null
      try {
        engine = resolveEngine()
      } catch {
        engine = null
      }
      if (!engine) {
        recordPersistRecoveryFailure(key, 'write-failed')
        return Promise.resolve()
      }
      try {
        engine.setItem(key, value)
      } catch {
        recordPersistRecoveryFailure(key, 'write-failed')
      }
      return Promise.resolve()
    },
    removeItem(key: string): Promise<void> {
      try {
        resolveEngine()?.removeItem(key)
      } catch {
        // 清理是尽力而为，失败不影响主流程
      }
      return Promise.resolve()
    },
  }
}

/** 主题色持久化格式：六位十六进制（规格 §10.2 自定义取色持久化） */
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/**
 * 从持久化 blob 中取出待校验记录：空存储返回 undefined；
 * 非对象结构、版本元数据非法或存储版本高于当前 schema（拒绝降级迁移）时抛错，
 * 由 createSafeMigrate 统一转为该 slice 的可预测降级。
 */
function readPersistedRecord(state: unknown, currentVersion: number): Record<string, unknown> | undefined {
  if (state === undefined || state === null) {
    return undefined
  }
  if (!isRecord(state)) {
    throw new Error('persisted state 顶层不是对象')
  }
  const persistMeta = state['_persist']
  if (persistMeta !== undefined) {
    if (!isRecord(persistMeta)) {
      throw new Error('_persist 元数据不是对象')
    }
    const storedVersion = persistMeta['version']
    if (storedVersion !== undefined) {
      if (typeof storedVersion !== 'number') {
        throw new Error('_persist.version 不是数字')
      }
      if (storedVersion > currentVersion) {
        throw new Error(`存储版本 ${storedVersion} 高于当前 schema 版本 ${currentVersion}，拒绝降级迁移`)
      }
    }
  }
  return state
}

/** 读取可选的可空字符串字段：缺失返回 undefined（调用方省略该键），null 合法保留，其他类型抛错 */
function readNullableString(record: Record<string, unknown>, field: string): string | null | undefined {
  const value = record[field]
  if (value === undefined) {
    return undefined
  }
  if (value === null || typeof value === 'string') {
    return value
  }
  throw new Error(`字段 ${field} 不是字符串`)
}

/** 读取可选字符串字段：缺失返回 undefined，其余非字符串值（含 null）抛错 */
function readRequiredString(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field]
  if (value === undefined) {
    return undefined
  }
  if (typeof value === 'string') {
    return value
  }
  throw new Error(`字段 ${field} 不是字符串`)
}

/** 读取可选布尔字段 */
function readOptionalBoolean(record: Record<string, unknown>, field: string): boolean | undefined {
  const value = record[field]
  if (value === undefined) {
    return undefined
  }
  if (typeof value === 'boolean') {
    return value
  }
  throw new Error(`字段 ${field} 不是布尔值`)
}

/** 读取可选枚举字段：取值必须在允许集合内 */
function readOptionalEnum<T extends string>(
  record: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T | undefined {
  const value = readRequiredString(record, field)
  if (value === undefined) {
    return undefined
  }
  if (!allowed.includes(value as T)) {
    throw new Error(`字段 ${field} 不在允许取值 ${allowed.join(' | ')} 内`)
  }
  return value as T
}

/** 读取可选的可空枚举字段：初始态会把 null 一并持久化（如 sessionSource），null 合法保留 */
function readNullableEnum<T extends string>(
  record: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T | null | undefined {
  const value = readNullableString(record, field)
  if (value === null || value === undefined) {
    return value
  }
  if (!allowed.includes(value as T)) {
    throw new Error(`字段 ${field} 不在允许取值 ${allowed.join(' | ')} 内`)
  }
  return value as T
}

/** 校验持久化记录不含白名单与 _persist 之外的未知字段（结构漂移即视为不可信数据） */
function assertNoUnknownKeys(record: Record<string, unknown>, knownFields: readonly string[]): void {
  const known = new Set(knownFields)
  for (const field of Object.keys(record)) {
    if (!known.has(field)) {
      throw new Error(`持久化记录包含未知字段 ${field}`)
    }
  }
}

/** 省略值为 undefined 的键，避免把显式 undefined 合并进 slice 状态 */
function omitUndefined<T extends Record<string, unknown>>(fields: T): T {
  const result: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(fields)) {
    if (value !== undefined) {
      result[field] = value
    }
  }
  return result as T
}

/** user slice 持久化白名单：仅双 token + sessionSource（规格 §8.1/§8.2，禁止整 slice 入白名单） */
export const USER_PERSIST_FIELDS = ['accessToken', 'refreshToken', 'sessionSource'] as const

function migrateUserState(state: unknown, currentVersion: number) {
  const record = readPersistedRecord(state, currentVersion)
  if (!record) {
    return undefined
  }
  assertNoUnknownKeys(record, [...USER_PERSIST_FIELDS, '_persist'])
  return omitUndefined({
    accessToken: readNullableString(record, 'accessToken'),
    refreshToken: readNullableString(record, 'refreshToken'),
    sessionSource: readNullableEnum(record, 'sessionSource', Object.values(SESSION_SOURCES) as SessionSource[]),
  })
}

/** settings slice 持久化字段：全量（规格 §8.1） */
export const SETTINGS_PERSIST_FIELDS = [
  'themeMode',
  'colorPrimary',
  'layout',
  'fontSize',
  'fontFamily',
  'breadcrumbEnabled',
  'language',
] as const

function migrateSettingsState(state: unknown, currentVersion: number) {
  const record = readPersistedRecord(state, currentVersion)
  if (!record) {
    return undefined
  }
  assertNoUnknownKeys(record, [...SETTINGS_PERSIST_FIELDS, '_persist'])
  const colorPrimary = readRequiredString(record, 'colorPrimary')
  if (colorPrimary !== undefined && !HEX_COLOR_PATTERN.test(colorPrimary)) {
    throw new Error('字段 colorPrimary 不是六位十六进制主题色')
  }
  return omitUndefined({
    themeMode: readOptionalEnum(record, 'themeMode', Object.values(SETTINGS_THEME_MODES) as SettingsThemeMode[]),
    colorPrimary,
    layout: readOptionalEnum(record, 'layout', Object.values(SETTINGS_LAYOUTS) as SettingsLayout[]),
    fontSize: readOptionalEnum(record, 'fontSize', Object.values(SETTINGS_FONT_SIZES) as SettingsFontSize[]),
    fontFamily: readOptionalEnum(record, 'fontFamily', Object.values(SETTINGS_FONT_FAMILIES) as SettingsFontFamily[]),
    breadcrumbEnabled: readOptionalBoolean(record, 'breadcrumbEnabled'),
    language: readOptionalEnum(record, 'language', Object.values(SETTINGS_LANGUAGES) as SettingsLanguage[]),
  })
}

/** app slice 持久化白名单：仅 sidebarCollapsed（规格 §8.1/§8.2） */
export const APP_PERSIST_FIELDS = ['sidebarCollapsed'] as const

function migrateAppState(state: unknown, currentVersion: number) {
  const record = readPersistedRecord(state, currentVersion)
  if (!record) {
    return undefined
  }
  assertNoUnknownKeys(record, [...APP_PERSIST_FIELDS, '_persist'])
  return omitUndefined({
    sidebarCollapsed: readOptionalBoolean(record, 'sidebarCollapsed'),
  })
}

type SliceMigrateResult = Record<string, unknown> | undefined

/**
 * 安全迁移包装：内部迁移抛错时记录 'migration-failed' 降级并按 undefined（空存储）处理，
 * 使对应 slice 回落初始状态、auth 字段被清空、其余 slice 不受影响；
 * 永不 reject，保证 persistor bootstrap 一定完成（继续启动，规格 §8.2）。
 */
function createSafeMigrate(sliceKey: string, migrate: (state: unknown, currentVersion: number) => SliceMigrateResult): PersistMigrate {
  return (state, currentVersion) => {
    try {
      // 迁移对象由外部存储反序列化而来，此处是唯一的外部数据校验边界
      return Promise.resolve(migrate(state, currentVersion) as PersistedState)
    } catch {
      recordPersistRecoveryFailure(sliceKey, 'migration-failed')
      return Promise.resolve(undefined)
    }
  }
}

const safeStorage = createSafePersistStorage()

/**
 * user 持久化配置：key 经 STORAGE_KEY_PREFIX 前缀落为 apex_user；
 * version 从 PERSIST_SCHEMA_VERSION 起步，结构变化必须升版本并补映射（规格 §8.2）。
 */
export const userPersistConfig: PersistConfig<UserState> = {
  key: 'user',
  keyPrefix: STORAGE_KEY_PREFIX,
  storage: safeStorage,
  version: PERSIST_SCHEMA_VERSION,
  whitelist: [...USER_PERSIST_FIELDS],
  migrate: createSafeMigrate('user', migrateUserState),
}

/** settings 持久化配置：全量持久化，无字段白名单 */
export const settingsPersistConfig: PersistConfig<SettingsState> = {
  key: 'settings',
  keyPrefix: STORAGE_KEY_PREFIX,
  storage: safeStorage,
  version: PERSIST_SCHEMA_VERSION,
  migrate: createSafeMigrate('settings', migrateSettingsState),
}

/** app 持久化配置：仅 sidebarCollapsed，loadingCount/fullscreen/initialization 不持久化 */
export const appPersistConfig: PersistConfig<AppState> = {
  key: 'app',
  keyPrefix: STORAGE_KEY_PREFIX,
  storage: safeStorage,
  version: PERSIST_SCHEMA_VERSION,
  whitelist: [...APP_PERSIST_FIELDS],
  migrate: createSafeMigrate('app', migrateAppState),
}

/** 嵌套 persist 组合：tabs/pageCache 不包装 persistReducer，天然不持久化（规格 §8.1） */
export const persistedReducers = {
  user: persistReducer(userPersistConfig, userSlice.reducer),
  settings: persistReducer(settingsPersistConfig, settingsSlice.reducer),
  app: persistReducer(appPersistConfig, appSlice.reducer),
}
