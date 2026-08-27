/**
 * 路由守卫：Data Router loader 只做认证校验与重定向，不承载业务数据（SPEC §4.1）。
 * 菜单过滤（projections）必须复用同一个 hasPermissionChain（SPEC §4.3）。
 */

import { redirect, type LoaderFunction } from 'react-router'
import { WILDCARD_PERMISSION } from '@/constants/permission.constants'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { buildLoginPath } from '@/router/redirect'
import { store } from '@/store/store'

/**
 * 从受保护根到叶子的权限链为 AND；无 permCode 表示所有已登录用户可访问。
 * 通配权限 * 放行任意权限码。
 */
export function hasPermissionChain(
  chain: ReadonlyArray<string | undefined>,
  permissions: ReadonlyArray<string>,
): boolean {
  if (permissions.includes(WILDCARD_PERMISSION)) return true
  return chain.every(
    (code) => code === undefined || permissions.includes(code),
  )
}

/** 生成受保护节点的守卫 loader（闭包捕获权限链） */
export function createRouteGuardLoader(chain: ReadonlyArray<string | undefined>): LoaderFunction {
  return ({ request }) => {
    const { auth } = store.getState()
    const url = new URL(request.url)
    if (auth.user === null) {
      return redirect(buildLoginPath(url.pathname, url.search))
    }
    if (!hasPermissionChain(chain, auth.permissions)) {
      return redirect(ROUTE_PATHS.ERROR_403)
    }
    return null
  }
}
