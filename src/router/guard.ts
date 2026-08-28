/**
 * 路由守卫：Data Router loader 只做认证校验与重定向，不承载业务数据（SPEC §4.1）。
 */

import { redirect, type LoaderFunction } from 'react-router'
import { buildLoginPath } from '@/router/redirect'
import { persistRehydrated, store } from '@/store/store'

/** 生成受保护节点的守卫 loader（未登录重定向到登录页并携带回跳地址） */
export function createRouteGuardLoader(): LoaderFunction {
  return async ({ request }) => {
    // createBrowserRouter 在模块初始化期即跑初始 loader，此刻持久化恢复未完成
    await persistRehydrated
    const { auth } = store.getState()
    if (auth.user === null) {
      const url = new URL(request.url)
      return redirect(buildLoginPath(url.pathname, url.search))
    }
    return null
  }
}
