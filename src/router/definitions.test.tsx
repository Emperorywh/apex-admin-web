/**
 * 路由定义唯一来源测试（规格 §4.1/§4.2）：
 * id 全局唯一且引用 route.constants、§4.2 约定的 meta 标记（登录/错误页 hideInMenu/
 * hideInTabs/noCache、错误页 breadcrumb:false）、index 与 * 兜底节点、接口结构性不含 action。
 */
import { describe, expect, expectTypeOf, it } from 'vitest'
import { DASHBOARD_I18N_NAMESPACE } from '@/constants/dashboard/dashboard.constants'
import { DEMO_NESTED_I18N_NAMESPACE } from '@/constants/demo/demo.constants'
import { PERMISSIONS } from '@/constants/permission.constants'
import { PROFILE_I18N_NAMESPACE } from '@/constants/profile/profile.constants'
import { ROUTE_IDS, ROUTE_PATHS } from '@/constants/route.constants'
import { MENU_I18N_NAMESPACE } from '@/constants/system/menu/menu.constants'
import { ROLE_I18N_NAMESPACE } from '@/constants/system/role/role.constants'
import { USER_I18N_NAMESPACE } from '@/constants/system/user/user.constants'
import { routeDefinitions } from './definitions'
import type { AppRouteDefinition } from './router.types'

/** 深度遍历全部节点 */
function flatten(defs: readonly AppRouteDefinition[]): AppRouteDefinition[] {
  return defs.flatMap((def) => [def, ...flatten(def.children ?? [])])
}

