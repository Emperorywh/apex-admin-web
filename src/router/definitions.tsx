/**
 * 路由定义唯一来源（AppRouteDefinition[]）：id 与 path 只在此声明。
 * 顶层节点用绝对路径（以 / 开头），子节点用相对段；完整路径由树推导进
 * ROUTE_PATHS（按 id 索引），业务代码不拼接、不复制路径。
 * 新增页面只需在树中加一个节点（id、path、loadPage、meta），访问路由、
 * 纯渲染路由、菜单与 ROUTE_IDS/ROUTE_PATHS/RouteId 自动生效。
 * 业务页面只能通过 loadPage 延迟加载，且必须指向具名实现路径。
 */

import {
  ListTree,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Users,
} from 'lucide-react'
import type { AppRouteDefinition } from '@/router/router.types'

/** 以 const 泛型收集字面量 id，供 RouteId 联合类型推导 */
function defineAppRoutes<const T extends readonly AppRouteDefinition[]>(routes: T): T {
  return routes
}

/** 登录、错误页共用的辅助路由 meta */
function auxiliaryMeta(title: string): AppRouteDefinition['meta'] {
  return {
    title,
    hideInMenu: true,
    hideInTabs: true,
    noCache: true,
    i18nNamespaces: ['error'],
  }
}

export const appRouteDefinitions = defineAppRoutes([
  {
    id: 'auth-login',
    path: '/login',
    loadPage: () => import('@/pages/auth/Login/Login'),
    meta: {
      title: '登录',
      hideInMenu: true,
      hideInTabs: true,
      noCache: true,
      i18nNamespaces: ['auth'],
    },
  },
  {
    id: 'root',
    path: '/',
    meta: { title: '企业运营中心' },
    children: [
      {
        id: 'root-index',
        index: true,
        meta: { title: '工作台', hideInMenu: true, hideInTabs: true, noCache: true },
      },
      {
        id: 'profile',
        path: 'profile',
        loadPage: () => import('@/pages/profile/Profile/Profile'),
        meta: {
          title: '个人中心',
          icon: UserRoundCog,
          i18nNamespaces: ['profile'],
        },
      },
      {
        id: 'system',
        path: 'system',
        meta: { title: '系统管理', icon: Settings },
        children: [
          {
            id: 'system-user',
            path: 'user',
            loadPage: () => import('@/pages/system/user/User/User'),
            meta: {
              title: '用户管理',
              icon: Users,
              affixTab: true,
              i18nNamespaces: ['system'],
            },
          },
          {
            id: 'system-role',
            path: 'role',
            loadPage: () => import('@/pages/system/role/Role/Role'),
            meta: {
              title: '角色管理',
              icon: ShieldCheck,
              i18nNamespaces: ['system'],
            },
          },
          {
            id: 'system-menu',
            path: 'menu',
            loadPage: () => import('@/pages/system/menu/Menu/Menu'),
            meta: {
              title: '菜单管理',
              icon: ListTree,
              i18nNamespaces: ['system'],
            },
          },
        ],
      },
      {
        id: 'error-500',
        path: '500',
        loadPage: () => import('@/pages/error/ServerError/ServerError'),
        meta: auxiliaryMeta('服务错误'),
      },
      {
        id: 'root-not-found',
        path: '*',
        loadPage: () => import('@/pages/error/NotFound/NotFound'),
        meta: auxiliaryMeta('页面不存在'),
      },
    ],
  },
  {
    id: 'error-404',
    path: '/404',
    loadPage: () => import('@/pages/error/NotFound/NotFound'),
    meta: auxiliaryMeta('页面不存在'),
  },
])

/* -------------------------------------------------------------------------- */
/* id / 完整路径推导（模块初始化时执行一次）                                       */
/* -------------------------------------------------------------------------- */

/** 拼接父子路径；以 / 开头的段视为绝对路径直接采用 */
export function joinPath(base: string, segment: string | undefined): string {
  if (!segment) return base || '/'
  if (segment.startsWith('/')) return segment
  return `${base === '/' ? '' : base}/${segment}`
}

/** 从定义树递归提取全部 id 字面量 */
type RouteIdOf<T> = T extends readonly (infer U)[]
  ? U extends { id: infer I; children?: infer C }
    ? C extends readonly unknown[]
      ? I | RouteIdOf<C>
      : I
    : never
  : never

/** 全局唯一路由 id 联合；新增树节点后自动扩充 */
export type RouteId = RouteIdOf<typeof appRouteDefinitions>

const ids: Record<string, string> = {}
const paths: Record<string, string> = {}

function collectRoutes(definitions: readonly AppRouteDefinition[], basePath: string): void {
  for (const definition of definitions) {
    if (definition.id in ids) throw new Error(`路由 id 重复：${definition.id}`)
    ids[definition.id] = definition.id
    // index 与 * 节点没有可导航地址，归到父路径
    const navigable = definition.path !== undefined && !definition.path.includes('*')
    paths[definition.id] = navigable ? joinPath(basePath, definition.path) : basePath
    if (definition.children?.length) {
      collectRoutes(definition.children, navigable ? paths[definition.id] : basePath)
    }
  }
}

collectRoutes(appRouteDefinitions, '/')

/** 全量路由 id（按 id 索引）；业务代码引用 id 时用它而非散落字面量 */
export const ROUTE_IDS = ids as Readonly<Record<RouteId, RouteId>>

/** id → 完整访问路径；由树推导，禁止手写副本 */
export const ROUTE_PATHS = paths as Readonly<Record<RouteId, string>>
