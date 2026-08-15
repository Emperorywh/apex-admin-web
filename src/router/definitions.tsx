/**
 * 路由定义唯一来源（规格 §4.1/§4.2）：
 * AppRouteDefinition[] 是 accessRoutes/renderRoutes/menuRoutes 三份投影的唯一输入，
 * 每个节点必须有稳定且全局唯一的 id；路由 ID、路径与回退地址一律引用 route.constants。
 *
 * loadPage 只允许 @/pages/... 具名实现路径懒加载（规格 §4.2），禁止从 features 加载页面
 * 或依赖 index 解析；结构门禁按 loadPage 内联动态导入的字面形态校验目标归属，
 * 因此保持内联动态导入，并用 .then 把页面具名导出映射为 React.lazy 需要的 default 形态。
 * 业务页面路由随各自任务增量扩展；受保护根外壳由 projections 的 ProtectedRoot
 * 容器挂载 BasicLayout 承担渲染。
 */
import { FlaskConical, LayoutDashboard, ListTree, Settings, ShieldCheck, UsersRound } from 'lucide-react'
import { DASHBOARD_I18N_NAMESPACE } from '@/constants/dashboard/dashboard.constants'
import { DEMO_NESTED_I18N_NAMESPACE } from '@/constants/demo/demo.constants'
import { PERMISSIONS } from '@/constants/permission.constants'
import { PROFILE_I18N_NAMESPACE } from '@/constants/profile/profile.constants'
import { ROUTE_IDS, ROUTE_PATHS } from '@/constants/route.constants'
import { MENU_I18N_NAMESPACE } from '@/constants/system/menu/menu.constants'
import { ROLE_I18N_NAMESPACE } from '@/constants/system/role/role.constants'
import { USER_I18N_NAMESPACE } from '@/constants/system/user/user.constants'
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
          icon: LayoutDashboard,
          permCode: PERMISSIONS.DASHBOARD_VIEW,
          affixTab: true,
          i18nNamespaces: [DASHBOARD_I18N_NAMESPACE],
        },
      },
      {
        // 系统管理目录节点（规格 §14.2）：无 permCode，仅承担菜单/面包屑分组；
        // 目录菜单只在自身权限满足且至少有一个可见子节点时保留（规格 §4.4）
        id: ROUTE_IDS.SYSTEM,
        path: ROUTE_PATHS.SYSTEM,
        meta: { title: '系统管理', icon: Settings },
        children: [
          {
            // 用户管理（规格 §14.2/§14.3）：查询/分页/Drawer CRUD/角色分配；
            // 页面权限 system:user:list，按钮级权限由页内 <Auth> 门控；
            // i18nNamespaces 声明 user 命名空间（规格 §12）
            id: ROUTE_IDS.SYSTEM_USER,
            path: ROUTE_PATHS.SYSTEM_USER,
            loadPage: () => import('@/pages/system/user/User/User').then(({ User }) => ({ default: User })),
            meta: {
              title: '用户管理',
              icon: UsersRound,
              permCode: PERMISSIONS.SYSTEM_USER_LIST,
              i18nNamespaces: [USER_I18N_NAMESPACE],
            },
          },
          {
            // 角色管理（规格 §14.2/§14.3）：CRUD/权限树分配；viewer 无 system:role:list，
            // 菜单隐藏且直达被守卫重定向 /403（规格 §5.3 矩阵）；
            // i18nNamespaces 声明 role 命名空间（规格 §12）
            id: ROUTE_IDS.SYSTEM_ROLE,
            path: ROUTE_PATHS.SYSTEM_ROLE,
            loadPage: () => import('@/pages/system/role/Role/Role').then(({ Role }) => ({ default: Role })),
            meta: {
              title: '角色管理',
              icon: ShieldCheck,
              permCode: PERMISSIONS.SYSTEM_ROLE_LIST,
              i18nNamespaces: [ROLE_I18N_NAMESPACE],
            },
          },
          {
            // 菜单管理（规格 §14.2/§14.3）：树表维护后端菜单数据，明确不动态改变前端
            // 静态路由；viewer 无 system:menu:list，菜单隐藏且直达被守卫重定向 /403
            // （规格 §5.3 矩阵）；i18nNamespaces 声明 systemMenu 命名空间（规格 §12）
            id: ROUTE_IDS.SYSTEM_MENU,
            path: ROUTE_PATHS.SYSTEM_MENU,
            loadPage: () => import('@/pages/system/menu/Menu/Menu').then(({ Menu }) => ({ default: Menu })),
            meta: {
              title: '菜单管理',
              icon: ListTree,
              permCode: PERMISSIONS.SYSTEM_MENU_LIST,
              i18nNamespaces: [MENU_I18N_NAMESPACE],
            },
          },
        ],
      },
      {
        // 多级菜单演示（规格 §14.2）：演示目录 > 多级菜单目录 > 三个层级叶子页面，
        // 构成三级菜单（演示/多级菜单/层级页面，§19.1 验收项）；同一 NestedDemo 实现
        // 注册于三个层级路由，由 pathname 识别层级，承担三级导航、面包屑链与页签缓存
        // 验证载体。子树权限 demo:nested:view 声明于多级菜单目录节点（规格 §4.4 权限继承：
        // 祖先与叶子 AND），admin/viewer 均持有（规格 §5.3 矩阵）。
        id: ROUTE_IDS.DEMO,
        path: ROUTE_PATHS.DEMO,
        meta: { title: '演示', icon: FlaskConical },
        children: [
          {
            id: ROUTE_IDS.DEMO_NESTED,
            path: ROUTE_PATHS.DEMO_NESTED,
            meta: { title: '多级菜单', permCode: PERMISSIONS.DEMO_NESTED_VIEW },
            children: [
              {
                id: ROUTE_IDS.DEMO_NESTED_LEVEL1,
                path: ROUTE_PATHS.DEMO_NESTED_LEVEL1,
                loadPage: () => import('@/pages/demo/NestedDemo/NestedDemo').then(({ NestedDemo }) => ({ default: NestedDemo })),
                meta: { title: '一级页面', i18nNamespaces: [DEMO_NESTED_I18N_NAMESPACE] },
              },
              {
                id: ROUTE_IDS.DEMO_NESTED_LEVEL2,
                path: ROUTE_PATHS.DEMO_NESTED_LEVEL2,
                loadPage: () => import('@/pages/demo/NestedDemo/NestedDemo').then(({ NestedDemo }) => ({ default: NestedDemo })),
                meta: { title: '二级页面', i18nNamespaces: [DEMO_NESTED_I18N_NAMESPACE] },
              },
              {
                id: ROUTE_IDS.DEMO_NESTED_LEVEL3,
                path: ROUTE_PATHS.DEMO_NESTED_LEVEL3,
                loadPage: () => import('@/pages/demo/NestedDemo/NestedDemo').then(({ NestedDemo }) => ({ default: NestedDemo })),
                meta: { title: '三级页面', i18nNamespaces: [DEMO_NESTED_I18N_NAMESPACE] },
              },
            ],
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