describe('routeDefinitions（规格 §4.2）', () => {
  const nodes = flatten(routeDefinitions)

  it('每个节点 id 全局唯一且稳定', () => {
    const ids = nodes.map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('id 与路径引用 route.constants 常量', () => {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    expect(byId.get(ROUTE_IDS.LOGIN)?.path).toBe(ROUTE_PATHS.LOGIN)
    expect(byId.get(ROUTE_IDS.ROOT)?.path).toBe(ROUTE_PATHS.ROOT)
    expect(byId.get(ROUTE_IDS.FORBIDDEN)?.path).toBe(ROUTE_PATHS.FORBIDDEN)
    expect(byId.get(ROUTE_IDS.NOT_FOUND)?.path).toBe(ROUTE_PATHS.NOT_FOUND)
    expect(byId.get(ROUTE_IDS.SERVER_ERROR)?.path).toBe(ROUTE_PATHS.SERVER_ERROR)
    expect(byId.get(ROUTE_IDS.NOT_FOUND_SPLAT)?.path).toBe('*')
  })

  it('受保护根存在 index route（固定 replace /dashboard）与 * 兜底（渲染 404）', () => {
    const root = routeDefinitions.find((def) => def.id === ROUTE_IDS.ROOT)
    expect(root?.children?.some((child) => child.id === ROUTE_IDS.INDEX && child.index === true)).toBe(true)
    expect(root?.children?.some((child) => child.id === ROUTE_IDS.NOT_FOUND_SPLAT && child.path === '*')).toBe(true)
  })

  it('登录/403/404/500/* 固定 hideInMenu/hideInTabs/noCache，错误页 breadcrumb:false', () => {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    for (const id of [ROUTE_IDS.LOGIN, ROUTE_IDS.FORBIDDEN, ROUTE_IDS.NOT_FOUND, ROUTE_IDS.SERVER_ERROR, ROUTE_IDS.NOT_FOUND_SPLAT]) {
      const meta = byId.get(id)?.meta
      expect(meta?.hideInMenu, `${id} hideInMenu`).toBe(true)
      expect(meta?.hideInTabs, `${id} hideInTabs`).toBe(true)
      expect(meta?.noCache, `${id} noCache`).toBe(true)
    }
    for (const id of [ROUTE_IDS.FORBIDDEN, ROUTE_IDS.NOT_FOUND, ROUTE_IDS.SERVER_ERROR, ROUTE_IDS.NOT_FOUND_SPLAT]) {
      expect(byId.get(id)?.meta.breadcrumb, `${id} breadcrumb`).toBe(false)
    }
  })

  it('登录/403/404/500/* 均无 permCode，防止错误页自身形成权限循环（规格 §4.2）', () => {
    const withoutPermCode = new Set<string>([ROUTE_IDS.LOGIN, ROUTE_IDS.FORBIDDEN, ROUTE_IDS.NOT_FOUND, ROUTE_IDS.SERVER_ERROR, ROUTE_IDS.NOT_FOUND_SPLAT])
    for (const node of nodes) {
      if (withoutPermCode.has(node.id)) {
        expect(node.meta.permCode, `${node.id} permCode`).toBeUndefined()
      }
    }
  })

  it('Dashboard 叶子完整 meta：唯一默认 affix、权限 dashboard:view、i18n 命名空间声明（规格 §4.2）', () => {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const dashboard = byId.get(ROUTE_IDS.DASHBOARD)
    expect(dashboard?.path).toBe(ROUTE_PATHS.DASHBOARD)
    expect(dashboard?.meta.affixTab).toBe(true)
    expect(dashboard?.meta.permCode).toBe(PERMISSIONS.DASHBOARD_VIEW)
    expect(dashboard?.meta.i18nNamespaces).toEqual([DASHBOARD_I18N_NAMESPACE])
    // affix 唯一性：仅 Dashboard 一个默认固定页签（规格 §4.2）
    const affixNodes = nodes.filter((node) => node.meta.affixTab === true)
    expect(affixNodes.map((node) => node.id)).toEqual([ROUTE_IDS.DASHBOARD])
  })

  it('用户管理节点：目录分组 + 叶子页面权限 system:user:list + user 命名空间（规格 §14.2/§12）', () => {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const system = byId.get(ROUTE_IDS.SYSTEM)
    expect(system?.path).toBe(ROUTE_PATHS.SYSTEM)
    expect(system?.loadPage).toBeUndefined()
    const userPage = byId.get(ROUTE_IDS.SYSTEM_USER)
    expect(userPage?.path).toBe(ROUTE_PATHS.SYSTEM_USER)
    expect(userPage?.meta.permCode).toBe(PERMISSIONS.SYSTEM_USER_LIST)
    expect(userPage?.meta.i18nNamespaces).toEqual([USER_I18N_NAMESPACE])
  })

  it('角色管理节点：叶子页面权限 system:role:list + role 命名空间（规格 §14.2/§12；viewer 无权限时菜单隐藏且直达 403）', () => {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const rolePage = byId.get(ROUTE_IDS.SYSTEM_ROLE)
    expect(rolePage?.path).toBe(ROUTE_PATHS.SYSTEM_ROLE)
    expect(rolePage?.meta.permCode).toBe(PERMISSIONS.SYSTEM_ROLE_LIST)
    expect(rolePage?.meta.i18nNamespaces).toEqual([ROLE_I18N_NAMESPACE])
    // 挂在系统管理目录下，与用户管理同级
    const system = byId.get(ROUTE_IDS.SYSTEM)
    expect(system?.children?.map((child) => child.id)).toContain(ROUTE_IDS.SYSTEM_ROLE)
  })

  it('菜单管理节点：叶子页面权限 system:menu:list + systemMenu 命名空间（规格 §14.2/§12；viewer 无权限时菜单隐藏且直达 403）', () => {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const menuPage = byId.get(ROUTE_IDS.SYSTEM_MENU)
    expect(menuPage?.path).toBe(ROUTE_PATHS.SYSTEM_MENU)
    expect(menuPage?.meta.permCode).toBe(PERMISSIONS.SYSTEM_MENU_LIST)
    expect(menuPage?.meta.i18nNamespaces).toEqual([MENU_I18N_NAMESPACE])
    // 挂在系统管理目录下，与用户/角色管理同级
    const system = byId.get(ROUTE_IDS.SYSTEM)
    expect(system?.children?.map((child) => child.id)).toContain(ROUTE_IDS.SYSTEM_MENU)
  })

  it('多级菜单演示：三级层级叶子路由挂同一实现，权限 demo:nested:view 声明于多级菜单目录（规格 §14.2/§4.4/§12）', () => {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    // 演示目录 > 多级菜单目录 > 三个层级叶子：构成三级菜单（§19.1 验收项）
    const demo = byId.get(ROUTE_IDS.DEMO)
    expect(demo?.path).toBe(ROUTE_PATHS.DEMO)
    expect(demo?.loadPage).toBeUndefined()
    const nested = byId.get(ROUTE_IDS.DEMO_NESTED)
    expect(nested?.path).toBe(ROUTE_PATHS.DEMO_NESTED)
    // 子树权限声明在目录节点：祖先与叶子 AND（规格 §4.4），admin/viewer 均持有（规格 §5.3）
    expect(nested?.meta.permCode).toBe(PERMISSIONS.DEMO_NESTED_VIEW)
    expect(nested?.children?.map((child) => child.id)).toEqual([
      ROUTE_IDS.DEMO_NESTED_LEVEL1,
      ROUTE_IDS.DEMO_NESTED_LEVEL2,
      ROUTE_IDS.DEMO_NESTED_LEVEL3,
    ])
    for (const [id, path] of [
      [ROUTE_IDS.DEMO_NESTED_LEVEL1, ROUTE_PATHS.DEMO_NESTED_LEVEL1],
      [ROUTE_IDS.DEMO_NESTED_LEVEL2, ROUTE_PATHS.DEMO_NESTED_LEVEL2],
      [ROUTE_IDS.DEMO_NESTED_LEVEL3, ROUTE_PATHS.DEMO_NESTED_LEVEL3],
    ] as const) {
      const level = byId.get(id)
      expect(level?.path, `${id} path`).toBe(path)
      expect(level?.meta.i18nNamespaces, `${id} namespaces`).toEqual([DEMO_NESTED_I18N_NAMESPACE])
      expect(level?.meta.permCode).toBeUndefined()
    }
  })

  it('个人中心：仅登录无 permCode、hideInMenu、profile 命名空间（规格 §14.2/§5.3/§12）', () => {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const profile = byId.get(ROUTE_IDS.PROFILE)
    expect(profile?.path).toBe(ROUTE_PATHS.PROFILE)
    expect(profile?.meta.permCode).toBeUndefined()
    expect(profile?.meta.hideInMenu).toBe(true)
    // 入口为 Header 用户菜单：正常生成页签且可缓存（不设 hideInTabs/noCache）
    expect(profile?.meta.hideInTabs).toBeUndefined()
    expect(profile?.meta.noCache).toBeUndefined()
    expect(profile?.meta.i18nNamespaces).toEqual([PROFILE_I18N_NAMESPACE])
  })

  it('叶子节点均有 loadPage，目录节点无 loadPage（规格 §4.2）', () => {
    for (const node of nodes) {
      const hasChildren = (node.children?.length ?? 0) > 0
      if (hasChildren) {
        expect(node.loadPage).toBeUndefined()
      } else if (node.id !== ROUTE_IDS.INDEX) {
        expect(node.loadPage).toBeTypeOf('function')
      }
    }
  })

  it('loadPage 均解析为 { default: 组件 } 形态（@/pages 具名路径懒加载）', async () => {
    for (const node of nodes) {
      if (node.loadPage === undefined) {
        continue
      }
      const mod = await node.loadPage()
      expect(typeof mod.default, `${node.id} loadPage default`).toBe('function')
    }
  }, 20_000)
})

describe('AppRouteDefinition 接口契约（规格 §4.2：不含 action 字段）', () => {
  it('接口结构性不可用 route action：不存在 action 属性', () => {
    type HasAction = AppRouteDefinition extends { action: unknown } ? true : false
    expectTypeOf<HasAction>().toEqualTypeOf<false>()
  })
})
