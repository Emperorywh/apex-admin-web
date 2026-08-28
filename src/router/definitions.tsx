/**
 * 路由定义唯一来源（AppRouteDefinition[]）：id 与 path 只在此声明。
 * 顶层节点用绝对路径（以 / 开头），子节点用相对段；完整路径由树推导进
 * ROUTE_PATHS（按 id 索引），业务代码不拼接、不复制路径。
 * 新增页面只需在树中加一个节点（id、path、loadPage、meta），访问路由、
 * 纯渲染路由、菜单与 ROUTE_IDS/ROUTE_PATHS/RouteId 自动生效。
 * 业务页面只能通过 loadPage 延迟加载，且必须指向具名实现路径。
 *
 * 菜单结构复刻自源系统路由配置：
 * - 布局外页面（源配置 layout: false）对应顶层公开路由：不包 BasicLayout、
 *   无守卫、无页签，固定 hideInMenu/hideInTabs/noCache；
 * - 目录节点的默认子页用 index + redirect 表达；「服务器资源」菜单别名
 *   redirect 到布局外的全屏监控页。
 */

import {
  Box,
  Cable,
  Car,
  ChartColumn,
  CircleMinus,
  CirclePlay,
  Cpu,
  Gauge,
  Image,
  LayoutGrid,
  List,
  ListTodo,
  Server,
  Settings,
  ShieldCheck,
  Signal,
  SquareFunction,
  TriangleAlert,
  UserRoundCog,
  Workflow,
} from 'lucide-react'
import type { AppRouteDefinition } from '@/router/router.types'

/** 以 const 泛型收集字面量 id，供 RouteId 联合类型推导 */
function defineAppRoutes<const T extends readonly AppRouteDefinition[]>(routes: T): T {
  return routes
}

/** 登录、错误页共用的辅助路由 meta */
function auxiliaryMeta(title: string): AppRouteDefinition['meta'] {
  return {
    title,
    hideInMenu: true,
    hideInTabs: true,
    noCache: true,
    i18nNamespaces: ['error'],
  }
}

/** 布局外公开页（源配置 layout: false）的辅助路由 meta */
function standaloneMeta(title: string): AppRouteDefinition['meta'] {
  return {
    title,
    hideInMenu: true,
    hideInTabs: true,
    noCache: true,
  }
}

/** 目录默认子页（index 重定向节点）的辅助路由 meta */
function indexRedirectMeta(title: string): AppRouteDefinition['meta'] {
  return {
    title,
    hideInMenu: true,
    hideInTabs: true,
    noCache: true,
  }
}

