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

/** 字段级白名单：auth 只持久化 user（令牌只在内存） */
const persistedAuth = persistReducer(
  {
    key: PERSIST_KEYS.AUTH,
    storage: localStorageAdapter,
    version: PERSIST_SCHEMA_VERSION,
    whitelist: ['user'],
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

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
