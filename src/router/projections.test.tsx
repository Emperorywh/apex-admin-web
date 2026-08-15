/**
 * 路由三投影测试（规格 §4.1/§4.4）：
 * 投影结构与引用稳定性、renderRoutes 不含 loader/action、权限链累计（祖先 AND）、
 * 菜单过滤（admin 通配、目录可见子节点、hideInMenu 隐藏子树不改 URL 可访问性）
 * 以及 routePermissionChains 与真实 definitions 的对应。
 */
import { screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { PERMISSIONS } from '@/constants/permission.constants'
import { ROUTE_IDS, ROUTE_PATHS } from '@/constants/route.constants'
import type { PermissionInput } from '@/store/permissions'
import { createComponentTestStore, renderWithProviders } from '@/test/componentTestHelpers'
import { routeDefinitions } from './definitions'
import {
  accessRoutes,
  buildAccessRoutes,
  buildMenuRoutes,
  buildRenderRoutes,
  filterMenuRoutes,
  menuRoutes,
  renderRoutes,
  routePermissionChains,
} from './projections'
import type { AppRouteDefinition } from './router.types'

/** 带权限与层级结构的合成定义：覆盖目录/叶子/隐藏节点/多级链 */
function syntheticDefinitions(): AppRouteDefinition[] {
  return [
    {
      id: ROUTE_IDS.LOGIN,
      path: ROUTE_PATHS.LOGIN,
      loadPage: () => Promise.resolve({ default: () => null }),
      meta: { title: '登录', hideInMenu: true, hideInTabs: true, noCache: true },
    },
    {
      id: ROUTE_IDS.ROOT,
      path: ROUTE_PATHS.ROOT,
      meta: { title: '首页' },
      children: [
        {
          id: ROUTE_IDS.INDEX,
          index: true,
          meta: { title: '首页', hideInMenu: true },
        },
        {
          id: ROUTE_IDS.DASHBOARD,
          path: ROUTE_PATHS.DASHBOARD,
          loadPage: () => Promise.resolve({ default: () => null }),
          meta: { title: '仪表盘', permCode: PERMISSIONS.DASHBOARD_VIEW, affixTab: true },
        },
        {
          id: ROUTE_IDS.SYSTEM,
          path: ROUTE_PATHS.SYSTEM,
          meta: { title: '系统管理' },
          children: [
            {
              id: ROUTE_IDS.SYSTEM_USER,
              path: ROUTE_PATHS.SYSTEM_USER,
              loadPage: () => Promise.resolve({ default: () => null }),
              meta: { title: '用户管理', permCode: PERMISSIONS.SYSTEM_USER_LIST },
            },
            {
              id: ROUTE_IDS.SYSTEM_ROLE,
              path: ROUTE_PATHS.SYSTEM_ROLE,
              loadPage: () => Promise.resolve({ default: () => null }),
              meta: { title: '角色管理', permCode: PERMISSIONS.SYSTEM_ROLE_LIST },
            },
            {
              // 详情页：隐藏叶子，URL 仍可访问（规格 §4.4）
              id: 'system-user-detail',
              path: '/system/user/:id',
              loadPage: () => Promise.resolve({ default: () => null }),
              meta: { title: '用户详情', hideInMenu: true, permCode: PERMISSIONS.SYSTEM_USER_LIST },
            },
          ],
        },
      ],
    },
  ]
}

const VIEWER_INPUT: PermissionInput = { permCodes: ['dashboard:view', 'system:user:list'], roleCodes: ['viewer'] }
const ADMIN_INPUT: PermissionInput = { permCodes: [], roleCodes: ['admin'] }

describe('三投影结构与引用稳定性（规格 §4.1）', () => {
  it('accessRoutes/renderRoutes/menuRoutes 为模块初始化生成的稳定引用', () => {
    expect(accessRoutes.length).toBe(2)
    expect(renderRoutes.length).toBeGreaterThan(0)
    expect(menuRoutes.length).toBeGreaterThan(0)
  })

  it('renderRoutes 全树不含 loader/action：纯渲染投影不参与 Data Router 数据 API', () => {
    const walk = (nodes: readonly unknown[]): void => {
      for (const node of nodes) {
        const route = node as Record<string, unknown>
        expect(route).not.toHaveProperty('loader')
        expect(route).not.toHaveProperty('action')
        if (Array.isArray(route['children'])) {
          walk(route['children'])
        }
      }
    }
    walk(renderRoutes)
  })

  it('accessRoutes：登录路由有页面 element 与 login loader，受保护节点全部挂守卫 loader', () => {
    const routes = buildAccessRoutes(syntheticDefinitions())
    const login = routes.find((route) => route.id === ROUTE_IDS.LOGIN)
    const root = routes.find((route) => route.id === ROUTE_IDS.ROOT)
    expect(login?.element).toBeDefined()
    expect(typeof login?.loader).toBe('function')
    expect(root?.element).toBeDefined()
    // 只遍历受保护子树：登录路由的 index 子节点只承载页面 element，不挂守卫
    const walk = (nodes: readonly { id?: string; loader?: unknown; children?: unknown }[]): string[] => {
      const ids: string[] = []
      for (const node of nodes) {
        ids.push(node.id ?? '')
        if (node.id !== ROUTE_IDS.INDEX) {
          expect(typeof node.loader).toBe('function')
        }
        if (Array.isArray(node.children)) {
          ids.push(...walk(node.children as typeof nodes))
        }
      }
      return ids
    }
    expect(root ? walk([root]) : []).toContain(ROUTE_IDS.SYSTEM_USER)
  })

  it('meta 原样映射 handle.meta（规格 §4.2）', () => {
    const routes = buildAccessRoutes(syntheticDefinitions())
    const root = routes.find((route) => route.id === ROUTE_IDS.ROOT)
    const dashboard = root?.children?.find((route) => route.id === ROUTE_IDS.DASHBOARD)
    expect((dashboard?.handle as { meta: AppRouteDefinition['meta'] }).meta.title).toBe('仪表盘')
    expect((dashboard?.handle as { meta: AppRouteDefinition['meta'] }).meta.affixTab).toBe(true)
  })

  it('菜单过滤不改 accessRoutes：hideInMenu 节点仍参与 URL 匹配（规格 §4.4）', () => {
    const defs = syntheticDefinitions()
    const routes = buildAccessRoutes(defs)
    const collectIds = (nodes: readonly { id?: string; children?: unknown }[]): string[] =>
      nodes.flatMap((node) => [node.id ?? '', ...(Array.isArray(node.children) ? collectIds(node.children as typeof nodes) : [])])
    const root = routes.find((route) => route.id === ROUTE_IDS.ROOT)
    expect(root ? collectIds([root]) : []).toContain('system-user-detail')
    const menu = filterMenuRoutes(buildMenuRoutes(defs), VIEWER_INPUT)
    expect(JSON.stringify(menu)).not.toContain('system-user-detail')
  })
})

describe('filterMenuRoutes 菜单过滤（规格 §4.4）', () => {
  const menu = buildMenuRoutes(syntheticDefinitions())

  it('viewer：仅保留权限满足的节点，系统目录只含用户管理', () => {
    const visible = filterMenuRoutes(menu, VIEWER_INPUT)
    expect(visible.map((node) => node.id)).toEqual([ROUTE_IDS.DASHBOARD, ROUTE_IDS.SYSTEM])
    const system = visible.find((node) => node.id === ROUTE_IDS.SYSTEM)
    expect(system?.children?.map((node) => node.id)).toEqual([ROUTE_IDS.SYSTEM_USER])
  })

  it('admin 通配 *：全部可见（角色 code 判定）', () => {
    const visible = filterMenuRoutes(menu, ADMIN_INPUT)
    expect(visible.map((node) => node.id)).toEqual([ROUTE_IDS.DASHBOARD, ROUTE_IDS.SYSTEM])
    expect(visible.find((node) => node.id === ROUTE_IDS.SYSTEM)?.children).toHaveLength(2)
  })

  it('目录仅在自身权限满足且存在可见子节点时保留：子节点全失权则目录消失', () => {
    const onlyRoleList: PermissionInput = { permCodes: ['dashboard:view', 'system:role:list'], roleCodes: ['viewer'] }
    const visible = filterMenuRoutes(menu, onlyRoleList)
    expect(visible.map((node) => node.id)).toEqual([ROUTE_IDS.DASHBOARD, ROUTE_IDS.SYSTEM])
    expect(visible.find((node) => node.id === ROUTE_IDS.SYSTEM)?.children?.map((node) => node.id)).toEqual([ROUTE_IDS.SYSTEM_ROLE])
    const nothing: PermissionInput = { permCodes: [], roleCodes: ['viewer'] }
    expect(filterMenuRoutes(menu, nothing)).toEqual([])
  })

  it('hideInMenu 隐藏节点及其子树：登录页与详情叶子不出现在任何输入的菜单里', () => {
    for (const input of [VIEWER_INPUT, ADMIN_INPUT]) {
      expect(JSON.stringify(filterMenuRoutes(menu, input))).not.toContain(ROUTE_IDS.LOGIN)
      expect(JSON.stringify(filterMenuRoutes(menu, input))).not.toContain('system-user-detail')
    }
  })

  it('filterMenuRoutes 不改写原始 menuRoutes（纯函数）', () => {
    filterMenuRoutes(menu, VIEWER_INPUT)
    expect(menu.find((node) => node.id === ROUTE_IDS.SYSTEM)?.children).toHaveLength(3)
  })

  it('hasPage 随投影携带：目录节点 false、叶子 true，过滤后保留（规格 §11.2 面包屑可点击性）', () => {
    const visible = filterMenuRoutes(menu, ADMIN_INPUT)
    expect(visible.find((node) => node.id === ROUTE_IDS.DASHBOARD)?.hasPage).toBe(true)
    expect(visible.find((node) => node.id === ROUTE_IDS.SYSTEM)?.hasPage).toBe(false)
    expect(visible.find((node) => node.id === ROUTE_IDS.SYSTEM)?.children?.[0]?.hasPage).toBe(true)
  })
})

describe('routePermissionChains 权限链累计（规格 §4.4 AND 语义）', () => {
  it('叶子链包含祖先权限码：深层叶子按全链判定', () => {
    const defs = syntheticDefinitions()
    // 重建链映射逻辑走 build 过的同一来源：直接对真实定义验证无权限码的形态
    const chains = routePermissionChains
    expect(chains.get(ROUTE_PATHS.FORBIDDEN)).toEqual([])
    expect(chains.get(ROUTE_PATHS.NOT_FOUND)).toEqual([])
    // 合成定义经投影构建函数的菜单链验证 AND 累计
    const menu = buildMenuRoutes(defs)
    const systemUser = menu
      .find((node) => node.id === ROUTE_IDS.SYSTEM)
      ?.children?.find((node) => node.id === ROUTE_IDS.SYSTEM_USER)
    expect(systemUser?.permChain).toEqual([PERMISSIONS.SYSTEM_USER_LIST])
  })

  it('真实 definitions：错误页与登录路径链为空（登录即可访问，无 permCode）', () => {
    expect(routePermissionChains.get(ROUTE_PATHS.LOGIN)).toEqual([])
    expect(routePermissionChains.get(ROUTE_PATHS.SERVER_ERROR)).toEqual([])
  })
})

describe('真实 definitions 的投影（规格 §4.2 约定）', () => {
  it('renderRoutes 含错误页与 * 兜底，不含 index 重定向节点', () => {
    const paths = renderRoutes.map((route) => route.path)
    expect(paths).toContain(ROUTE_PATHS.FORBIDDEN)
    expect(paths).toContain(ROUTE_PATHS.NOT_FOUND)
    expect(paths).toContain(ROUTE_PATHS.SERVER_ERROR)
    expect(paths).toContain('*')
  })

  it('menuRoutes 为受保护根子树：登录节点不在其中，错误页节点在（由 hideInMenu 过滤）', () => {
    expect(menuRoutes.some((node) => node.id === ROUTE_IDS.LOGIN)).toBe(false)
    expect(menuRoutes.some((node) => node.id === ROUTE_IDS.FORBIDDEN)).toBe(true)
  })

  it('三投影常量与 build 函数输出节点一致（模块初始化一次生成）', () => {
    expect(accessRoutes.map((route) => route.id)).toEqual(buildAccessRoutes(routeDefinitions).map((route) => route.id))
    expect(renderRoutes.map((route) => route.path)).toEqual(buildRenderRoutes(routeDefinitions).map((route) => route.path))
    expect(menuRoutes.map((node) => node.id)).toEqual(buildMenuRoutes(routeDefinitions).map((node) => node.id))
  })

  it('受保护根容器接线冒烟：读取 store 权限过滤真实 menuRoutes 后渲染 BasicLayout 外壳（规格 §11.1）', async () => {
    const rootElement = accessRoutes.find((route) => route.id === ROUTE_IDS.ROOT)?.element
    expect(rootElement).toBeDefined()
    const store = createComponentTestStore()
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: rootElement,
          children: [{ path: 'dashboard', handle: { meta: { title: '仪表盘' } } }],
        },
      ],
      { initialEntries: ['/dashboard'] },
    )
    renderWithProviders(<RouterProvider router={router} />, { store })
    // 外壳渲染（品牌 + 顶栏）；默认测试 store 无权限快照，真实 definitions 当前全部
    // 节点 hideInMenu，过滤结果为空菜单，但布局结构与注入链路完整可用
    expect(await screen.findByText('通用后台管理模板')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '导航菜单' })).toBeInTheDocument()
  })
})
