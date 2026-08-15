/**
 * 路由启动接线（规格 §4.3/§5.4/§6.2）：
 * - 创建 Data Router，并注册三个「路由无关导航通道」的消费回调：
 *   ① authNavigation——post-login（redirect 参数经 redirect.ts 五步同源校验后执行合法回跳或
 *   /dashboard）、post-logout（回登录页不带 redirect）、route-forbidden（真实 replace('/403')）；
 *   ② sessionCleanup——会话过期/清理跳登录（地址已由 buildLoginTarget 完成同源校验）；
 *   ③ tabPermissionResolver——pathname → 权限码链，供失权页签判定复用路由定义唯一来源。
 * - 登录提交后的最终导航：useLogin → 登录状态机产出 post-login 意图 → 本接线消费执行。
 */
import { ROUTE_PATHS } from '@/constants/route.constants'
import { registerAuthNavigator, type AuthNavigator } from '@/services/auth/authNavigation'
import { registerTabPermissionResolver } from '@/services/auth/auth.session'
import { registerSessionExpiredNavigator } from '@/services/request/sessionCleanup'
import { readSanitizedRedirectTarget } from './redirect'
import { routePermissionChains } from './projections'
import { createAppRouter, type AppRouter } from './router'

/** 导航函数形态：Data Router navigate 的窄化签名，便于测试注入桩 */
export type RouterNavigate = (to: string, options?: { replace?: boolean }) => void

/**
 * 构造认证导航意图消费回调（规格 §6.2/§5.4）：
 * post-login 读取当前地址的 redirect 参数并经五步同源校验（合法回跳或 /dashboard，规格 §4.3）；
 * post-logout 跳意图目标（登录页，不带 redirect）；route-forbidden 以 replace 跳 /403。
 */
export function createAuthNavigator(navigate: RouterNavigate): AuthNavigator {
  return (intent) => {
    if (intent.kind === 'post-login') {
      const target = readSanitizedRedirectTarget(window.location.search, window.location.origin)
      navigate(target, { replace: true })
      return
    }
    if (intent.kind === 'post-logout') {
      navigate(intent.target, { replace: true })
      return
    }
    navigate(ROUTE_PATHS.FORBIDDEN, { replace: true })
  }
}

/** 失权页签权限解析：路由定义唯一来源派生的 pathname → 权限码链，未登记路径无权限要求 */
export const resolveTabPermissionChain = (pathname: string): readonly string[] =>
  routePermissionChains.get(pathname) ?? []

/** 注册全部路由相关导航通道：返回清理函数，测试用于还原全局注册表 */
export function connectRouterNavigation(navigate: RouterNavigate): () => void {
  registerAuthNavigator(createAuthNavigator(navigate))
  registerSessionExpiredNavigator((loginTarget) => navigate(loginTarget, { replace: true }))
  registerTabPermissionResolver(resolveTabPermissionChain)
  return () => {
    registerAuthNavigator(null)
    registerSessionExpiredNavigator(null)
    registerTabPermissionResolver(null)
  }
}

/**
 * 路由启动入口：创建 Data Router 并接线导航意图消费（main.tsx 调用一次）。
 * 先创建路由再注册回调，保证 loader 执行时消费方已就位。
 */
export function bootstrapRouter(): AppRouter {
  const router = createAppRouter()
  connectRouterNavigation((to, options) => router.navigate(to, options))
  return router
}
