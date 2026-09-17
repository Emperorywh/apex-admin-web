/**
 * 三投影生成：
 * 1. accessRoutes —— 注册给 createBrowserRouter；认证/权限 loader、动态落点重定向、空锚点叶子
 * 2. renderRoutes —— 无 loader/action，仅结构与 React.lazy 页面；供 CachedRouteView 以
 *    useRoutes(renderRoutes, locationSnapshot) 渲染，使每个缓存页签拥有独立路由上下文
 * 3. menuRoutes   —— 按 hideInMenu 与会话权限过滤；供底部 Dock 菜单与快捷入口
 *
 * 三份投影与 lazy 组件均在模块初始化时只生成一次，保持引用稳定。
 * 权限判定不在本模块读 store：loader 由 react-router 注入时机调用（读快照），
 * 菜单投影由调用方（DockMenu）传入会话构建的访问上下文（T00.4）。
 */

import { Suspense, lazy, type ComponentType, type ReactNode } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import PageLoading from '@/components/PageLoading/PageLoading'
import { RouterErrorBoundary } from '@/components/RouterErrorBoundary/RouterErrorBoundary'
import { MigrationPending } from '@/components/MigrationPending/MigrationPending'
import { BasicLayout } from '@/layouts/BasicLayout/BasicLayout'
import { BlankLayout } from '@/layouts/BlankLayout/BlankLayout'
import { appRouteDefinitions, joinPath, ROUTE_IDS } from '@/router/definitions'
import {
  createAliasRedirectLoader,
  createLandingRedirectLoader,
  createRouteGuardLoader,
} from '@/router/guard'
import {
  buildAccessContext,
  hasMenuAccess,
  resolveDirectoryLandingPath,
  resolveLandingPath,
  type AccessContext,
} from '@/router/routeAccess'
import { useAppSelector } from '@/hooks/useAppSelector'
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

/**
 * 迁移过渡判定：页面迁移任务未完成的叶子不加载页面代码（无请求），
 * 以统一迁移占位呈现（T00.4 退出检查：过渡未迁移页无 mock 请求）。
 */
function isMigrationPending(definition: AppRouteDefinition): boolean {
  return definition.meta.migrationPending === true
}

/** 迁移占位元素：展示页面标题（menu 命名空间）与迁移中说明 */
function renderMigrationPlaceholder(definition: AppRouteDefinition): ReactNode {
  return <MigrationPending title={definition.meta.title} />
}

/* -------------------------------------------------------------------------- */
/* index 落点组件（renderRoutes 侧兜底）：与守卫 loader 同一套解析规则              */
/* -------------------------------------------------------------------------- */

/**
 * index 节点在纯渲染投影中的落点：渲染期读取会话快照动态解析。
 * 正常导航会先被 accessRoutes 的 loader 重定向，本组件是页签快照直渲染时的兜底，
 * 保证两层投影落点一致（目录索引不指向无权限/未迁移页）。
 * 未登录场景交给 accessRoutes 守卫处理，本组件不做跳转。
 */
function IndexLandingRedirect({ parent }: { parent: AppRouteDefinition }) {
  const auth = useAppSelector((state) => state.auth)
  if (auth.user === null) return null
  const ctx = buildAccessContext(auth)
  const target =
    parent.id === ROUTE_IDS['root']
      ? resolveLandingPath(auth)
      : resolveDirectoryLandingPath(parent, ctx)
  return <Navigate replace to={target} />
}

/* -------------------------------------------------------------------------- */
/* accessRoutes                                                               */
/* -------------------------------------------------------------------------- */

