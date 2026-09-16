/**
 * 路由体系类型：定义与 meta 约定。
 */

import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

/** 路由元信息；原样映射到 Data Router 的 handle.meta */
export interface RouteMeta {
  title: string
  icon?: LucideIcon
  hideInMenu?: boolean
  hideInTabs?: boolean
  affixTab?: boolean
  noCache?: boolean
  tabKeyMode?: 'fullPath' | 'pathname'
  i18nNamespaces?: readonly string[]
  /**
   * 菜单权限码（旧 PERM 语义）：菜单过滤、路由直访鉴权与权限树注入共用。
   * 缺省 = 该节点不参与权限判定（纯结构节点/辅助页）。
   */
  menuCode?: string
  /**
   * 特权专属路由（源 isRootUser 语义）：root/administrator 之外，
   * 即使持有对应菜单码（如 auth:user:view）也不可进入，直访落 P41。
   */
  rootOnly?: boolean
  /** 本轮暂缓模块（SPEC §1.2）：按原权限展示菜单并标注，直访显示统一暂缓提示 */
  deferred?: boolean
  /**
   * 对象页签身份参数名（SPEC §8.1：路由+业务对象标识区分页签）。
   * 声明后页签 key 取该参数的规范化 search（兼容旧裸 query 形式），
   * 其余 query 参数不参与页签身份。
   */
  objectParam?: string
  /** 公开路由（登录页）：不进入稳定会话宿主，无鉴权 */
  public?: boolean
}

/** 路由定义节点；同时驱动访问路由、纯渲染路由和菜单 */
export interface AppRouteDefinition {
  id: string
  path?: string
  index?: boolean
  /** 命中该节点即重定向的目标地址（绝对路径字面量）；不渲染自身页面 */
  redirect?: string
  loadPage?: () => Promise<{ default: ComponentType }>
  meta: RouteMeta
  children?: readonly AppRouteDefinition[]
}

/** Data Router handle 约定 */
export interface RouteHandle {
  meta: RouteMeta
}