export const appRouteDefinitions = defineAppRoutes([
  {
    id: 'auth-login',
    path: '/login',
    loadPage: () => import('@/pages/auth/Login/Login'),
    meta: {
      title: '登录',
      hideInMenu: true,
      hideInTabs: true,
      noCache: true,
      i18nNamespaces: ['auth'],
    },
  },
  {
    id: 'authorize-ingress',
    path: '/authorize-ingress',
    loadPage: () => import('@/pages/authorize-ingress/AuthorizeIngress/AuthorizeIngress'),
    meta: standaloneMeta('软件授权'),
  },
  {
    id: 'root',
    path: '/',
    meta: { title: '企业运营中心' },
    children: [
      {
        id: 'root-index',
        index: true,
        meta: { title: '工作台', hideInMenu: true, hideInTabs: true, noCache: true },
      },
      {
        id: 'profile',
        path: 'profile',
        loadPage: () => import('@/pages/profile/Profile/Profile'),
        meta: {
          title: '个人中心',
          icon: UserRoundCog,
          hideInMenu: true,
          i18nNamespaces: ['profile'],
        },
      },
      {
        id: 'over-look',
        path: 'over-look',
        loadPage: () => import('@/pages/overlook/Overlook/Overlook'),
        meta: { title: '调度监控', icon: LayoutGrid, affixTab: true },
      },
      {
        id: 'order-record',
        path: 'order-record',
        loadPage: () => import('@/pages/order-record/OrderRecord/OrderRecord'),
        meta: { title: '任务管理', icon: List, i18nNamespaces: ['orderRecord'] },
      },
      {
        id: 'vehicle-deploy',
        path: 'vehicle-deploy',
        meta: { title: '车辆管理', icon: Car },
        children: [
          {
            id: 'vehicle-deploy-index',
            index: true,
            redirect: '/vehicle-deploy/vehicle-group',
            meta: indexRedirectMeta('车辆管理'),
          },
          {
            id: 'vehicle-deploy-vehicle-group',
            path: 'vehicle-group',
            loadPage: () => import('@/pages/vehicle-deploy/VehicleGroup/VehicleGroup'),
            meta: { title: '车辆分组' },
          },
          {
            // path 保持源配置原样拼写（vehicle-diplay）
            id: 'vehicle-deploy-vehicle-display',
            path: 'vehicle-diplay',
            loadPage: () => import('@/pages/vehicle-deploy/VehicleDisplay/VehicleDisplay'),
            meta: { title: '车辆列表' },
          },
          {
            id: 'vehicle-deploy-vehicle-type',
            path: 'vehicle-type',
            loadPage: () => import('@/pages/vehicle-deploy/VehicleType/VehicleType'),
            meta: { title: '载具类型' },
          },
          {
            id: 'vehicle-deploy-node-mapping',
            path: 'node-mapping',
            loadPage: () => import('@/pages/vehicle-deploy/NodeMapping/NodeMapping'),
            meta: { title: '节点映射' },
          },
          {
            id: 'vehicle-deploy-alarm-code',
            path: 'alarm-code-management',
            loadPage: () =>
              import('@/pages/system-involve/AlarmCodeManagement/AlarmCodeManagement'),
            meta: { title: '告警码管理' },
          },
        ],
      },
      {
        id: 'map-through',
        path: 'map-through',
        meta: { title: '地图管理', icon: Image },
        children: [
          {
            id: 'map-through-index',
            index: true,
            redirect: '/map-through/map-list',
            meta: indexRedirectMeta('地图管理'),
          },
          {
            id: 'map-through-map-list',
            path: 'map-list',
            loadPage: () => import('@/pages/map-through/MapList/MapList'),
            meta: { title: '地图列表' },
          },
          {
            id: 'map-through-map-nest-modify',
            path: 'map-nest-modify',
            loadPage: () => import('@/pages/map-through/MapNestModify/MapNestModify'),
            meta: { title: '地图编辑' },
          },
          {
            id: 'map-through-cross-maps',
            path: 'cross-maps',
            loadPage: () => import('@/pages/map-through/CrossMaps/CrossMaps'),
            meta: { title: '地图关联' },
          },
          {
            id: 'map-through-point-edge-combination',
            path: 'point-edge-combination',
            loadPage: () =>
              import('@/pages/map-through/PointEdgeCombination/PointEdgeCombination'),
            meta: { title: '多地图点边组合' },
          },
          {
            id: 'map-through-map-push-records',
            path: 'map-push-records',
            loadPage: () =>
              import('@/pages/map-through/MapPushNotificationRecords/MapPushNotificationRecords'),
            meta: { title: '地图推送记录' },
          },
        ],
      },
      {
        id: 'dispatch-hub',
        path: 'dispatch-hub',
        loadPage: () => import('@/pages/dispatch-hub/DispatchHub/DispatchHub'),
        meta: { title: '调度中心', icon: Box },
      },
      {
        id: 'tri-resource',
        path: 'tri-resource',
        meta: { title: '三方资源', icon: Cable },
        children: [
          {
            id: 'tri-resource-index',
            index: true,
            redirect: '/tri-resource/tri-device',
            meta: indexRedirectMeta('三方资源'),
          },
          {
            id: 'tri-resource-tri-device',
            path: 'tri-device',
            meta: { title: '三方设备', icon: Cpu },
            children: [
              {
                id: 'tri-resource-tri-device-index',
                index: true,
                redirect: '/tri-resource/tri-device/elevator',
                meta: indexRedirectMeta('三方设备'),
              },
              {
                id: 'tri-resource-tri-device-elevator',
                path: 'elevator',
                loadPage: () => import('@/pages/tri-device/Elevator/Elevator'),
                meta: { title: '电梯' },
              },
              {
                id: 'tri-resource-tri-device-auto-door',
                path: 'auto-door',
                loadPage: () => import('@/pages/tri-device/AutoDoor/AutoDoor'),
                meta: { title: '自动门' },
              },
              {
                // path 保持源配置原样拼写（charge-pie）
                id: 'tri-resource-tri-device-charge-pile',
                path: 'charge-pie',
                loadPage: () => import('@/pages/tri-device/ModbusChargePile/ModbusChargePile'),
                meta: { title: '充电桩' },
              },
              {
                id: 'tri-resource-tri-device-traffic-lights',
                path: 'traffic-lights',
                loadPage: () => import('@/pages/tri-device/TrafficLights/TrafficLights'),
                meta: { title: '交通灯' },
              },
              {
                id: 'tri-resource-tri-device-air-shower-door',
                path: 'air-shower-door',
                loadPage: () => import('@/pages/tri-device/AirShowerDoor/AirShowerDoor'),
                meta: { title: '风淋门' },
              },
            ],
          },
          {
            id: 'tri-resource-tri-traffic',
            path: 'tri-traffic',
            loadPage: () => import('@/pages/tri-traffic/TriTraffic/TriTraffic'),
            meta: { title: '三方交管', icon: CircleMinus },
          },
        ],
      },
      {
        id: 'mission-cluster',
        path: 'mission-cluster',
        meta: { title: '工艺配置', icon: Workflow },
        children: [
          {
            id: 'mission-cluster-index',
            index: true,
            redirect: '/mission-cluster/mission-create',
            meta: indexRedirectMeta('工艺配置'),
          },
          {
            id: 'mission-cluster-mission-create',
            path: 'mission-create',
            loadPage: () => import('@/pages/mission-cluster/MissionCreate/MissionCreate'),
            meta: { title: '任务工艺' },
          },
          {
            id: 'mission-cluster-mission-flow',
            path: 'mission-flow',
            loadPage: () => import('@/pages/mission-cluster/MissionFlow/MissionFlow'),
            meta: { title: '工艺管理' },
          },
          {
            id: 'mission-cluster-obstacle-avoidance',
            path: 'obstacle-avoidance',
            loadPage: () =>
              import('@/pages/obstacle-avoidance/ObstacleAvoidance/ObstacleAvoidance'),
            meta: { title: '避障模板', icon: CircleMinus },
          },
          {
            id: 'mission-cluster-action-control',
            path: 'action-control',
            meta: { title: '动作管理', icon: SquareFunction },
            children: [
              {
                id: 'mission-cluster-action-control-index',
                index: true,
                redirect: '/mission-cluster/action-control/agv-action',
                meta: indexRedirectMeta('动作管理'),
              },
              {
                id: 'mission-cluster-action-control-agv-action',
                path: 'agv-action',
                loadPage: () => import('@/pages/action-control/AGVAction/AGVAction'),
                meta: { title: '车辆动作' },
              },
              {
                id: 'mission-cluster-action-control-agv-action-group',
                path: 'agv-action-group',
                loadPage: () =>
                  import('@/pages/action-control/AGVActionGroup/AGVActionGroup'),
                meta: { title: '动作分组' },
              },
            ],
          },
        ],
      },
      {
        id: 'system-involve',
        path: 'system-involve',
        meta: { title: '系统管理', icon: Settings },
        children: [
          {
            id: 'system-involve-index',
            index: true,
            redirect: '/system-involve/version-control',
            meta: indexRedirectMeta('系统管理'),
          },
          {
            id: 'system-involve-version-control',
            path: 'version-control',
            loadPage: () => import('@/pages/system-involve/VersionControl/VersionControl'),
            meta: { title: '版本管理' },
          },
          {
            id: 'system-involve-system-log',
            path: 'system-log',
            loadPage: () => import('@/pages/system-involve/SystemLog/SystemLog'),
            meta: { title: '系统日志' },
          },
          {
            id: 'system-involve-system-setting',
            path: 'system-setting',
            loadPage: () => import('@/pages/system-involve/SystemSetting/SystemSetting'),
            meta: { title: '系统设置' },
          },
          {
            id: 'system-involve-operation-log',
            path: 'operation-log',
            loadPage: () => import('@/pages/system-involve/OperationLog/OperationLog'),
            meta: { title: '操作日志' },
          },
          {
            id: 'system-involve-software-information',
            path: 'software-information',
            loadPage: () =>
              import('@/pages/system-involve/SoftwareInformation/SoftwareInformation'),
            meta: { title: '软件信息' },
          },
          {
            id: 'system-involve-database-backup',
            path: 'database-backup',
            loadPage: () =>
              import('@/pages/system-involve/DatabaseBackupManagement/DatabaseBackupManagement'),
            meta: { title: '数据库备份管理' },
          },
        ],
      },
      {
        id: 'access-management',
        path: 'access-management',
        meta: { title: '权限管理', icon: ShieldCheck },
        children: [
          {
            id: 'access-management-index',
            index: true,
            redirect: '/access-management/user-management',
            meta: indexRedirectMeta('权限管理'),
          },
          {
            id: 'access-management-user-management',
            path: 'user-management',
            loadPage: () =>
              import('@/pages/access-management/UserManagement/UserManagement'),
            meta: { title: '用户管理' },
          },
          {
            id: 'access-management-role-management',
            path: 'role-management',
            loadPage: () =>
              import('@/pages/access-management/RoleManagement/RoleManagement'),
            meta: { title: '角色管理' },
          },
        ],
      },
      {
        id: 'analyze-visual',
        path: 'analyze-visual',
        meta: { title: '数据统计', icon: Signal },
        children: [
          {
            id: 'analyze-visual-index',
            index: true,
            redirect: '/analyze-visual/order-statistics',
            meta: indexRedirectMeta('数据统计'),
          },
          {
            id: 'analyze-visual-order-statistics',
            path: 'order-statistics',
            loadPage: () =>
              import('@/pages/analyze-visual/OrderStatistics/OrderStatistics'),
            meta: { title: '任务统计' },
          },
          {
            id: 'analyze-visual-record-playback',
            path: 'record-playback',
            loadPage: () => import('@/pages/record-playback/RecordPlayback/RecordPlayback'),
            meta: { title: '录制回放', icon: CirclePlay },
          },
          {
            id: 'analyze-visual-dashboard-realtime',
            path: 'dashboard-realtime',
            loadPage: () =>
              import('@/pages/analyze-visual/RealtimeDashboard/RealtimeDashboard'),
            meta: { title: '实时看板', icon: Gauge },
          },
          {
            id: 'analyze-visual-dashboard-task',
            path: 'dashboard-task',
            loadPage: () =>
              import('@/pages/analyze-visual/TaskStatisticsReport/TaskStatisticsReport'),
            meta: { title: '任务统计报表', icon: ListTodo },
          },
          {
            id: 'analyze-visual-dashboard-fault',
            path: 'dashboard-fault',
            loadPage: () => import('@/pages/analyze-visual/FaultAlert/FaultAlert'),
            meta: { title: '故障告警', icon: TriangleAlert },
          },
          {
            id: 'analyze-visual-vehicle-status',
            path: 'vehicle-status',
            loadPage: () => import('@/pages/analyze-visual/VehicleStatus/VehicleStatus'),
            meta: { title: '车辆状态统计', icon: ChartColumn },
          },
          {
            // 菜单别名：点击后 replace 到布局外的全屏监控页
            id: 'analyze-visual-server-resource',
            path: 'server-resource',
            redirect: '/analyze-visual/server-resource-monitor',
            meta: { title: '服务器资源', icon: Server },
          },
        ],
      },
      {
        id: 'error-500',
        path: '500',
        loadPage: () => import('@/pages/error/ServerError/ServerError'),
        meta: auxiliaryMeta('服务错误'),
      },
      {
        id: 'root-not-found',
        path: '*',
        loadPage: () => import('@/pages/error/NotFound/NotFound'),
        meta: auxiliaryMeta('页面不存在'),
      },
    ],
  },
  {
    id: 'order-info',
    path: '/order-info',
    loadPage: () => import('@/pages/order-info/OrderInfo/OrderInfo'),
    meta: standaloneMeta('任务详情'),
  },
  {
    id: 'vehicle-info',
    path: '/vehicle-info',
    loadPage: () => import('@/pages/vehicle-info/VehicleInfo/VehicleInfo'),
    meta: standaloneMeta('车辆详情'),
  },
  {
    // 服务器资源监控全屏页：「服务器资源」菜单别名 redirect 的实际目标
    id: 'server-resource-monitor',
    path: '/analyze-visual/server-resource-monitor',
    loadPage: () =>
      import('@/pages/analyze-visual/ServerRealtimeResources/ServerRealtimeResources'),
    meta: standaloneMeta('服务器资源监控'),
  },
  {
    id: 'no-permission',
    path: '/no-permission',
    loadPage: () => import('@/pages/un-access/UnAccess/UnAccess'),
    meta: standaloneMeta('无权限'),
  },
  {
    id: 'error-404',
    path: '/404',
    loadPage: () => import('@/pages/error/NotFound/NotFound'),
    meta: auxiliaryMeta('页面不存在'),
  },
])