function toAccessNode(
  definition: AppRouteDefinition,
  isProtected: boolean,
  isTopLevel: boolean,
  parent?: AppRouteDefinition,
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
    if (definition.index) {
      // index 节点：受保护根默认页与目录默认子页都按会话动态解析落点，
      // 保证不指向无权限/未迁移页（T00.4）
      node.loader = createLandingRedirectLoader(
        parent?.id === ROUTE_IDS['root'] ? 'root' : 'directory',
        parent ?? definition,
      )
    } else if (definition.redirect) {
      // 静态别名（如「服务器资源」菜单入口）：先验权限再跳目标
      node.loader = createAliasRedirectLoader(definition.redirect, definition.meta.perm)
    } else {
      // 目录与业务叶子：认证 + 可选菜单码校验；目录持码即可整树拦截
      node.loader = createRouteGuardLoader({ perm: definition.meta.perm })
    }
  } else if (definition.loadPage && definition.meta.public !== true) {
    // 布局外独立叶子（软件授权/无权限/独立详情/全屏监控）：
    // 不因 layout:false 公开，统一挂认证 + 权限守卫（规格 5.6 / T00.4）
    node.loader = createRouteGuardLoader({ perm: definition.meta.perm })
  }

  if (definition.children?.length) {
    node.children = definition.children.map((child) =>
      toAccessNode(child, isProtected, false, definition),
    )
    if (definition.id === ROUTE_IDS['root']) {
      // BasicLayout 在受保护根只挂载一次；业务页由 PageCacheHost 渲染
      node.element = <BasicLayout />
    }
    return node
  }

  if (definition.loadPage && !isProtected) {
    // 公开叶子（登录、显式 404）由 Data Router 直接渲染；
    // 其余独立叶子经守卫后渲染，迁移过渡页以占位呈现、不加载页面代码
    const content = isMigrationPending(definition)
      ? renderMigrationPlaceholder(definition)
      : wrapLazyLeaf(definition)
    node.element = wrapPublicPage(content)
  }
  // 受保护业务叶子：空锚点，不直接渲染业务页
  return node
}

/** 独立叶子元素：lazy 页面组件（getLazyPage 模块级缓存，引用稳定） */
function wrapLazyLeaf(definition: AppRouteDefinition): ReactNode {
  const LazyPage = getLazyPage(definition)
  return <LazyPage />
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

function toRenderNode(
  definition: AppRouteDefinition,
  parent?: AppRouteDefinition,
): RouteObject {
  const node: RouteObject = definition.index
    ? { id: definition.id, handle: { meta: definition.meta }, index: true }
    : {
        id: definition.id,
        handle: { meta: definition.meta },
        ...(definition.path !== undefined ? { path: definition.path } : {}),
      }

  if (definition.children?.length) {
    node.children = definition.children.map((child) => toRenderNode(child, definition))
    return node
  }

  if (definition.redirect) {
    // 静态别名（菜单别名等重定向节点）；目标节点的权限由 accessRoutes 守卫兜底
    node.element = <Navigate replace to={definition.redirect} />
    return node
  }

  if (definition.index && parent) {
    // 目录默认子页：动态落点兜底（与守卫 loader 同规则）
    node.element = <IndexLandingRedirect parent={parent} />
    return node
  }

  if (definition.loadPage) {
    // 迁移过渡页：渲染统一占位，不触发 lazy 加载（无请求、无页面代码执行）
    if (isMigrationPending(definition)) {
      node.element = renderMigrationPlaceholder(definition)
      return node
    }
    const LazyPage = getLazyPage(definition)
    node.element = (
      <Suspense fallback={<PageLoading />}>
        <I18nPageGate page={LazyPage} namespaces={definition.meta.i18nNamespaces ?? []} />
      </Suspense>
    )
  }
  return node
}

export const renderRoutes: RouteObject[] = appRouteDefinitions.map((definition) =>
  toRenderNode(definition),
)

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
  ctx: AccessContext,
): MenuNode[] {
  const nodes: MenuNode[] = []
  for (const definition of definitions) {
    if (definition.meta.hideInMenu) continue
    // 权限剪枝：节点声明了菜单码且当前会话无权时整子树隐藏；
    // 目录持码（祖先填充后可见）或无码（登录可达）默认通过
    if (!hasMenuAccess(ctx, definition.meta.perm)) continue
    const path = joinPath(basePath, definition.path)
    if (definition.children?.length) {
      const children = filterMenuNodes(definition.children, path, ctx)
      // 目录至少有一个可见子节点才保留
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

/**
 * 构建当前会话可见的菜单树：结构按定义树，可见性按访问上下文。
 * 迁移过渡页保留菜单入口（点开呈现统一迁移占位），与暂缓页呈现策略一致。
 */
export function buildMenuRoutes(ctx: AccessContext): MenuNode[] {
  const tree = filterMenuNodes(appRouteDefinitions, '/', ctx)
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
