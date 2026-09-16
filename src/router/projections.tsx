/**
 * 三投影生成：
 * 1. accessRoutes —— 注册给 createBrowserRouter（包在稳定会话宿主 SessionHost 内）；
 *    除登录页外全部路由挂认证/授权守卫；业务页输出空锚点，由会话宿主的
 *    PageCacheHost 统一渲染（页签缓存 / 会话内视图切换）
 * 2. renderRoutes —— 无 loader/action，仅结构与 React.lazy 页面；供 CachedRouteView 以
 *    useRoutes(renderRoutes, locationSnapshot) 渲染，使每个缓存页签拥有独立路由上下文
 * 3. menuRoutes   —— 按 hideInMenu 过滤的结构树；供 Dock 菜单做权限过滤后呈现
 *
 * 三份投影与 lazy 组件均在模块初始化时只生成一次，保持引用稳定。
 */

import { Suspense, lazy, type ComponentType, type ReactNode } from 'react'
import { Navigate, redirect, type RouteObject } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import PageLoading from '@/components/PageLoading/PageLoading'
import { RouterErrorBoundary } from '@/components/RouterErrorBoundary/RouterErrorBoundary'
import { BlankLayout } from '@/layouts/BlankLayout/BlankLayout'
import { appRouteDefinitions, joinPath, ROUTE_IDS } from '@/router/definitions'
import { createFirstAccessibleLoader, createRouteGuardLoader } from '@/router/guard'
import type { AppRouteDefinition, RouteMeta } from '@/router/router.types'

/* -------------------------------------------------------------------------- */
/* lazy 页面缓存（模块级，引用稳定；禁止在渲染期重建）                                  */
/* -------------------------------------------------------------------------- */

const lazyPageById = new Map<string, ComponentType>()

function getLazyPage(definition: AppRouteDefinition): ComponentType {
  const existing = lazyPageById.get(definition.id)
  if (existing) return existing
  if (!definition.loadPage) throw new Error(`路由 ${definition.id} 缺少 loadPage`)
  const LazyPage = lazy(definition.loadPage)
  lazyPageById.set(definition.id, LazyPage)
  return LazyPage
}

/** 命名空间门：进入页面前确保 meta.i18nNamespaces 已加载（zh-CN 同步完成） */
function I18nPageGate({
  page,
  namespaces,
}: {
  page: ComponentType
  namespaces: readonly string[]
}) {
  useTranslation(namespaces)
  const Page = page
  return <Page />
}

/* -------------------------------------------------------------------------- */
/* accessRoutes                                                               */
/* -------------------------------------------------------------------------- */

function toAccessNode(definition: AppRouteDefinition, isTopLevel = false): RouteObject {
  // RouteObject 为可辨识联合：index 与 path 必须在构造期确定
  const node: RouteObject = definition.index
    ? { id: definition.id, handle: { meta: definition.meta }, index: true }
    : {
        id: definition.id,
        handle: { meta: definition.meta },
        ...(definition.path !== undefined ? { path: definition.path } : {}),
      }
  // 顶层节点挂错误边界：loader/guard 抛错时有稳定恢复动作（重定向不抛错，不受影响）
  if (isTopLevel) node.errorElement = <RouterErrorBoundary />

  // 公开路由（登录页）：Data Router 直接渲染，无守卫、不进会话宿主
  if (definition.meta.public === true) {
    if (definition.loadPage) {
      const LazyPage = getLazyPage(definition)
      node.element = wrapPublicPage(<LazyPage />)
    }
    return node
  }

  if (definition.index || definition.redirect) {
    if (definition.id === ROUTE_IDS['root-index']) {
      // 受保护根默认入口：解析首个有权且本轮已实现的业务页（跳过暂缓）
      node.loader = createFirstAccessibleLoader()
    } else {
      // 其余 index 与重定向节点固定 replace：目标节点自带守卫，此处不重复校验
      const target = definition.redirect
      if (!target) throw new Error(`路由 ${definition.id} 缺少重定向目标`)
      node.loader = () => redirect(target)
    }
  } else if (definition.loadPage) {
    // 业务叶子（含全屏/暂缓/404 等会话内视图）：统一守卫，输出空锚点由 PageCacheHost 渲染
    node.loader = createRouteGuardLoader()
  }

  if (definition.children?.length) {
    node.children = definition.children.map((child) => toAccessNode(child))
    // 受保护根只是结构节点：BasicLayout 已被稳定会话宿主 SessionHost 取代
    return node
  }
  return node
}

function wrapPublicPage(children: ReactNode): ReactNode {
  return (
    <BlankLayout>
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </BlankLayout>
  )
}

export const accessRoutes: RouteObject[] = appRouteDefinitions.map((definition) =>
  toAccessNode(definition, true),
)

/* -------------------------------------------------------------------------- */
/* renderRoutes                                                               */
/* -------------------------------------------------------------------------- */

function toRenderNode(definition: AppRouteDefinition): RouteObject {
  const node: RouteObject = definition.index
    ? { id: definition.id, handle: { meta: definition.meta }, index: true }
    : {
        id: definition.id,
        handle: { meta: definition.meta },
        ...(definition.path !== undefined ? { path: definition.path } : {}),
      }

  if (definition.children?.length) {
    node.children = definition.children.map(toRenderNode)
    return node
  }

  if (definition.redirect) {
    // 目录默认子页（index）与菜单别名等重定向节点
    node.element = <Navigate replace to={definition.redirect} />
    return node
  }

  if (definition.loadPage) {
    const LazyPage = getLazyPage(definition)
    node.element = (
      <Suspense fallback={<PageLoading />}>
        <I18nPageGate page={LazyPage} namespaces={definition.meta.i18nNamespaces ?? []} />
      </Suspense>
    )
  }
  return node
}

