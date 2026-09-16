/**
 * 路由守卫：Data Router loader 只做认证/授权校验与重定向，不承载业务数据。
 *
 * 认证判定基于唯一身份快照（旧协议模型）；启动引导（main.tsx）在渲染前
 * 完成"持久化恢复 + restoreSession 详情核查"，守卫读到的是恢复结论。
 *
 * 授权判定（SPEC §8.2，本卡 T007 接入）：
 * - meta.menuCode：菜单与直访同一权限模型，隐藏入口不是唯一防线；
 *   判定用祖先填充后的菜单源（特权账号短路放行）；
 * - meta.rootOnly：源 isRootUser 判定（root/administrator），普通账号即使
 *   持有对应菜单码（如 auth:user:view）也不得进入特权专属页；
 * - meta.deferred：暂缓模块通过认证与权限后放行，由统一暂缓提示页呈现，
 *   不加载业务模块（SPEC §1.2）；
 * - 无权限/越权直访统一落 /no-permission（P41），不发送任何业务请求。
 */

import { redirect, type LoaderFunction } from 'react-router'
import { buildLoginPath } from '@/router/redirect'
import { findDefinitionByPath, ROUTE_PATHS } from '@/router/definitions'
import { resolveFirstAccessiblePath } from '@/router/firstAccessible'
import { hasMenuCode, isRootUser } from '@/services/auth/permission.model'
import { awaitSessionRestored } from '@/services/auth/auth.service'
import { persistRehydrated, store } from '@/store/store'

// 启动期把路由定义派生的全量菜单结构注入身份层（祖先填充依赖，T007 绑定点）
import '@/router/permissionTree'

/** 无权限页地址（P41）；仅持暂缓权限的差异文案由页面按 query 区分 */
const NO_PERMISSION_TARGET = ROUTE_PATHS['no-permission']

/* -------------------------------------------------------------------------- */
/* 守卫装载器                                                                   */
/* -------------------------------------------------------------------------- */

/** 生成受保护节点的守卫 loader：认证 → rootOnly → menuCode 逐层拦截 */
export function createRouteGuardLoader(): LoaderFunction {
  return async ({ request }) => {
    const url = new URL(request.url)
    // loader 于路由模块初始化期运行：需等启动引导的两道门——
    // 1) redux-persist rehydrate 完成；2) restoreSession 详情核查出结论（T007 修复：
    //    只等 rehydrate 时核查未完成，硬刷新受保护路由会被误弹登录页）
    await persistRehydrated
    await awaitSessionRestored()
    const { auth } = store.getState()
    // 无身份快照即未登录/已失效（falsy 判定：迁移等路径不得让 undefined 绕过）：
    // 重定向登录页并携带回跳地址
    if (!auth.identity) {
      return redirect(buildLoginPath(url.pathname, url.search))
    }
    const definition = findDefinitionByPath(url.pathname)
    if (definition) {
      const { meta } = definition
      // 特权专属页：源 isRootUser 判定，普通账号即使持码也拦截（SPEC §8.2）
      if (meta.rootOnly === true && !isRootUser(auth.identity.username)) {
        return redirect(NO_PERMISSION_TARGET)
      }
      // 菜单码直访鉴权；暂缓模块同样先过权限，通过后由暂缓提示页呈现
      if (meta.menuCode !== undefined && !hasMenuCode(auth.identity, meta.menuCode)) {
        return redirect(NO_PERMISSION_TARGET)
      }
    }
    return null
  }
}

/**
 * 受保护根 index（/）的默认入口 loader：登录成功、目录默认子页与安全返回
 * 统一解析为「首个有权且本轮已实现的业务页」，跳过暂缓模块；无可用入口落
 * /no-permission（仅持暂缓权限时由 P41 区分文案）。replace 保持地址栏干净。
 */
export function createFirstAccessibleLoader(): LoaderFunction {
  return async () => {
    await persistRehydrated
    await awaitSessionRestored()
    const { auth } = store.getState()
    // 守卫链保证到达此 loader 时已认证；无身份时兜底回登录
    if (!auth.identity) return redirect(ROUTE_PATHS['auth-login'])
    return redirect(resolveFirstAccessiblePath(auth.identity))
  }
}
