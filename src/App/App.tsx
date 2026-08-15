/**
 * 应用外壳（规格 §4.3/§7.2）：
 * Provider 顺序固定为 Redux Provider → PersistGate → ConfigProvider → antd App →
 * FeedbackBridge → RouterProvider。ConfigProvider 由 ThemeProvider 承载：
 * theme 随 settings 实时组装（亮/暗/跟随系统、主题色、字体、字号），
 * locale 随语言设置切换（规格 §10.2/§12）。
 * 持久化恢复失败提示（RecoveryFailureNotice）挂在 FeedbackBridge 之内、RouterProvider
 * 之外，经 uiFeedback 显示一次恢复失败提醒（规格 §4.3）。
 */
import { App as AntdApp } from 'antd'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router'
import { PersistGate } from 'redux-persist/integration/react'
import type { Persistor } from 'redux-persist'
import { FeedbackBridge } from '@/components/FeedbackBridge/FeedbackBridge'
import type { AppRouter } from '@/router/router'
import type { AppStore } from '@/store/store'
import { RecoveryFailureNotice } from './RecoveryFailureNotice/RecoveryFailureNotice'
import { ThemeProvider } from './ThemeProvider/ThemeProvider'

export interface AppProps {
  /** 应用 store：main.tsx 经 getDefaultAppStore 创建后注入 */
  store: AppStore['store']
  /** store 对应的 persistor：PersistGate 等待恢复完成后渲染子树（规格 §4.3） */
  persistor: Persistor
  /** Data Router 实例：bootstrapRouter 创建并接线导航意图后注入 */
  router: AppRouter
}

export function App({ store, persistor, router }: AppProps) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <AntdApp>
            <FeedbackBridge>
              <RecoveryFailureNotice router={router} />
              <RouterProvider router={router} />
            </FeedbackBridge>
          </AntdApp>
        </ThemeProvider>
      </PersistGate>
    </Provider>
  )
}