export const renderRoutes: RouteObject[] = appRouteDefinitions.map(toRenderNode)

/* -------------------------------------------------------------------------- */
/* menuRoutes 与权限过滤                                                       */
/* -------------------------------------------------------------------------- */

export interface MenuNode {
  routeId: string
  path: string
  title: string
  icon?: LucideIcon
  /** 菜单权限码（叶子与分组一致携带）；过滤与暂缓标记共用 */
  menuCode?: string
  /** 特权专属入口：非 root 用户菜单与直访均不可见（对齐源 access.ts ROOT_ONLY 行为） */
  rootOnly?: boolean
  /** 本轮暂缓模块：按原权限展示并标注「下一轮实现」 */
  deferred?: boolean
  children: MenuNode[]
}

function filterMenuNodes(
  definitions: readonly AppRouteDefinition[],
  basePath: string,
): MenuNode[] {
  const nodes: MenuNode[] = []
  for (const definition of definitions) {
    if (definition.meta.hideInMenu) continue
    const path = joinPath(basePath, definition.path)
    if (definition.children?.length) {
      const children = filterMenuNodes(definition.children, path)
      // 目录至少有一个可见子节点才保留
      if (children.length === 0) continue
      nodes.push({
        routeId: definition.id,
        path,
        title: definition.meta.title,
        icon: definition.meta.icon,
        menuCode: definition.meta.menuCode,
        rootOnly: definition.meta.rootOnly,
        deferred: definition.meta.deferred,
        children,
      })
    } else if (!definition.index && (definition.loadPage || definition.redirect)) {
      nodes.push({
        routeId: definition.id,
        path,
        title: definition.meta.title,
        icon: definition.meta.icon,
        menuCode: definition.meta.menuCode,
        rootOnly: definition.meta.rootOnly,
        deferred: definition.meta.deferred,
        children: [],
      })
    }
  }
  return nodes
}

export function buildMenuRoutes(): MenuNode[] {
  const tree = filterMenuNodes(appRouteDefinitions, '/')
  // 受保护根只是布局壳：菜单从其子级（业务分区）开始，避免多出一层无意义目录
  const rootIndex = tree.findIndex((node) => node.routeId === ROUTE_IDS['root'])
  if (rootIndex < 0) return tree
  const root = tree[rootIndex]
  return [...root.children, ...tree.filter((_, index) => index !== rootIndex)]
}

/**
 * 按当前身份过滤菜单树（SPEC §8.2）：
 * - 叶子要求持有其 menuCode（祖先填充已在权限模型内完成）；
 * - rootOnly 入口对非 root 隐藏（对齐源 access.ts：ROOT_ONLY 码一律 false）；
 * - 无任何可见子项的分组整组隐藏（与结构过滤一致）；
 * - 暂缓模块不在此特判：按原权限展示，deferred 标记供呈现「下一轮实现」。
 * 过滤在渲染期执行（依赖身份快照），不参与模块级单次生成。
 */
export function filterMenuByPermission(
  nodes: MenuNode[],
  hasMenu: (code: string) => boolean,
  isRoot: boolean,
): MenuNode[] {
  const result: MenuNode[] = []
  for (const node of nodes) {
    if (node.children.length > 0) {
      const children = filterMenuByPermission(node.children, hasMenu, isRoot)
      if (children.length > 0) result.push({ ...node, children })
      continue
    }
    if (node.rootOnly === true && !isRoot) continue
    if (node.menuCode !== undefined && hasMenu(node.menuCode)) result.push(node)
  }
  return result
}

/** 拍平菜单树为叶子列表（Dock、快捷入口等扁平导航使用） */
export function flattenMenuLeaves(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((node) =>
    node.children.length > 0 ? flattenMenuLeaves(node.children) : [node],
  )
}

/* -------------------------------------------------------------------------- */
/* 定义查找辅助                                                                */
/* -------------------------------------------------------------------------- */

function walkDefinitions(
  definitions: readonly AppRouteDefinition[],
  visit: (definition: AppRouteDefinition) => void,
): void {
  for (const definition of definitions) {
    visit(definition)
    if (definition.children?.length) walkDefinitions(definition.children, visit)
  }
}

export function findRouteMeta(routeId: string): RouteMeta | undefined {
  let found: RouteMeta | undefined
  walkDefinitions(appRouteDefinitions, (definition) => {
    if (definition.id === routeId) found = definition.meta
  })
  return found
}

export function findDefinition(routeId: string): AppRouteDefinition | undefined {
  let found: AppRouteDefinition | undefined
  walkDefinitions(appRouteDefinitions, (definition) => {
    if (definition.id === routeId) found = definition
  })
  return found
}

/** 从根到目标定义的祖先链（含自身）；未命中返回 undefined */
function findDefinitionChain(routeId: string): AppRouteDefinition[] | undefined {
  const visit = (
    definitions: readonly AppRouteDefinition[],
    chain: AppRouteDefinition[],
  ): AppRouteDefinition[] | undefined => {
    for (const definition of definitions) {
      const next = [...chain, definition]
      if (definition.id === routeId) return next
      if (definition.children?.length) {
        const found = visit(definition.children, next)
        if (found) return found
      }
    }
    return undefined
  }
  return visit(appRouteDefinitions, [])
}

/**
 * 路由展示图标：自身声明优先；未声明时自上而下继承祖先图标，
 * 使无图标的子级页面继承所属一级菜单的图标
 */
export function findRouteIcon(routeId: string): LucideIcon | undefined {
  const chain = findDefinitionChain(routeId)
  const own = chain?.[chain.length - 1]?.meta.icon
  return own ?? chain?.find((definition) => definition.meta.icon)?.meta.icon
}
