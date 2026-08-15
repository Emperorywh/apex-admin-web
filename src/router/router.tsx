/**
 * Data Router 装配（规格 §4.1/§4.3）：
 * createBrowserRouter 挂载 accessRoutes 投影（URL 匹配、认证/权限守卫、重定向），
 * 顶层路由统一挂 RouterErrorBoundary 承接 guard/loader 错误；
 * 退出登录回调在此注入认证会话状态机，使 RouterErrorBoundary 不依赖业务 service。
 * 路由实例由 bootstrap.ts 创建并接线导航意图，禁止以 index.tsx 承载实现（规格 §3.1）。
 */
import { createBrowserRouter } from 'react-router'
import { RouterErrorBoundary } from '@/components/RouterErrorBoundary/RouterErrorBoundary'
import { getDefaultAuthSessionRuntime } from '@/services/auth/auth.session'
import { accessRoutes } from './projections'

/** 应用 Data Router 实例类型：react-router 同时导出同名组件与类型，经返回值推导避免歧义 */
export type AppRouter = ReturnType<typeof createBrowserRouter>

/** RouterErrorBoundary 的退出登录回调：执行登出状态机，成功后经 post-logout 意图回登录页 */
export const logoutFromErrorPage = (): Promise<void> => getDefaultAuthSessionRuntime().logoutSession()

/** 全量路由：accessRoutes 投影 + 顶层 RouterErrorBoundary（错误自子路由冒泡至此） */
export function buildAppRoutes() {
  return accessRoutes.map((route) => ({
    ...route,
    errorElement: <RouterErrorBoundary onLogout={logoutFromErrorPage} />,
  }))
}

/**
 * 创建应用 Data Router：在 React 树外创建（规格 §4.3），
 * 所有 auth/permission loader 第一行等待 rehydratedPromise 由 guard.ts 保证。
 */
export function createAppRouter(): AppRouter {
  return createBrowserRouter(buildAppRoutes())
}
