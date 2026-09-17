/**
 * 路由体系类型：定义与 meta 约定。
 */

import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { PermCode } from '@/constants/auth/permission.constants'

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
   * 菜单级权限码（后端 permissionsTree 中 type=MENU 的 code，T00.4）：
   * 守卫按码拦截直访，菜单按码过滤；未声明的业务页 = 登录即可达
   * （旧 Umi「未写 access」语义；公开页必须显式 public）。
   */
  perm?: PermCode
  /**
   * 迁移过渡标记（T00.4）：对应页面迁移任务未完成，渲染统一迁移占位、
   * 不加载页面代码（无请求）、不作为登录落点候选；页面任务完成后由统筹移除。
   */
  migrationPending?: boolean
  /**
   * 完全公开页（免登录可达）：仅登录页与显式 404。
   * 其余独立页（含软件授权、无权限页、独立详情）一律受认证守卫保护，
   * 不因布局外（layout:false）而公开（规格 5.6 / T00.4 退出检查）。
   */
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
