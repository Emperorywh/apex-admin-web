/**
 * Data Router 装配测试（规格 §4.1/§4.2）：
 * createBrowserRouter 路由树来自 accessRoutes 投影，顶层挂 RouterErrorBoundary
 * 承接 guard/loader 错误。
 */
import { describe, expect, it } from 'vitest'
import { ROUTE_IDS } from '@/constants/route.constants'
import { RouterErrorBoundary } from '@/components/RouterErrorBoundary/RouterErrorBoundary'
import { buildAppRoutes, createAppRouter, logoutFromErrorPage } from './router'

describe('buildAppRoutes / createAppRouter（规格 §4.2 RouterErrorBoundary）', () => {
  it('全量路由来自 accessRoutes 投影：登录 + 受保护根', () => {
    const routes = buildAppRoutes()
    expect(routes.map((route) => route.id)).toEqual([ROUTE_IDS.LOGIN, ROUTE_IDS.ROOT])
  })

  it('顶层路由均挂 RouterErrorBoundary（guard/loader 错误自子路由冒泡承接）', () => {
    for (const route of buildAppRoutes()) {
      expect(route.errorElement).toEqual(<RouterErrorBoundary onLogout={expect.any(Function)} />)
    }
  })

  it('createAppRouter 在 React 树外创建 Data Router 实例：路由树来自投影并具备导航接口', () => {
    const router = createAppRouter()
    expect(router.routes.map((route) => route.id)).toContain(ROUTE_IDS.ROOT)
    expect(typeof router.navigate).toBe('function')
    expect(typeof router.subscribe).toBe('function')
  })

  it('logoutFromErrorPage 执行登出状态机（无 refreshToken 时跳过网络，仅本地清理）', async () => {
    // 默认会话无 refreshToken：logoutSession 不发网络请求，finally 完成本地清理后正常返回
    await expect(logoutFromErrorPage()).resolves.toBeUndefined()
  })
})
