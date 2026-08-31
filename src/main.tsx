import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App/App'
import { bootstrapRouter } from '@/router/bootstrap'
import { getDefaultAppStore } from '@/store/store'
// Inter Variable 拉丁子集自托管（SPEC_UI2 §4.5）：@font-face 声明与 woff2 注入
// 位于 styles/globals.css（无 CDN 依赖）；字体族栈在 config/theme.ts 固定
import '@/styles/globals.css'

// 启动接线（规格 §4.3，纯前端模式）：
// ① 创建 store/persistor 与只会完成一次的 rehydratedPromise（守卫 loader 等待它再读 token）；
// ② 创建 Data Router 并接线导航意图消费（post-login 合法回跳、post-logout）。
const { store, persistor } = getDefaultAppStore()
const router = bootstrapRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} persistor={persistor} router={router} />
  </StrictMode>,
)
