/**
 * 路由定义唯一来源（AppRouteDefinition[]）。
 * 生成三份只读投影：accessRoutes / renderRoutes / menuRoutes（见 projections.tsx）。
 * 业务页面只能通过 loadPage 延迟加载，且必须指向具名实现路径。
 */

import {
  LayoutDashboard,
  ListTree,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Users,
} from 'lucide-react'
import { PERMISSION_CODES } from '@/constants/permission.constants'
import { ROUTE_IDS, ROUTE_PATHS } from '@/constants/route.constants'
import type { AppRouteDefinition } from '@/router/router.types'

/** 登录、错误页共用的辅助路由 meta */
function auxiliaryMeta(title: string): AppRouteDefinition['meta'] {
  return {
    title,
    hideInMenu: true,
    hideInTabs: true,
    noCache: true,
    breadcrumb: false,
    i18nNamespaces: ['error'],
  }
}

export const appRouteDefinitions: AppRouteDefinition[] = [
  {
    id: ROUTE_IDS.AUTH_LOGIN,
    path: ROUTE_PATHS.LOGIN,
    loadPage: () => import('@/pages/auth/Login/Login'),
    meta: {
      title: '登录',
      hideInMenu: true,
      hideInTabs: true,
      noCache: true,
      breadcrumb: false,
      i18nNamespaces: ['auth'],
    },
  },
  {
    id: ROUTE_IDS.ROOT,
    path: ROUTE_PATHS.ROOT,
    meta: { title: '企业运营中心' },
    children: [
      {
        id: ROUTE_IDS.ROOT_INDEX,
        index: true,
        meta: { title: '工作台', hideInMenu: true, hideInTabs: true, noCache: true },
      },
      {
        id: ROUTE_IDS.DASHBOARD,
        path: ROUTE_PATHS.DASHBOARD.replace(/^\//, ''),
        loadPage: () => import('@/pages/dashboard/Dashboard/Dashboard'),
        meta: {
          title: '运营总览',
          icon: LayoutDashboard,
          affixTab: true,
          i18nNamespaces: ['dashboard'],
        },
      },
      {
        id: ROUTE_IDS.PROFILE,
        path: ROUTE_PATHS.PROFILE.replace(/^\//, ''),
        loadPage: () => import('@/pages/profile/Profile/Profile'),
        meta: {
          title: '个人中心',
          icon: UserRoundCog,
          i18nNamespaces: ['profile'],
        },
      },
      {
        id: ROUTE_IDS.SYSTEM,
        path: ROUTE_PATHS.SYSTEM.replace(/^\//, ''),
        meta: { title: '系统管理', icon: Settings },
        children: [
          {
            id: ROUTE_IDS.SYSTEM_USER,
            path: ROUTE_PATHS.SYSTEM_USER.split('/').pop(),
            loadPage: () => import('@/pages/system/user/User/User'),
            meta: {
              title: '用户管理',
              icon: Users,
              permCode: PERMISSION_CODES.SYSTEM_USER_READ,
              i18nNamespaces: ['system'],
            },
          },
          {
            id: ROUTE_IDS.SYSTEM_ROLE,
            path: ROUTE_PATHS.SYSTEM_ROLE.split('/').pop(),
            loadPage: () => import('@/pages/system/role/Role/Role'),
            meta: {
              title: '角色管理',
              icon: ShieldCheck,
              permCode: PERMISSION_CODES.RBAC_ROLE_READ,
              i18nNamespaces: ['system'],
            },
          },
          {
            id: ROUTE_IDS.SYSTEM_MENU,
            path: ROUTE_PATHS.SYSTEM_MENU.split('/').pop(),
            loadPage: () => import('@/pages/system/menu/Menu/Menu'),
            meta: {
              title: '菜单管理',
              icon: ListTree,
              permCode: PERMISSION_CODES.MENU_MENU_READ,
              i18nNamespaces: ['system'],
            },
          },
        ],
      },
      {
        id: ROUTE_IDS.ERROR_403,
        path: ROUTE_PATHS.ERROR_403.replace(/^\//, ''),
        loadPage: () => import('@/pages/error/Forbidden/Forbidden'),
        meta: auxiliaryMeta('无权限'),
      },
      {
        id: ROUTE_IDS.ERROR_500,
        path: ROUTE_PATHS.ERROR_500.replace(/^\//, ''),
        loadPage: () => import('@/pages/error/ServerError/ServerError'),
        meta: auxiliaryMeta('服务错误'),
      },
      {
        id: ROUTE_IDS.ROOT_NOT_FOUND,
        path: '*',
        loadPage: () => import('@/pages/error/NotFound/NotFound'),
        meta: auxiliaryMeta('页面不存在'),
      },
    ],
  },
  {
    id: ROUTE_IDS.ERROR_404,
    path: ROUTE_PATHS.ERROR_404,
    loadPage: () => import('@/pages/error/NotFound/NotFound'),
    meta: auxiliaryMeta('页面不存在'),
  },
]
