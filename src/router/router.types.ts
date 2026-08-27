/**
 * 路由体系类型：定义与 meta 约定（SPEC §4.2）。
 */

import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

/** 路由元信息；原样映射到 Data Router 的 handle.meta */
export interface RouteMeta {
  title: string
  icon?: LucideIcon
  permCode?: string
  hideInMenu?: boolean
  hideInTabs?: boolean
  affixTab?: boolean
  noCache?: boolean
  breadcrumb?: boolean
  tabKeyMode?: 'fullPath' | 'pathname'
  i18nNamespaces?: string[]
}

/** 路由定义节点；同时驱动访问路由、纯渲染路由、菜单和面包屑 */
export interface AppRouteDefinition {
  id: string
  path?: string
  index?: boolean
  loadPage?: () => Promise<{ default: ComponentType }>
  meta: RouteMeta
  children?: AppRouteDefinition[]
}

/** Data Router handle 约定 */
export interface RouteHandle {
  meta: RouteMeta
}
