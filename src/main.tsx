import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App/App'
import { bootstrapRouter } from '@/router/bootstrap'
import { getDefaultAuthSessionRuntime } from '@/services/auth/auth.session'
import { getDefaultAppStore } from '@/store/store'
// Inter Variable 拉丁子集自托管（SPEC_UI2 §4.5）：@font-face 声明与 woff2 注入
// 位于 styles/globals.css（无 CDN 依赖）；字体族栈在 config/theme.ts 固定
import '@/styles/globals.css'

// 启动接线（规格 §4.3/§13.1/§13.3）：
// ① 创建 store/persistor 与只会完成一次的 rehydratedPromise（守卫 loader 等待它再读 token）；
// ② 演示模式注册：off 构建经静态条件 + 动态 import 整体剔除 demo 模块（产物零 demo 代码）；
//    顶层 await 保证 adapter 解析器与登录 fallback 在首个请求发出前完成注册；
// ③ 创建默认认证会话运行时（向请求层注册权限变更 profile 刷新执行器）；
// ④ 创建 Data Router 并接线全部导航意图消费（post-login 合法回跳、post-logout、
//    失权 403、会话过期跳登录与失权页签权限解析）。
const { store, persistor } = getDefaultAppStore()
if (import.meta.env.VITE_DEMO_MODE !== 'off') {
  const { setupDemoMode } = await import('@/demo/demoRuntime')
  setupDemoMode()
}
getDefaultAuthSessionRuntime()
const router = bootstrapRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} persistor={persistor} router={router} />
  </StrictMode>,
)