/* -------------------------------------------------------------------------- */
/* id / 完整路径推导（模块初始化时执行一次）                                       */
/* -------------------------------------------------------------------------- */

/** 拼接父子路径；以 / 开头的段视为绝对路径直接采用 */
export function joinPath(base: string, segment: string | undefined): string {
  if (!segment) return base || '/'
  if (segment.startsWith('/')) return segment
  return `${base === '/' ? '' : base}/${segment}`
}

/** 从定义树递归提取全部 id 字面量 */
type RouteIdOf<T> = T extends readonly (infer U)[]
  ? U extends { id: infer I; children?: infer C }
    ? C extends readonly unknown[]
      ? I | RouteIdOf<C>
      : I
    : never
  : never

/** 全局唯一路由 id 联合；新增树节点后自动扩充 */
export type RouteId = RouteIdOf<typeof appRouteDefinitions>

const ids: Record<string, string> = {}
const paths: Record<string, string> = {}

function collectRoutes(definitions: readonly AppRouteDefinition[], basePath: string): void {
  for (const definition of definitions) {
    if (definition.id in ids) throw new Error(`路由 id 重复：${definition.id}`)
    ids[definition.id] = definition.id
    // index 与 * 节点没有可导航地址，归到父路径
    const navigable = definition.path !== undefined && !definition.path.includes('*')
    paths[definition.id] = navigable ? joinPath(basePath, definition.path) : basePath
    if (definition.children?.length) {
      collectRoutes(definition.children, navigable ? paths[definition.id] : basePath)
    }
  }
}

collectRoutes(appRouteDefinitions, '/')

/** 全量路由 id（按 id 索引）；业务代码引用 id 时用它而非散落字面量 */
export const ROUTE_IDS = ids as Readonly<Record<RouteId, RouteId>>

/** id → 完整访问路径；由树推导，禁止手写副本 */
export const ROUTE_PATHS = paths as Readonly<Record<RouteId, string>>
