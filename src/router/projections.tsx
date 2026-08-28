/**
 * 三投影生成（SPEC §4.1）：
 * 1. accessRoutes —— 注册给 createBrowserRouter；认证 loader、重定向、空锚点叶子
 * 2. renderRoutes —— 无 loader/action，仅结构与 React.lazy 页面；供 CachedRouteView 以
 *    useRoutes(renderRoutes, locationSnapshot) 渲染，使每个缓存页签拥有独立路由上下文
 * 3. menuRoutes   —— 按 hideInMenu 过滤；供底部 Dock 菜单与快捷入口
 *
 * 三份投影与 lazy 组件均在模块初始化时只生成一次，保持引用稳定。
 */

import { Suspense, lazy, type ComponentType, type ReactNode } from 'react'
import { Navigate, redirect, type RouteObject } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import PageLoading from '@/components/PageLoading/PageLoading'
import { RouterErrorBoundary } from '@/components/RouterErrorBoundary/RouterErrorBoundary'
import { BasicLayout } from '@/layouts/BasicLayout/BasicLayout'
import { BlankLayout } from '@/layouts/BlankLayout/BlankLayout'
import { appRouteDefinitions, joinPath, ROUTE_IDS } from '@/router/definitions'
import { createRouteGuardLoader } from '@/router/guard'
import { ROOT_REDIRECT_TARGET } from '@/router/redirect'
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

function toAccessNode(
  definition: AppRouteDefinition,
  isProtected: boolean,
  isTopLevel: boolean,
): RouteObject {
  // RouteObject 为可辨识联合：index 与 path 必须在构造期确定
  const node: RouteObject = definition.index
    ? { id: definition.id, handle: { meta: definition.meta }, index: true }
    : {
        id: definition.id,
        handle: { meta: definition.meta },
        ...(definition.path !== undefined ? { path: definition.path } : {}),
      }
  if (isTopLevel) node.errorElement = <RouterErrorBoundary />

  if (isProtected) {
    if (definition.index || definition.redirect) {
      // index 与 redirect 节点固定 replace：index 未声明目标时回退受保护首页；
      // 目标节点自带认证守卫，此处不再重复校验
      node.loader = () => redirect(definition.redirect ?? ROOT_REDIRECT_TARGET)
    } else {
      node.loader = createRouteGuardLoader()
    }
  }

  if (definition.children?.length) {
    node.children = definition.children.map((child) =>
      toAccessNode(child, isProtected, false),
    )
    if (definition.id === ROUTE_IDS['root']) {
      // BasicLayout 在受保护根只挂载一次；业务页由 PageCacheHost 渲染
      node.element = <BasicLayout />
    }
    return node
  }

  if (definition.loadPage && !isProtected) {
    // 公开叶子（登录、显式 404）由 Data Router 直接渲染
    const LazyPage = getLazyPage(definition)
    node.element = wrapPublicPage(<LazyPage />)
  }
  // 受保护业务叶子：空锚点，不直接渲染业务页（SPEC §4.1）
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
  toAccessNode(definition, definition.id === ROUTE_IDS['root'], true),
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
/* menuRoutes                                                                 */
/* -------------------------------------------------------------------------- */

export interface MenuNode {
  routeId: string
  path: string
  title: string
  icon?: LucideIcon
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
      // 目录至少有一个可见子节点才保留（SPEC §4.3）
      if (children.length === 0) continue
      nodes.push({
        routeId: definition.id,
        path,
        title: definition.meta.title,
        icon: definition.meta.icon,
        children,
      })
    } else if (!definition.index && (definition.loadPage || definition.redirect)) {
      nodes.push({
        routeId: definition.id,
        path,
        title: definition.meta.title,
        icon: definition.meta.icon,
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
