/**
 * Data Router 装配。禁止以 index.tsx 承载实现。
 *
 * 全部路由包在稳定会话宿主 SessionHost 之下（SPEC §8.1）：
 * 登录页直接透传 <Outlet/>；其余路由共享同一页签缓存宿主，
 * 全屏/暂缓/404/无权限等视图切换不销毁会话层缓存。
 */

import { createBrowserRouter } from 'react-router'
import { accessRoutes } from '@/router/projections'
import { SessionHost } from '@/layouts/SessionHost/SessionHost'

export const appRouter = createBrowserRouter([
  {
    element: <SessionHost />,
    children: accessRoutes,
  },
])
