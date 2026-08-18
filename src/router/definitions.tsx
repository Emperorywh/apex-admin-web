/**
 * 路由定义唯一来源（规格 §4.1/§4.2）：
 * AppRouteDefinition[] 是 accessRoutes/renderRoutes/menuRoutes 三份投影的唯一输入，
 * 每个节点必须有稳定且全局唯一的 id；框架核心路由（受保护根、登录、仪表盘、个人中心、
 * 错误页）的 ID/路径/回退地址引用 route.constants，业务页面节点的 id/path 在本文件
 * 直接内联（规格 §4.2 v1.10），新增页面无需再改动 route.constants。
 *
 * loadPage 只允许 @/pages/... 具名实现路径懒加载（规格 §4.2），禁止从 features 加载页面
 * 或依赖 index 解析；结构门禁按 loadPage 内联动态导入的字面形态校验目标归属，
 * 因此保持内联动态导入，并用 .then 把页面具名导出映射为 React.lazy 需要的 default 形态。
 * 业务页面路由随各自任务增量扩展；受保护根外壳由 projections 的 ProtectedRoot
 * 容器挂载 BasicLayout 承担渲染。
 */
import { DASHBOARD_I18N_NAMESPACE } from '@/constants/dashboard/dashboard.constants'
import { PERMISSIONS } from '@/constants/permission.constants'
import { PROFILE_I18N_NAMESPACE } from '@/constants/profile/profile.constants'
import { ROUTE_IDS, ROUTE_PATHS } from '@/constants/route.constants'
import { MENU_I18N_NAMESPACE } from '@/constants/system/menu/menu.constants'
import { ROLE_I18N_NAMESPACE } from '@/constants/system/role/role.constants'
import { USER_I18N_NAMESPACE } from '@/constants/system/user/user.constants'
import { LOCAL_ICON_PREFIX } from '@/components/AppIcon/AppIcon'
import type { AppRouteDefinition } from './router.types'

/**
 * 路由定义（规格 §4.2 约定逐项落实）：
 * - /login 公开路由，BlankLayout 承载；登录与错误页固定 hideInMenu/hideInTabs/noCache；
 * - 受保护根 / 之下全部节点要求登录；错误页无 permCode，防止错误页自身形成权限循环；
 * - 错误页 breadcrumb:false；/ 是受保护 index route，固定 replace 到 /dashboard；
 * - 受保护根内 * 渲染 404（与显式 /404 是两个独立节点，渲染同一页面实现）。
 */
