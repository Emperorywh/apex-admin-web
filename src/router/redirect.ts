/**
 * 登录页地址；携带回跳参数以登录后返回原页面。
 * 受保护根（/）的默认入口不再是静态常量：由 guard.createFirstAccessibleLoader
 * 按「首个有权且本轮已实现的业务页」动态解析（跳过暂缓模块，SPEC §4）。
 */

import { LOGIN_REDIRECT_QUERY_KEY } from '@/constants/auth/auth.constants'
import { ROUTE_PATHS } from '@/router/definitions'

/** 登录页地址；携带回跳参数以登录后返回原页面 */
export function buildLoginPath(fromPathname: string, fromSearch: string): string {
  const redirect = `${fromPathname}${fromSearch}`
  if (redirect === ROUTE_PATHS.root) return ROUTE_PATHS['auth-login']
  const params = new URLSearchParams({ [LOGIN_REDIRECT_QUERY_KEY]: redirect })
  return `${ROUTE_PATHS['auth-login']}?${params.toString()}`
}
