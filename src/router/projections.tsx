/**
 * 路由三投影（规格 §4.1）：
 * definitions.tsx 的 AppRouteDefinition[] 是唯一来源，模块初始化时一次生成三份只读投影，
 * 投影对象与其中 lazy component 引用稳定，不得在渲染期重建：
 * 1. accessRoutes——全量注册 createBrowserRouter，负责 URL 匹配、认证 loader、权限 loader、
 *    重定向与路由级错误；受保护业务叶子只返回空锚点，不直接渲染业务页；
 * 2. renderRoutes——不含 loader/action，仅目录结构与 React.lazy 页面组件；
 *    以 useRoutes(renderRoutes, locationSnapshot) 渲染，让每个缓存页签获得独立路由上下文；
 * 3. menuRoutes——受保护根子树的菜单形态投影，按权限、后端菜单树白名单与 hideInMenu
 *    过滤后供侧边/顶部菜单使用（§4.4 v1.15）。
 */
import { lazy, Suspense, createElement, useMemo, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import { Outlet, type RouteObject } from 'react-router'
import { useSelector } from 'react-redux'
import { ROUTE_IDS } from '@/constants/route.constants'
import { BlankLayout } from '@/layouts/BlankLayout/BlankLayout'
import { BasicLayout } from '@/layouts/BasicLayout/BasicLayout'
import type { AffixTabRoute } from '@/layouts/BasicLayout/tabsModel'
import { PageLoading } from '@/components/PageLoading/PageLoading'
import { getDefaultAuthSessionRuntime } from '@/services/auth/auth.session'
import { hasPermissionChain, type PermissionInput } from '@/store/permissions'
import type { RootState } from '@/store/store'
import { routeDefinitions } from './definitions'
import {
  createIndexRedirectLoader,
  createLoginRouteLoader,
  createProtectedRouteLoader,
  resolveDefaultGuardDeps,
} from './guard'
import type { AppRouteDefinition, MenuRouteNode } from './router.types'

type LoadPageFn = NonNullable<AppRouteDefinition['loadPage']>

/** lazy 页面组件缓存：按 loadPage 函数引用去重，模块生命周期内引用稳定（规格 §4.1） */
const lazyPageCache = new Map<LoadPageFn, LazyExoticComponent<ComponentType>>()

function getLazyPage(loadPage: LoadPageFn): LazyExoticComponent<ComponentType> {
  const existing = lazyPageCache.get(loadPage)
  if (existing !== undefined) {
    return existing
  }
  const created = lazy(loadPage)
  lazyPageCache.set(loadPage, created)
  return created
}

/** 懒加载页面锚点：React.lazy + Suspense(PageLoading)（规格 §4.2） */
function pageAnchor(def: AppRouteDefinition): ReactNode {
  return <Suspense fallback={<PageLoading />}>{createElement(getLazyPage(def.loadPage!))}</Suspense>
}

/** 累计权限码链：祖先与叶子 AND（规格 §4.4）；无 permCode 的节点透传祖先链 */
function accumulateChain(inherited: readonly string[], def: AppRouteDefinition): readonly string[] {
  return def.meta.permCode === undefined ? inherited : [...inherited, def.meta.permCode]
}

/** 受保护根定义：id 固定为 ROUTE_IDS.ROOT 的节点 */
function findProtectedRoot(defs: readonly AppRouteDefinition[]): AppRouteDefinition | undefined {
  return defs.find((def) => def.id === ROUTE_IDS.ROOT)
}

// ── 投影 1：accessRoutes ──

/**
 * 受保护根容器（规格 §4.1/§11.1）：BasicLayout 在受保护根路由内只挂载一次的唯一装配点。
 * 布局层不得反向导入 router/（依赖方向固定为 router → layouts），因此由本容器读取
 * user 切片权限快照与菜单路径白名单、复用 filterMenuRoutes 与守卫同一个
 * hasPermissionChain 判定完成菜单过滤（权限/菜单树/hideInMenu/目录保留，规格 §4.4 v1.15），
 * 并把 navItems、纯渲染投影与
 * 登出状态机经 props 注入 BasicLayout；页面渲染由 BasicLayout 内的
 * useRoutes(renderRoutes) 以 Data Router 当前 location 承担（规格 §4.1）。
 */
/** 用户菜单退出登录回调：执行登出状态机，post-logout 导航意图由路由接线消费 */
const logoutFromUserMenu = (): Promise<void> => getDefaultAuthSessionRuntime().logoutSession()

// 容器与投影构建器同文件：路由装配文件不做 Fast Refresh，局部禁用该告警
// oxlint-disable-next-line react/only-export-components
function ProtectedRoot(): ReactNode {
  // 分别订阅数组/白名单引用：避免整对象选择器因每次返回新引用导致任意 dispatch 都重渲染
  const permCodes = useSelector((state: RootState) => state.user.permCodes)
  const roleCodes = useSelector((state: RootState) => state.user.roles)
  const menuPaths = useSelector((state: RootState) => state.user.menuPaths)
  const navItems = useMemo(() => {
    // 菜单树白名单规范化为 Set：null（admin 超管）表示不受菜单树限制（规格 §4.4 v1.15）
    const menuPathSet = menuPaths === null ? null : new Set(menuPaths.map(normalizeMenuPath))
    return filterMenuRoutes(menuRoutes, { permCodes, roleCodes }, menuPathSet)
  }, [permCodes, roleCodes, menuPaths])
  return (
    <BasicLayout
      navItems={navItems}
      renderRoutes={renderRoutes}
      affixTabRoutes={affixTabRoutes}
      onLogout={logoutFromUserMenu}
    />
  )
}

/** 登录路由（公开）：BlankLayout 布局承载页面，loader 处理已登录直达（规格 §4.3） */
function buildLoginAccessRoute(def: AppRouteDefinition): RouteObject {
  return {
    id: def.id,
    path: def.path,
    handle: { meta: def.meta },
    element: <BlankLayout />,
    loader: createLoginRouteLoader(resolveDefaultGuardDeps),
    children: [{ index: true, element: pageAnchor(def) }],
  }
}

/**
 * 受保护路由节点：每个节点挂同一守卫 loader（父子并行安全，规格 §4.3）。
 * 目录节点渲染 Outlet 透传；业务叶子为空锚点，页面渲染由受保护根外壳经 renderRoutes 承担（规格 §4.1）。
 */
function buildProtectedAccessRoute(def: AppRouteDefinition, inherited: readonly string[]): RouteObject {
  const chain = accumulateChain(inherited, def)
  // index route 只做固定 replace /dashboard（规格 §4.2）；其余节点一律挂守卫
  const node: RouteObject =
    def.index === true
      ? {
          id: def.id,
          index: true,
          handle: { meta: def.meta },
          loader: createIndexRedirectLoader(),
        }
      : {
          id: def.id,
          path: def.path,
          handle: { meta: def.meta },
          loader: createProtectedRouteLoader(resolveDefaultGuardDeps, chain),
        }
  if (def.id === ROUTE_IDS.ROOT) {
    node.element = <ProtectedRoot />
  }
  if (def.children !== undefined && def.children.length > 0) {
    node.children = def.children.map((child) => buildProtectedAccessRoute(child, chain))
    if (node.element === undefined) {
      node.element = <Outlet />
    }
  }
  return node
}

/** 生成 accessRoutes 投影：全量注册 createBrowserRouter（规格 §4.1 投影 1） */
export function buildAccessRoutes(defs: readonly AppRouteDefinition[]): RouteObject[] {
  return defs.map((def) =>
    def.id === ROUTE_IDS.LOGIN ? buildLoginAccessRoute(def) : buildProtectedAccessRoute(def, []),
  )
}

// ── 投影 2：renderRoutes ──

/**
 * 纯渲染节点：目录结构 + React.lazy 页面组件，不含 loader/action（规格 §4.1 投影 2）。
 * index route 仅做重定向、无页面组件，不进入纯渲染投影。
 */
function buildRenderRoute(def: AppRouteDefinition): RouteObject | null {
  if (def.index === true) {
    return null
  }
  if (def.loadPage === undefined) {
    const children = def.children?.map(buildRenderRoute).filter((node): node is RouteObject => node !== null) ?? []
    // 没有任何可渲染后代的目录不进入投影
    if (children.length === 0) {
      return null
    }
    return { path: def.path, element: <Outlet />, children }
  }
  return { path: def.path, element: pageAnchor(def) }
}

/**
 * 生成 renderRoutes 投影：受保护根子树的纯渲染形态，供受保护根外壳与
 * CachedRouteView 的 useRoutes(renderRoutes, locationSnapshot) 使用（规格 §4.1/§9.1）。
 */
export function buildRenderRoutes(defs: readonly AppRouteDefinition[]): RouteObject[] {
  const root = findProtectedRoot(defs)
  return (
    root?.children
      ?.map(buildRenderRoute)
      .filter((node): node is RouteObject => node !== null) ?? []
  )
}

// ── 投影 3：menuRoutes 与权限过滤 ──

/** 菜单投影节点：保留 hideInMenu 供过滤函数统一处理，权限码链与 hasPage 随节点携带 */
function buildMenuRoute(def: AppRouteDefinition, inherited: readonly string[]): MenuRouteNode {
  const chain = accumulateChain(inherited, def)
  const node: MenuRouteNode = {
    id: def.id,
    path: def.path,
    title: def.meta.title,
    icon: def.meta.icon,
    caption: def.meta.caption,
    // 是否挂载页面组件：目录节点 false，布局面包屑据此判定不可点击（规格 §11.2）
    hasPage: def.loadPage !== undefined,
    hideInMenu: def.meta.hideInMenu,
    permChain: chain,
  }
  if (def.children !== undefined && def.children.length > 0) {
    node.children = def.children.map((child) => buildMenuRoute(child, chain))
  }
  return node
}

/**
 * 生成 menuRoutes 投影：受保护根子树的原始菜单形态（未过滤）；
 * 权限与可见性过滤统一经 filterMenuRoutes 完成（规格 §4.1 投影 3/§4.4）。
 */
export function buildMenuRoutes(defs: readonly AppRouteDefinition[]): MenuRouteNode[] {
  const root = findProtectedRoot(defs)
  return root?.children?.map((child) => buildMenuRoute(child, [])) ?? []
}

/** 拼接父子路径：定义一律使用绝对路径，此处兼容相对段以保持通用 */
function joinRoutePath(parent: string, segment: string | undefined): string {
  if (segment === undefined) {
    return parent
  }
  if (segment.startsWith('/')) {
    return segment
  }
  return parent === '' || parent === '/' ? `/${segment}` : `${parent}/${segment}`
}

/**
 * 生成 affix 页签投影（规格 §9.3）：meta.affixTab 且挂载页面的叶子（默认仅 Dashboard），
 * 供 BasicLayout 浏览器刷新后重建「Dashboard + 当前页签」；权限不参与——所有可登录
 * 账号必须可访问 affix 页（会话资格校验保证，规格 §4.2）。
 */
export function buildAffixTabRoutes(defs: readonly AppRouteDefinition[]): AffixTabRoute[] {
  const affixes: AffixTabRoute[] = []
  const visit = (def: AppRouteDefinition, parentPath: string): void => {
    const fullPath = joinRoutePath(parentPath, def.path)
    if (def.meta.affixTab === true && def.loadPage !== undefined && def.path !== undefined) {
      affixes.push({ pathname: fullPath, title: def.meta.title })
    }
    for (const child of def.children ?? []) {
      visit(child, fullPath)
    }
  }
  for (const def of defs) {
    visit(def, '')
  }
  return affixes
}

/**
 * 规范化菜单路径（规格 §4.4 v1.15）：补齐开头 `/`、去除末尾多余 `/`（根路径除外），
 * 空串归一为 `/`。后端菜单树 path 白名单与静态路由累计全路径统一经本函数比对，
 * 不得在调用点另写一份规范化。
 */
function normalizeMenuPath(path: string): string {
  const withLeading = path === '' ? '/' : path.startsWith('/') ? path : `/${path}`
  return withLeading.length > 1 && withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading
}

/**
 * 菜单过滤（规格 §4.4 v1.15）：与守卫共用 hasPermissionChain 单一判定。
 * - hideInMenu 隐藏该节点及其菜单子树，但不改变 URL 可访问性（accessRoutes 不受影响）；
 * - 无 permCode 的节点对所有已登录用户可见；
 * - 后端菜单树白名单（menuPaths，来自 GET /me/menus）只约束叶子页面：累计全路径
 *   命中白名单才展示；目录不直接比对（后端树父子连带、目录 path 可空），经可见子节点
 *   间接保留。menuPaths 为 null（admin 超管）表示不受菜单树限制，直接展示全部菜单；
 * - 目录菜单仅在自身权限满足且至少有一个可见子节点时保留。
 */
export function filterMenuRoutes(
  nodes: readonly MenuRouteNode[],
  input: PermissionInput,
  menuPaths: ReadonlySet<string> | null,
): MenuRouteNode[] {
  const filterNodes = (list: readonly MenuRouteNode[], parentPath: string): MenuRouteNode[] => {
    const visible: MenuRouteNode[] = []
    for (const node of list) {
      if (node.hideInMenu === true) {
        continue
      }
      const fullPath = normalizeMenuPath(joinRoutePath(parentPath, node.path))
      const treeAllowed = menuPaths === null || node.hasPage !== true || menuPaths.has(fullPath)
      const selfPermitted = treeAllowed && hasPermissionChain(node.permChain, input)
      if (node.children !== undefined && node.children.length > 0) {
        const visibleChildren = filterNodes(node.children, fullPath)
        if (selfPermitted && visibleChildren.length > 0) {
          visible.push({ ...node, children: visibleChildren })
        }
        continue
      }
      if (selfPermitted) {
        visible.push(node)
      }
    }
    return visible
  }
  return filterNodes(nodes, '')
}

/** 三投影常量：模块初始化时生成一次，引用稳定（规格 §4.1）；affixTabRoutes 为页签重建附属投影 */
export const accessRoutes: RouteObject[] = buildAccessRoutes(routeDefinitions)
export const renderRoutes: RouteObject[] = buildRenderRoutes(routeDefinitions)
export const menuRoutes: MenuRouteNode[] = buildMenuRoutes(routeDefinitions)
export const affixTabRoutes: AffixTabRoute[] = buildAffixTabRoutes(routeDefinitions)
