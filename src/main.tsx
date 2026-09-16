import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import App from '@/App/App'
import { bootstrapRouter } from '@/router/bootstrap'
import { initIdentityEventBridge, restoreSession } from '@/services/auth/auth.service'
import { persistor, persistRehydrated, store } from '@/store/store'
import '@fontsource-variable/inter'
import '@/i18n/i18n'
import '@/styles/globals.css'

/**
 * 启动引导顺序（先于路由守卫与首屏渲染）：
 * 1. 基础命名空间就绪（语言头来源就位）；
 * 2. 注册旧协议事件桥（1000000/1001000 → 唯一身份状态）；
 * 3. 持久化恢复后执行会话恢复：读存储 → setLegacyToken → detail 核查身份权限。
 * 全部完成后才挂载，守卫读到确定性的登录结论，避免闪登录页或越权首屏。
 */
async function bootstrapApp(): Promise<void> {
  await bootstrapRouter()
  initIdentityEventBridge()
  await persistRehydrated
  await restoreSession()
}

void bootstrapApp().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <App />
        </PersistGate>
      </Provider>
    </StrictMode>,
  )
})
