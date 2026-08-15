/**
 * 应用级 Redux store（规格 §4.3/§8）：五个切片 + slice 级嵌套 redux-persist。
 *
 * 启动闸门（规格 §4.3）：createAppStore 同时创建 store、persistor 与只会完成一次的
 * rehydratedPromise；persistor bootstrap 回调在持久化恢复完成后把恢复结果
 * （含降级标记）写入 app 初始化状态并 resolve 该 Promise，后续 auth loader 等待它再读 token。
 */
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE, persistStore } from 'redux-persist'
import type { Persistor } from 'redux-persist'
import { getPersistRecoveryFailures, persistedReducers, resetPersistRecoveryFailures } from '@/store/persist'
import { appSlice } from '@/store/slices/app.slice'
import { pageCacheSlice } from '@/store/slices/pageCache.slice'
import { tabsSlice } from '@/store/slices/tabs.slice'
import { writeThemeBootMirror } from '@/store/themeBootMirror'

const rootReducer = combineReducers({
  ...persistedReducers,
  tabs: tabsSlice.reducer,
  pageCache: pageCacheSlice.reducer,
})

function configureAppStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // 只忽略 redux-persist 官方 action（PERSIST/REHYDRATE 等携带回调与元数据），不关闭整个检查器（规格 §8.2）
        serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      }),
  })
}

/**
 * 创建应用 store、persistor 与 rehydratedPromise。
 * persist 采用 slice 级嵌套：user/settings/app 各自独立 key 与字段白名单，
 * tabs/pageCache 不持久化（规格 §8.1/§8.2）。
 */
export function createAppStore() {
  resetPersistRecoveryFailures()

  const store = configureAppStore()

  let resolveRehydrated!: () => void
  /** 启动闸门 Promise：由 persistor bootstrap 回调完成一次，auth loader 必须先 await 它（规格 §4.3） */
  const rehydratedPromise = new Promise<void>((resolve) => {
    resolveRehydrated = resolve
  })

  const persistor: Persistor = persistStore(store, undefined, () => {
    const failures = getPersistRecoveryFailures()
    if (failures.length > 0) {
      // 每次启动只输出一条诊断（规格 §8.2），汇总全部降级记录
      console.error('[apex-persist] 持久化恢复降级：已清理不可信数据并按默认值继续启动', [...failures])
    }
    store.dispatch(appSlice.actions.bootstrapCompleted({ recoveryFailed: failures.length > 0 }))
    resolveRehydrated()
  })

  // 主题启动镜像：创建时先以当前设置校正一次，之后 settings 每次变化同步重写（规格 §8.3）
  writeThemeBootMirror(store.getState().settings)
  let previousSettings = store.getState().settings
  store.subscribe(() => {
    const settings = store.getState().settings
    if (settings !== previousSettings) {
      previousSettings = settings
      writeThemeBootMirror(settings)
    }
  })

  return { store, persistor, rehydratedPromise }
}

export type AppStore = ReturnType<typeof createAppStore>
export type RootState = ReturnType<AppStore['store']['getState']>
export type AppDispatch = AppStore['store']['dispatch']

let defaultAppStore: AppStore | null = null

/** 页面级默认 store：懒创建单例，避免模块导入副作用；main.tsx 与需要模块级访问的基础设施使用 */
export function getDefaultAppStore(): AppStore {
  defaultAppStore ??= createAppStore()
  return defaultAppStore
}
