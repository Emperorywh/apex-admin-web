/**
 * App 外壳测试（规格 §4.3/§7.2）：
 * Provider 组合（Redux → PersistGate → ConfigProvider → antd App → FeedbackBridge →
 * RouterProvider）下路由内容可渲染、反馈桥就绪；恢复失败标记在登录页经 uiFeedback
 * 显示一次性提示的端到端链路。
 */
import { screen, waitFor } from '@testing-library/react'
import { App as AntdApp } from 'antd'
import { render } from '@testing-library/react'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router'
import { createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { isUiFeedbackReady } from '@/services/feedback/uiFeedback'
import { bootstrapCompleted } from '@/store/slices/app.slice'
import { createAppStore } from '@/store/store'
import type { RootState } from '@/store/store'
import { App } from './App'

/** 路由内容探针：验证 Redux/antd/路由三层上下文同时可用 */
function ContextProbe() {
  const location = useLocation()
  const language = useSelector((state: RootState) => state.settings.language)
  const { message } = AntdApp.useApp()
  return (
    <div>
      <span data-testid="probe-path">{location.pathname}</span>
      <span data-testid="probe-lang">{language}</span>
      <span data-testid="probe-feedback">{typeof message.error === 'function' ? 'ready' : 'missing'}</span>
    </div>
  )
}

/** 装配外壳：真实 store/persistor + 内存 Data Router */
function renderApp(initialEntry: string, setup?: (appStore: ReturnType<typeof createAppStore>) => void) {
  const appStore = createAppStore()
  setup?.(appStore)
  const router = createMemoryRouter([
    { path: '/probe', element: <ContextProbe /> },
    { path: '/login', element: <div data-testid="login-page">登录页</div> },
  ], { initialEntries: [initialEntry] })
  const view = render(
    <App store={appStore.store} persistor={appStore.persistor} router={router as never} />,
  )
  return { ...view, appStore }
}

describe('App 外壳 Provider 组合（规格 §7.2 顺序）', () => {
  it('PersistGate 恢复完成后渲染 RouterProvider 内容：Redux/antd/路由上下文同时可用且反馈桥就绪', async () => {
    renderApp('/probe')
    // PersistGate 异步恢复完成后子树才渲染
    expect(await screen.findByTestId('probe-path')).toHaveTextContent('/probe')
    expect(screen.getByTestId('probe-lang')).toHaveTextContent('zh-CN')
    expect(screen.getByTestId('probe-feedback')).toHaveTextContent('ready')
    await waitFor(() => {
      expect(isUiFeedbackReady()).toBe(true)
    })
  })

  it('恢复失败标记 + 登录页：经 uiFeedback 显示一次恢复失败提示（端到端，规格 §4.3）', async () => {
    const { appStore } = renderApp('/login')
    // 等 PersistGate 恢复完成（persistor bootstrap 会先写入 recoveryFailed:false），再置位失败标记
    expect(await screen.findByTestId('login-page')).toBeInTheDocument()
    await waitFor(() => {
      expect(appStore.store.getState().app.initialization.rehydrated).toBe(true)
    })
    appStore.store.dispatch(bootstrapCompleted({ recoveryFailed: true }))
    // FeedbackBridge 注册的 message 实例渲染警告文案（一次性）
    expect(await screen.findByText('本地设置恢复失败，已使用默认设置')).toBeInTheDocument()
  })

  it('无恢复失败标记时不出现恢复失败提示', async () => {
    renderApp('/login')
    expect(await screen.findByTestId('login-page')).toBeInTheDocument()
    await waitFor(() => {
      expect(isUiFeedbackReady()).toBe(true)
    })
    expect(screen.queryByText('本地设置恢复失败，已使用默认设置')).toBeNull()
  })
})
