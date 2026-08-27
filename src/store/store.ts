/**
 * Redux store 装配：auth/settings 字段级持久化，tabs 不持久化。
 */

import { configureStore } from '@reduxjs/toolkit'
import { persistReducer, persistStore } from 'redux-persist'
import { PERSIST_KEYS, PERSIST_SCHEMA_VERSION } from '@/constants/storage.constants'
import authReducer from '@/store/slices/authSlice'
import settingsReducer from '@/store/slices/settingsSlice'
import tabsReducer from '@/store/slices/tabsSlice'

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

/** 字段级白名单：auth 只持久化 user/permissions（令牌只在内存） */
const persistedAuth = persistReducer(
  {
    key: PERSIST_KEYS.AUTH,
    storage: localStorageAdapter,
    version: PERSIST_SCHEMA_VERSION,
    whitelist: ['user', 'permissions'],
  },
  authReducer,
)

/** 字段级白名单：settings 只持久化 locale */
const persistedSettings = persistReducer(
  {
    key: PERSIST_KEYS.SETTINGS,
    storage: localStorageAdapter,
    version: PERSIST_SCHEMA_VERSION,
    whitelist: ['locale'],
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
