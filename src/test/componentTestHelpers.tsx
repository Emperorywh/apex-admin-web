/**
 * 组件/Hook 测试共享工具：无持久化的全量切片测试 store 与带 Redux/i18n Provider 的渲染封装。
 * 只被组件/Hook 测试文件导入，不参与生产代码与覆盖率统计（规格 §3.2 src/test 职责）。
 */
import { configureStore } from '@reduxjs/toolkit'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { I18nextProvider } from 'react-i18next'
import { appI18n } from '@/i18n/i18n'
import { appSlice } from '@/store/slices/app.slice'
import { pageCacheSlice } from '@/store/slices/pageCache.slice'
import { settingsSlice } from '@/store/slices/settings.slice'
import { tabsSlice } from '@/store/slices/tabs.slice'
import { userSlice } from '@/store/slices/user.slice'

/** 无持久化的全量切片测试 store：状态形状与 RootState 一致（persist 只包 user/settings/app，不改状态类型） */
export function createComponentTestStore() {
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

export type ComponentTestStore = ReturnType<typeof createComponentTestStore>

export interface RenderWithProvidersOptions extends RenderOptions {
  store?: ComponentTestStore
}

/** renderWithProviders 返回值：Testing Library 结果附带回传的 store，供测试直接派发 action */
export type RenderWithProvidersResult = RenderResult & { store: ComponentTestStore }

/** 以 Redux Provider + i18n Provider 包裹渲染（规格 §7.2 Provider 顺序的测试子集） */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { store = createComponentTestStore(), ...renderOptions } = options
  const view = render(
    <Provider store={store}>
      <I18nextProvider i18n={appI18n}>{ui}</I18nextProvider>
    </Provider>,
    renderOptions,
  )
  return { ...view, store }
}
