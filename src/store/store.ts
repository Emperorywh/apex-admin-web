/**
 * Redux store 装配：auth/settings 字段级持久化，tabs 不持久化。
 */

import { configureStore } from '@reduxjs/toolkit'
import { persistReducer, persistStore } from 'redux-persist'
import { readStoredLanguage } from '@/i18n/i18n'
import authReducer, { initialAuthState } from '@/store/slices/authSlice'
import settingsReducer from '@/store/slices/settingsSlice'
import type { SettingsState } from '@/store/slices/settingsSlice'
import tabsReducer from '@/store/slices/tabsSlice'

/** redux-persist 持久化 key（统一前缀 apex-admin） */
const PERSIST_KEYS = {
  AUTH: 'apex-admin:auth',
  SETTINGS: 'apex-admin:settings',
} as const

/** 持久化 schema 版本；结构不兼容变更时递增并补 migration（auth/settings 各自独立） */
const AUTH_SCHEMA_VERSION = 2
const SETTINGS_SCHEMA_VERSION = 1

/**
 * redux-persist 的 localStorage 适配器。
 * 不使用 redux-persist/lib/storage：其 CJS 默认导出在 Vite ESM 互操作下会解析为模块对象。
 * redux-persist 要求各方法返回 Promise。
 */
const localStorageAdapter = {
  getItem: (key: string): Promise<string | null> => Promise.resolve(localStorage.getItem(key)),
  setItem: (key: string, value: string): Promise<void> =>
    Promise.resolve(localStorage.setItem(key, value)),
  removeItem: (key: string): Promise<void> => Promise.resolve(localStorage.removeItem(key)),
}

/**
 * auth 持久化：会话整体（token/激活/用户/角色/权限）持久化，
 * 刷新页面或重启浏览器可恢复前端会话上下文；不存密码（规格 5.2）。
 * v2：模板直通登录时代的旧会话（仅 user 字段、伪造管理员）全部废弃，
 * 迁移为未登录初始态，强制以真实登录重建会话。
 */
const persistedAuth = persistReducer(
  {
    key: PERSIST_KEYS.AUTH,
    storage: localStorageAdapter,
    version: AUTH_SCHEMA_VERSION,
    whitelist: ['token', 'activated', 'user', 'roles', 'permissions', 'permissionsTree'],
    /**
     * 版本迁移（v2 起）：redux-persist 的自定义 migrate 在每次 rehydrate 都会执行
     * （并非仅版本不匹配时），因此必须按存储版本分流——
     * 低于 v2 的旧结构（模板伪会话）重置为未登录初始态；v2 会话原样恢复。
     * 此前无条件重置导致刷新后持久化会话被丢弃（T00.4 联调发现并修复）。
     */
    migrate: (state, version) => {
      const storedVersion = state?._persist?.version ?? version
      if (storedVersion < AUTH_SCHEMA_VERSION) {
        // 旧版本结构不兼容：重置为未登录初始态，保留 _persist 元数据继续流程
        return Promise.resolve({
          ...initialAuthState,
          _persist: state?._persist ?? { version: AUTH_SCHEMA_VERSION, rehydrated: false },
        })
      }
      // 当前版本：原样恢复持久化会话（字段以 whitelist 为准）
      return Promise.resolve(state)
    },
  },
  authReducer,
)

/**
 * 字段级白名单：settings 持久化 locale 与 theme。
 * 恢复路径统一收敛（T00.8）：
 * - locale 以独立语言 key（apex-admin:lang）为单一真相源——readStoredLanguage
 *   内含 normalizeLanguage（旧值/非法值归一化）与 umi_locale 一次迁移，
 *   持久化切片里的 locale 只是运行时镜像；若直接恢复镜像值，会在旧 key
 *   刚迁移、镜像仍存旧语言时把 App effect 拉回旧语言，覆盖迁移结果。
 * - theme 异常时回退亮色。
 */
const persistedSettings = persistReducer(
  {
    key: PERSIST_KEYS.SETTINGS,
    storage: localStorageAdapter,
    version: SETTINGS_SCHEMA_VERSION,
    whitelist: ['locale', 'theme'],
    migrate: (state) => {
      const restored = (state ?? {}) as Partial<SettingsState>
      return Promise.resolve({
        locale: readStoredLanguage(),
        theme: restored.theme ?? 'light',
        _persist: state?._persist ?? { version: SETTINGS_SCHEMA_VERSION, rehydrated: false },
      })
    },
  },
  settingsReducer,
)

export const store = configureStore({
  reducer: {
    auth: persistedAuth,
    settings: persistedSettings,
    tabs: tabsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // redux-persist 的非函数值会触发序列化检查，显式放宽
      serializableCheck: false,
    }),
})

export const persistor = persistStore(store)

/**
 * 等待 redux-persist 完成 rehydrate。
 * createBrowserRouter 在模块初始化期即执行初始导航并运行守卫 loader，
 * 此刻 rehydrate 尚未完成；守卫必须先等待本 promise 再读取登录态，
 * 否则硬刷新会被误判为未登录而弹回登录页。
 */
export const persistRehydrated = new Promise<void>((resolve) => {
  const check = (): void => {
    if (store.getState().auth._persist?.rehydrated === true) {
      unsubscribe()
      resolve()
    }
  }
  const unsubscribe = store.subscribe(check)
  check()
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
