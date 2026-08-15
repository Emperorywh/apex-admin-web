/**
 * 路由定义唯一来源（规格 §4.1/§4.2）：
 * AppRouteDefinition[] 是 accessRoutes/renderRoutes/menuRoutes 三份投影的唯一输入，
 * 每个节点必须有稳定且全局唯一的 id；路由 ID、路径与回退地址一律引用 route.constants。
 *
 * loadPage 只允许 @/pages/... 具名实现路径懒加载（规格 §4.2），禁止从 features 加载页面
 * 或依赖 index 解析；结构门禁按 loadPage 内联动态导入的字面形态校验目标归属，
 * 因此保持内联动态导入，并用 .then 把页面具名导出映射为 React.lazy 需要的 default 形态。
 * 当前只注册已实现的页面（登录、错误页），业务页面路由随各自任务增量扩展；
 * 受保护根外壳由 projections 的 ProtectedRoot 容器挂载 BasicLayout 承担渲染。
 */
import { LayoutDashboard } from 'lucide-react'
import { DASHBOARD_I18N_NAMESPACE } from '@/constants/dashboard/dashboard.constants'
import { PERMISSIONS } from '@/constants/permission.constants'
import { ROUTE_IDS, ROUTE_PATHS } from '@/constants/route.constants'
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
