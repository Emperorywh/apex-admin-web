/**
 * 稳定重定向目标与登录回跳地址构造。
 *
 * 受保护根与目录 index 的落点不再使用静态常量：由 guard/routeAccess
 * 按会话动态解析（T00.4，D29），此处只保留登录页地址与回跳参数构造。
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