export const routeDefinitions: readonly AppRouteDefinition[] = [
  {
    id: ROUTE_IDS.LOGIN,
    path: ROUTE_PATHS.LOGIN,
    loadPage: () => import('@/pages/auth/Login/Login').then(({ Login }) => ({ default: Login })),
    meta: { title: '登录', hideInMenu: true, hideInTabs: true, noCache: true },
  },
  {
    id: ROUTE_IDS.ROOT,
    path: ROUTE_PATHS.ROOT,
    meta: { title: '首页' },
    children: [
      {
        // 受保护 index route：固定 replace 重定向到 /dashboard（规格 §4.2），无页面组件
        id: ROUTE_IDS.INDEX,
        index: true,
        meta: { title: '首页', hideInMenu: true, hideInTabs: true },
      },
      {
        // Dashboard（规格 §4.2/§14.2）：唯一默认 affix 页签；所有可登录账号必须持有
        // dashboard:view（admin 通配），否则会话资格校验按 AUTH_FORBIDDEN 清理会话；
        // i18nNamespaces 声明 dashboard 命名空间（规格 §12）。
        id: ROUTE_IDS.DASHBOARD,
        path: ROUTE_PATHS.DASHBOARD,
        loadPage: () => import('@/pages/dashboard/Dashboard/Dashboard').then(({ Dashboard }) => ({ default: Dashboard })),
        meta: {
          title: '仪表盘',
          icon: `${LOCAL_ICON_PREFIX}ic-dashboard`,
          caption: '工作台',
          permCode: PERMISSIONS.DASHBOARD_VIEW,
          affixTab: true,
          i18nNamespaces: [DASHBOARD_I18N_NAMESPACE],
        },
      },
      {
        // 系统管理目录节点（规格 §14.2）：无 permCode，仅承担菜单/面包屑分组；
        // 目录菜单只在自身权限满足且至少有一个可见子节点时保留（规格 §4.4）
        id: 'system',
        path: '/system',
        meta: { title: '系统管理', icon: `${LOCAL_ICON_PREFIX}ic-management`, caption: '组织与权限' },
        children: [
          {
            // 用户管理（规格 §14.2/§14.3）：查询/分页/Drawer CRUD/角色分配；
            // 页面权限 system:user:list，按钮级权限由页内 <Auth> 门控；
            // i18nNamespaces 声明 user 命名空间（规格 §12）
            id: 'system-user',
            path: '/system/user',
            loadPage: () => import('@/pages/system/user/User/User').then(({ User }) => ({ default: User })),
            meta: {
              title: '用户管理',
              icon: `${LOCAL_ICON_PREFIX}ic-user`,
              permCode: PERMISSIONS.SYSTEM_USER_LIST,
              i18nNamespaces: [USER_I18N_NAMESPACE],
            },
          },
          {
            // 角色管理（规格 §14.2/§14.3）：CRUD/权限树分配；viewer 无 system:role:list，
            // 菜单隐藏且直达被守卫重定向 /403（规格 §5.3 矩阵）；
            // i18nNamespaces 声明 role 命名空间（规格 §12）
            id: 'system-role',
            path: '/system/role',
            loadPage: () => import('@/pages/system/role/Role/Role').then(({ Role }) => ({ default: Role })),
            meta: {
              title: '角色管理',
              icon: `${LOCAL_ICON_PREFIX}ic-role`,
              permCode: PERMISSIONS.SYSTEM_ROLE_LIST,
              i18nNamespaces: [ROLE_I18N_NAMESPACE],
            },
          },
          {
            // 菜单管理（规格 §14.2/§14.3）：树表维护后端菜单数据，明确不动态改变前端
            // 静态路由；viewer 无 system:menu:list，菜单隐藏且直达被守卫重定向 /403
            // （规格 §5.3 矩阵）；i18nNamespaces 声明 systemMenu 命名空间（规格 §12）
            id: 'system-menu',
            path: '/system/menu',
            loadPage: () => import('@/pages/system/menu/Menu/Menu').then(({ Menu }) => ({ default: Menu })),
            meta: {
              title: '菜单管理',
              icon: `${LOCAL_ICON_PREFIX}ic-menu`,
              permCode: PERMISSIONS.SYSTEM_MENU_LIST,
              i18nNamespaces: [MENU_I18N_NAMESPACE],
            },
          },
        ],
      },
      {
        // 个人中心（规格 §14.2）：仅要求登录、不分配 permCode（规格 §5.3）；
        // 入口为 Header 用户菜单，不在侧边/顶部菜单展示（hideInMenu 不影响 URL 可访问性，规格 §4.4）
        id: ROUTE_IDS.PROFILE,
        path: ROUTE_PATHS.PROFILE,
        loadPage: () => import('@/pages/profile/Profile/Profile').then(({ Profile }) => ({ default: Profile })),
        meta: { title: '个人中心', hideInMenu: true, i18nNamespaces: [PROFILE_I18N_NAMESPACE] },
      },
      {
        id: ROUTE_IDS.FORBIDDEN,
        path: ROUTE_PATHS.FORBIDDEN,
        loadPage: () =>
          import('@/pages/error/Forbidden/Forbidden').then(({ Forbidden }) => ({ default: Forbidden })),
        meta: { title: '无权限访问', hideInMenu: true, hideInTabs: true, noCache: true, breadcrumb: false },
      },
      {
        // 可直达的显式 404 路由；受保护根内 * 另有独立兜底节点渲染同一实现（规格 §4.2）
        id: ROUTE_IDS.NOT_FOUND,
        path: ROUTE_PATHS.NOT_FOUND,
        loadPage: () => import('@/pages/error/NotFound/NotFound').then(({ NotFound }) => ({ default: NotFound })),
        meta: { title: '页面不存在', hideInMenu: true, hideInTabs: true, noCache: true, breadcrumb: false },
      },
      {
        id: ROUTE_IDS.SERVER_ERROR,
        path: ROUTE_PATHS.SERVER_ERROR,
        loadPage: () =>
          import('@/pages/error/ServerError/ServerError').then(({ ServerError }) => ({ default: ServerError })),
        meta: { title: '服务器错误', hideInMenu: true, hideInTabs: true, noCache: true, breadcrumb: false },
      },
      {
        id: ROUTE_IDS.NOT_FOUND_SPLAT,
        path: '*',
        loadPage: () => import('@/pages/error/NotFound/NotFound').then(({ NotFound }) => ({ default: NotFound })),
        meta: { title: '页面不存在', hideInMenu: true, hideInTabs: true, noCache: true, breadcrumb: false },
      },
    ],
  },
]
