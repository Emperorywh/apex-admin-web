/**
 * 应用外壳（规格 §4.3/§7.2）：
 * Provider 顺序固定为 Redux Provider → PersistGate → ConfigProvider → antd App →
 * FeedbackBridge → RouterProvider。主题组装由 TASK-009 接入，当前 ConfigProvider
 * 使用默认主题，仅随语言设置切换 antd locale。
 * 持久化恢复失败提示（RecoveryFailureNotice）挂在 FeedbackBridge 之内、RouterProvider
 * 之外，经 uiFeedback 显示一次恢复失败提醒（规格 §4.3）。
 */
import { App as AntdApp, ConfigProvider } from 'antd'
import { useSelector } from 'react-redux'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import { RouterProvider } from 'react-router'
import { PersistGate } from 'redux-persist/integration/react'
import type { Persistor } from 'redux-persist'
import { FeedbackBridge } from '@/components/FeedbackBridge/FeedbackBridge'
import { getAntdLocale } from '@/i18n/localeSync'
import type { AppRouter } from '@/router/router'
import type { AppStore } from '@/store/store'
import type { RootState } from '@/store/store'
import { RecoveryFailureNotice } from './RecoveryFailureNotice/RecoveryFailureNotice'

export interface AppProps {
  /** 应用 store：main.tsx 经 getDefaultAppStore 创建后注入 */
  store: AppStore['store']
  /** store 对应的 persistor：PersistGate 等待恢复完成后渲染子树（规格 §4.3） */
  persistor: Persistor
  /** Data Router 实例：bootstrapRouter 创建并接线导航意图后注入 */
  router: AppRouter
}

/** antd locale 跟随语言设置：位于 Redux Provider 与 PersistGate 之内，恢复完成后取值（规格 §12） */
function AntdLocaleGate({ children }: { children: ReactNode }) {
  const language = useSelector((state: RootState) => state.settings.language)
  return <ConfigProvider locale={getAntdLocale(language)}>{children}</ConfigProvider>
}

export function App({ store, persistor, router }: AppProps) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AntdLocaleGate>
          <AntdApp>
            <FeedbackBridge>
              <RecoveryFailureNotice router={router} />
              <RouterProvider router={router} />
            </FeedbackBridge>
          </AntdApp>
        </AntdLocaleGate>
      </PersistGate>
    </Provider>
  )
}
