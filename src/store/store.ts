/**
 * Redux store 装配：auth/settings 字段级持久化，tabs 不持久化。
 */

import { configureStore } from '@reduxjs/toolkit'
import { persistReducer, persistStore } from 'redux-persist'
import authReducer from '@/store/slices/authSlice'
import settingsReducer from '@/store/slices/settingsSlice'
import tabsReducer from '@/store/slices/tabsSlice'

/** redux-persist 持久化 key（统一前缀 apex-admin） */
const PERSIST_KEYS = {
  AUTH: 'apex-admin:auth',
  SETTINGS: 'apex-admin:settings',
} as const

/** 持久化 schema 版本；结构不兼容变更时递增并补 migration */
const PERSIST_SCHEMA_VERSION = 1

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

/** 认证域独立版本：v1 为模板 user 形状，v2 起为旧协议 identity 快照，跨版本丢弃 */
const AUTH_PERSIST_SCHEMA_VERSION = 2

/**
 * 字段级白名单：auth 只持久化 identity（唯一身份快照的非敏感部分）。
 * token 不进 Redux/持久化（由 identity.storage 管理）；epoch/restored 是
 * 会话内运行时状态，每次启动由恢复流程重建，不持久化。
 * 旧版本（模板 /users/me 形状）的持久化数据不兼容，迁移时整体丢弃：
 * 真实会话以 localStorage accessInfo + detail 核查恢复，不依赖该缓存。
 */
const persistedAuth = persistReducer(
  {
    key: PERSIST_KEYS.AUTH,
    storage: localStorageAdapter,
    version: AUTH_PERSIST_SCHEMA_VERSION,
    whitelist: ['identity'],
    // 仅版本不一致时触发：清空旧形状负载，_persist 由 redux-persist 重新附加
    migrate: (state) => Promise.resolve({ ...state, identity: undefined } as typeof state),
  },
  authReducer,
)

/** 字段级白名单：settings 持久化 locale 与 theme */
const persistedSettings = persistReducer(
  {
    key: PERSIST_KEYS.SETTINGS,
    storage: localStorageAdapter,
    version: PERSIST_SCHEMA_VERSION,
    whitelist: ['locale', 'theme'],
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
