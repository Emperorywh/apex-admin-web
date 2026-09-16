/**
 * 路由守卫：Data Router loader 只做认证校验与重定向，不承载业务数据。
 *
 * 认证判定基于唯一身份快照（旧协议模型）；启动引导（main.tsx）在渲染前
 * 完成"持久化恢复 + restoreSession 详情核查"，守卫读到的是恢复结论。
 * 按权限码的菜单/直访校验由 T007 在此扩展，本守卫只拦截未登录。
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
    // 恢复流程在渲染前完成（restored 恒为 true）；identity 为 null 即未登录/已失效
    if (auth.identity === null) {
      const url = new URL(request.url)
      return redirect(buildLoginPath(url.pathname, url.search))
    }
    return null
  }
}
