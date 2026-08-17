/**
 * 路由定义与 meta（规格 §4.2）。
 * 路由定义同时驱动访问路由、纯渲染路由、菜单和面包屑；
 * 业务页面只能通过 loadPage 延迟加载，不能在定义中直接创建页面实例。
 * 接口刻意不含 action 字段：renderRoutes 纯渲染架构下 route action 结构性不可用（规格 §4.1）。
 */
import type { ComponentType } from 'react'
import type { NavTreeNode } from '@/layouts/BasicLayout/navModel'

/**
 * 路由节点定义（规格 §4.2 逐字一致）：
 * meta 会原样映射到 Data Router 的 handle.meta；菜单、面包屑和页签只能从
 * handle.meta 或原始定义读取，不维护副本。
 */
export interface AppRouteDefinition {
  id: string
  path?: string
  index?: boolean
  loadPage?: () => Promise<{ default: ComponentType }>
  meta: RouteMeta
  children?: AppRouteDefinition[]
}

/**
 * 路由元信息：title 为中文文案 key（menu 命名空间）；
 * icon 为 `local:` 图标名字符串（SPEC_UI2 §5.4，渲染经 AppIcon 唯一封装）；
 * caption 为菜单副标题 i18n key（SPEC_UI2 §6.1，仅一级菜单展示）。
 */
export interface RouteMeta {
  title: string
  icon?: string
  caption?: string
  permCode?: string
  hideInMenu?: boolean
  hideInTabs?: boolean
  affixTab?: boolean
  noCache?: boolean
  breadcrumb?: boolean
  tabKeyMode?: 'fullPath' | 'pathname'
  i18nNamespaces?: string[]
}

/**
 * 菜单投影节点（规格 §4.1 投影 3）：由 definitions 派生，侧边/顶部菜单共用。
 * 基础形状继承布局消费契约 NavTreeNode（layouts 层所有，router → layouts 注入方向），
 * 本接口只追加过滤输入字段；过滤后的树可直接作为 BasicLayout 的 navItems。
 */
export interface MenuRouteNode extends NavTreeNode {
  /** 菜单隐藏标记：true 时该节点及其菜单子树被过滤，但不影响 URL 可访问性（规格 §4.4） */
  hideInMenu?: boolean
  /** 从受保护根到本节点累计的权限码链（含祖先，规格 §4.4 AND 语义），过滤时一次判定 */
  permChain: readonly string[]
  children?: MenuRouteNode[]
}
