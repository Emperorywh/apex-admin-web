/**
 * 路由守卫（T00.4 权限与路由）：Data Router loader 只做认证与权限校验及重定向，
 * 不承载业务数据。三类 loader：
 * 1. createRouteGuardLoader —— 认证 + 可选菜单码校验（目录节点与业务叶子共用）
 * 2. createLandingRedirectLoader —— index 节点动态落点（受保护根默认页 / 目录默认子页）
 * 3. createAliasRedirectLoader —— 菜单别名等静态 redirect 的守卫（先验权限再跳转）
 *
 * 权限语义：无权限访问一律送 /no-permission（P41 落点，返回路径不得构成重定向循环）；
 * 会话失效由请求层收敛（业务码 1000000），本守卫只依据持久化会话快照判定。
 */

import { redirect, type LoaderFunction } from 'react-router'
import { ROUTE_PATHS } from '@/router/definitions'
import type { AppRouteDefinition } from '@/router/router.types'
import { buildLoginPath } from '@/router/redirect'
import {
  buildAccessContext,
  hasMenuAccess,
  resolveDirectoryLandingPath,
  resolveLandingPath,
} from '@/router/routeAccess'
import type { PermCode } from '@/constants/auth/permission.constants'
import { persistRehydrated, store } from '@/store/store'

/** 守卫选项：perm 声明本节点要求的菜单码（未声明 = 登录即可达） */
export interface RouteGuardOptions {
  perm?: PermCode
}

/**
 * 生成受保护节点的守卫 loader：
 * 1. 未登录 → 登录页并携带回跳地址（深链接恢复，规格 5.11）
 * 2. 已登录但无本节点权限码 → /no-permission（目录节点持码即可整树拦截）
 */
export function createRouteGuardLoader(options: RouteGuardOptions = {}): LoaderFunction {
  return async ({ request }) => {
    // createBrowserRouter 在模块初始化期即跑初始 loader，此刻持久化恢复未完成
    await persistRehydrated
    const { auth } = store.getState()
    if (auth.user === null) {
      const url = new URL(request.url)
      return redirect(buildLoginPath(url.pathname, url.search))
    }
    if (options.perm !== undefined) {
      const ctx = buildAccessContext(auth)
      if (!hasMenuAccess(ctx, options.perm)) {
        return redirect(ROUTE_PATHS['no-permission'])
      }
    }
    return null
  }
}

/**
 * 生成 index 节点的动态落点 loader。
 * - mode = 'root'：受保护根默认页，按登录落点规则解析（D29：未激活 → 授权页；
 *   首页可用优先；否则首个可用业务页；全部不可用 → 无权限页）
 * - mode = 'directory'：目录默认子页，解析为目录子树中首个可用叶子，
 *   保证目录索引不指向无权限/未迁移页（T00.4 退出检查）
 */
export function createLandingRedirectLoader(
  mode: 'root' | 'directory',
  directory: AppRouteDefinition,
): LoaderFunction {
  return async () => {
    await persistRehydrated
    const { auth } = store.getState()
    if (auth.user === null) {
      return redirect(ROUTE_PATHS['auth-login'])
    }
    const ctx = buildAccessContext(auth)
    const target =
      mode === 'root'
        ? resolveLandingPath(auth)
        : resolveDirectoryLandingPath(directory, ctx)
    return redirect(target)
  }
}

/**
 * 生成静态 redirect 节点（菜单别名）的守卫 loader：
 * 先按节点权限码校验（无权限 → 无权限页），再跳往声明目标；
 * 目标节点自带守卫兜底，此处校验避免把无权限用户先送进目标再被弹回。
 */
export function createAliasRedirectLoader(
  target: string,
  perm?: PermCode,
): LoaderFunction {
  return async () => {
    await persistRehydrated
    const { auth } = store.getState()
    if (auth.user === null) {
      return redirect(ROUTE_PATHS['auth-login'])
    }
    if (perm !== undefined) {
      const ctx = buildAccessContext(auth)
      if (!hasMenuAccess(ctx, perm)) {
        return redirect(ROUTE_PATHS['no-permission'])
      }
    }
    return redirect(target)
  }
}
