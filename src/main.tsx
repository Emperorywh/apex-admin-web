import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App/App'
import { getDefaultAuthSessionRuntime } from '@/services/auth/auth.session'
import '@/styles/globals.css'

// 启动接线（规格 §4.3/§5.4）：创建默认认证会话运行时（同时创建默认 store/persistor
// 与 rehydratedPromise），并向请求层注册权限变更 profile 刷新执行器；
// 导航意图与会话过期跳转的最终执行由路由任务注册消费回调后接线。
getDefaultAuthSessionRuntime()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
