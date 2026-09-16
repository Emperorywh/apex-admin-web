/**
 * 路由定义唯一来源（AppRouteDefinition[]）：id 与 path 只在此声明。
 * 顶层节点用绝对路径（以 / 开头），子节点用相对段；完整路径由树推导进
 * ROUTE_PATHS（按 id 索引），业务代码不拼接、不复制路径。
 * 新增页面只需在树中加一个节点（id、path、loadPage、meta），访问路由、
 * 纯渲染路由、菜单与 ROUTE_IDS/ROUTE_PATHS/RouteId 自动生效。
 * 业务页面只能通过 loadPage 延迟加载，且必须指向具名实现路径。
 *
 * 菜单结构复刻自源系统路由配置（旧 .umirc.ts @ e570b8df）：
 * - 登录页为唯一公开路由（meta.public）：不进稳定会话宿主、无守卫；
 * - 其余全部路由处于登录会话内：守卫做认证 + menuCode/rootOnly 鉴权；
 *   全屏、暂缓提示、404、无权限等视图只是同一会话内的切换（SPEC §8.1），
 *   不销毁稳定会话层中的页签缓存宿主；
 * - 目录节点的默认子页用 index + redirect 表达；「服务器资源」菜单别名
 *   redirect 到布局外的全屏监控页；
 * - meta.menuCode 镜像旧 .umirc.ts 的 access 映射（值见 permission.constants），
 *   两处源遗漏按 SPEC §8.2 修正：载具类型=carrier:view、数据库备份=system:database-backup:view；
 * - 三个本轮暂缓模块（meta.deferred）保留原菜单位置与权限码，直访显示统一暂缓提示，
 *   不加载业务模块（loadPage 指向 DeferredPage，原实现文件留待下一轮）；
 * - 用户/角色管理为特权专属（meta.rootOnly，源 isRootUser 判定）。
 */

import {
  /* 设备入口使用与实体对应的图标。
     菜单和页签通过路由元数据共用，保持视觉识别一致。 */
  ArrowDownUp,
  DoorOpen,
  PlugZap,
  TrafficCone,
  Wind,
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
import { MENU_PERM } from '@/constants/permission.constants'

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

/** 会话内视图切换页（全屏/暂缓提示/404/无权限）：隐藏外壳但不生成页签、不留缓存 */
function sessionOverlayMeta(title: string): AppRouteDefinition['meta'] {
  return {
    title,
    hideInMenu: true,
    hideInTabs: true,
    noCache: true,
  }
}

/**
 * 本轮暂缓模块（SPEC §1.2）：保留菜单位置与权限码，直访/菜单命中显示统一
 * 暂缓提示；按 §9.1 属会话内视图切换（hideInTabs + noCache），不生成页签。
 */
function deferredMeta(
  title: string,
  menuCode: string,
  extra?: Partial<AppRouteDefinition['meta']>,
): AppRouteDefinition['meta'] {
  return {
    title,
    menuCode,
    deferred: true,
    hideInTabs: true,
    noCache: true,
    i18nNamespaces: ['menu', 'common'],
    ...extra,
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
      // 唯一公开路由：无认证要求，也不进入稳定会话宿主
      public: true,
    },
  },
  {
    id: 'authorize-ingress',
    path: '/authorize-ingress',
    loadPage: () => import('@/pages/authorize-ingress/AuthorizeIngress/AuthorizeIngress'),
    // 软件授权页属于登录会话内的视图切换（1001000 时身份保留），
    // 隐藏外壳但不销毁会话层的页签缓存宿主
    meta: { ...sessionOverlayMeta('软件授权'), i18nNamespaces: ['auth'] },
  },
  {
    id: 'root',
    path: '/',
    meta: { title: '调度系统' },
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
        // 本轮暂缓：直访/菜单命中统一暂缓提示，不加载监控模块（原实现文件留待下一轮）
        loadPage: () => import('@/pages/deferred/DeferredPage/DeferredPage'),
        meta: deferredMeta('调度监控', MENU_PERM.OVERVIEW_VIEW, { icon: LayoutGrid }),
      },
      {
        id: 'order-record',
        path: 'order-record',
        loadPage: () => import('@/pages/order-record/OrderRecord/OrderRecord'),
        meta: {
          title: '任务管理',
          icon: List,
          menuCode: MENU_PERM.ORDER_RECORD_VIEW,
          i18nNamespaces: ['orderRecord'],
        },
      },
      {
        id: 'dev-apex-table-probe',
        path: 'dev/apex-table-probe',
        // T021 临时探针：ApexTable 能力演示与取证，验证完成后随收尾移除
        loadPage: () => import('@/pages/dev/ApexTableProbe/ApexTableProbe'),
        meta: {
          title: '表格能力探针',
          hideInMenu: true,
          i18nNamespaces: ['common'],
        },
      },
      {
        id: 'vehicle-deploy',
        path: 'vehicle-deploy',
        meta: { title: '车辆管理', icon: Car, menuCode: MENU_PERM.VEHICLE_MANAGE },
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
            meta: { title: '车辆分组', menuCode: MENU_PERM.VEHICLE_GROUP_VIEW },
          },
          {
            // path 保持源配置原样拼写（vehicle-diplay）
            id: 'vehicle-deploy-vehicle-display',
            path: 'vehicle-diplay',
            loadPage: () => import('@/pages/vehicle-deploy/VehicleDisplay/VehicleDisplay'),
            meta: { title: '车辆列表', menuCode: MENU_PERM.VEHICLE_LIST_VIEW },
          },
          {
            // SPEC §8.2 修正：源 .umirc.ts 遗漏 access，菜单与直访统一要求 carrier:view
            id: 'vehicle-deploy-vehicle-type',
            path: 'vehicle-type',
            loadPage: () => import('@/pages/vehicle-deploy/VehicleType/VehicleType'),
            meta: { title: '载具类型', menuCode: MENU_PERM.CARRIER_VIEW },
          },
          {
            id: 'vehicle-deploy-node-mapping',
            path: 'node-mapping',
            loadPage: () => import('@/pages/vehicle-deploy/NodeMapping/NodeMapping'),
            meta: { title: '节点映射', menuCode: MENU_PERM.NODE_MAPPING_VIEW },
          },
          {
            id: 'vehicle-deploy-alarm-code',
            path: 'alarm-code-management',
            loadPage: () =>
              import('@/pages/system-involve/AlarmCodeManagement/AlarmCodeManagement'),
            meta: { title: '告警码管理', menuCode: MENU_PERM.VEHICLE_ALARM_CODE_VIEW },
          },
        ],
      },
      {
        id: 'map-through',
        path: 'map-through',
        meta: { title: '地图管理', icon: Image, menuCode: MENU_PERM.MAP_MANAGE },
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
            meta: { title: '地图列表', menuCode: MENU_PERM.MAP_LIST_VIEW },
          },
          {
            // 本轮暂缓：地图编辑器留待下一轮；P09 版本查看/编辑入口的禁用状态由 T037/T039 接入
            id: 'map-through-map-nest-modify',
            path: 'map-nest-modify',
            loadPage: () => import('@/pages/deferred/DeferredPage/DeferredPage'),
            meta: deferredMeta('地图编辑', MENU_PERM.MAP_EDIT_VIEW),
          },
          {
            id: 'map-through-cross-maps',
            path: 'cross-maps',
            loadPage: () => import('@/pages/map-through/CrossMaps/CrossMaps'),
            meta: { title: '地图关联', menuCode: MENU_PERM.CROSS_MAP_VIEW },
          },
          {
            id: 'map-through-point-edge-combination',
            path: 'point-edge-combination',
            loadPage: () =>
              import('@/pages/map-through/PointEdgeCombination/PointEdgeCombination'),
            meta: { title: '多地图点边组合', menuCode: MENU_PERM.POINT_EDGE_COMBINATION_VIEW },
          },
          {
            id: 'map-through-map-push-records',
            path: 'map-push-records',
            loadPage: () =>
              import('@/pages/map-through/MapPushNotificationRecords/MapPushNotificationRecords'),
            meta: { title: '地图推送记录', menuCode: MENU_PERM.MAP_PUSH_RECORD_VIEW },
          },
        ],
      },
      {
        id: 'dispatch-hub',
        path: 'dispatch-hub',
        loadPage: () => import('@/pages/dispatch-hub/DispatchHub/DispatchHub'),
        meta: { title: '调度中心', icon: Box, menuCode: MENU_PERM.DISPATCH_HUB_VIEW },
      },
      {
        id: 'tri-resource',
        path: 'tri-resource',
        meta: { title: '三方资源', icon: Cable, menuCode: MENU_PERM.THIRD_PARTY_MANAGE },
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
            meta: {
              title: '三方设备',
              icon: Cpu,
              menuCode: MENU_PERM.THIRD_PARTY_DEVICE_MANAGE,
            },
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
                meta: {
                  title: '电梯',
                  icon: ArrowDownUp,
                  menuCode: MENU_PERM.DEVICE_ELEVATOR_VIEW,
                },
              },
              {
                id: 'tri-resource-tri-device-auto-door',
                path: 'auto-door',
                loadPage: () => import('@/pages/tri-device/AutoDoor/AutoDoor'),
                meta: {
                  title: '自动门',
                  icon: DoorOpen,
                  menuCode: MENU_PERM.DEVICE_AUTO_DOOR_VIEW,
                },
              },
              {
                // path 保持源配置原样拼写（charge-pie）
                id: 'tri-resource-tri-device-charge-pile',
                path: 'charge-pie',
                loadPage: () => import('@/pages/tri-device/ModbusChargePile/ModbusChargePile'),
                meta: {
                  title: '充电桩',
                  icon: PlugZap,
                  menuCode: MENU_PERM.DEVICE_CHARGE_PILE_VIEW,
                },
              },
              {
                id: 'tri-resource-tri-device-traffic-lights',
                path: 'traffic-lights',
                loadPage: () => import('@/pages/tri-device/TrafficLights/TrafficLights'),
                meta: {
                  title: '交通灯',
                  icon: TrafficCone,
                  menuCode: MENU_PERM.DEVICE_TRAFFIC_LIGHT_VIEW,
                },
              },
              {
                id: 'tri-resource-tri-device-air-shower-door',
                path: 'air-shower-door',
                loadPage: () => import('@/pages/tri-device/AirShowerDoor/AirShowerDoor'),
                meta: {
                  title: '风淋门',
                  icon: Wind,
                  menuCode: MENU_PERM.DEVICE_AIR_SHOWER_DOOR_VIEW,
                },
              },
            ],
          },
          {
            id: 'tri-resource-tri-traffic',
            path: 'tri-traffic',
            loadPage: () => import('@/pages/tri-traffic/TriTraffic/TriTraffic'),
            meta: {
              title: '三方交管',
              icon: CircleMinus,
              menuCode: MENU_PERM.TRAFFIC_TRIPARTITE_VIEW,
            },
          },
        ],
      },
      {
        id: 'mission-cluster',
        path: 'mission-cluster',
        meta: { title: '工艺配置', icon: Workflow, menuCode: MENU_PERM.PROCESS_MANAGE },
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
            meta: { title: '任务工艺', menuCode: MENU_PERM.MISSION_FLOW_VIEW },
          },
          {
            id: 'mission-cluster-mission-flow',
            path: 'mission-flow',
            loadPage: () => import('@/pages/mission-cluster/MissionFlow/MissionFlow'),
            meta: { title: '工艺管理', menuCode: MENU_PERM.MISSION_TEMPLATE_VIEW },
          },
          {
            id: 'mission-cluster-obstacle-avoidance',
            path: 'obstacle-avoidance',
            loadPage: () =>
              import('@/pages/obstacle-avoidance/ObstacleAvoidance/ObstacleAvoidance'),
            meta: {
              title: '避障模板',
              icon: CircleMinus,
              menuCode: MENU_PERM.OBSTACLE_AVOIDANCE_VIEW,
            },
          },
          {
            id: 'mission-cluster-action-control',
            path: 'action-control',
            meta: { title: '动作管理', icon: SquareFunction, menuCode: MENU_PERM.ACTION_MANAGE },
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
                meta: { title: '车辆动作', menuCode: MENU_PERM.ACTION_VEHICLE_VIEW },
              },
              {
                id: 'mission-cluster-action-control-agv-action-group',
                path: 'agv-action-group',
                loadPage: () =>
                  import('@/pages/action-control/AGVActionGroup/AGVActionGroup'),
                meta: { title: '动作分组', menuCode: MENU_PERM.ACTION_GROUP_VIEW },
              },
            ],
          },
        ],
      },
      {
        id: 'system-involve',
        path: 'system-involve',
        meta: { title: '系统管理', icon: Settings, menuCode: MENU_PERM.SYSTEM_MANAGE },
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
            meta: { title: '版本管理', menuCode: MENU_PERM.SYSTEM_VERSION_VIEW },
          },
          {
            id: 'system-involve-system-log',
            path: 'system-log',
            loadPage: () => import('@/pages/system-involve/SystemLog/SystemLog'),
            meta: { title: '系统日志', menuCode: MENU_PERM.SYSTEM_LOG_VIEW },
          },
          {
            id: 'system-involve-system-setting',
            path: 'system-setting',
            loadPage: () => import('@/pages/system-involve/SystemSetting/SystemSetting'),
            meta: { title: '系统设置', menuCode: MENU_PERM.SYSTEM_SETTING_VIEW },
          },
          {
            id: 'system-involve-operation-log',
            path: 'operation-log',
            loadPage: () => import('@/pages/system-involve/OperationLog/OperationLog'),
            meta: { title: '操作日志', menuCode: MENU_PERM.SYSTEM_OPERATION_LOG_VIEW },
          },
          {
            id: 'system-involve-software-information',
            path: 'software-information',
            loadPage: () =>
              import('@/pages/system-involve/SoftwareInformation/SoftwareInformation'),
            meta: {
              title: '软件信息',
              menuCode: MENU_PERM.SYSTEM_SOFTWARE_VIEW,
              i18nNamespaces: ['system'],
            },
          },
          {
            // SPEC §8.2 修正：源 .umirc.ts 遗漏 access，菜单与直访统一要求
            // system:database-backup:view（下载按钮码 system:database-backup:download 由 T077 接入）
            id: 'system-involve-database-backup',
            path: 'database-backup',
            loadPage: () =>
              import('@/pages/system-involve/DatabaseBackupManagement/DatabaseBackupManagement'),
            meta: { title: '数据库备份管理', menuCode: MENU_PERM.SYSTEM_DATABASE_BACKUP_VIEW },
          },
        ],
      },
      {
        id: 'access-management',
        path: 'access-management',
        meta: { title: '权限管理', icon: ShieldCheck, menuCode: MENU_PERM.AUTH_MANAGE },
        children: [
          {
            id: 'access-management-index',
            index: true,
            redirect: '/access-management/user-management',
            meta: indexRedirectMeta('权限管理'),
          },
          {
            // 特权专属（源 isRootUser）：root/administrator 之外即使持有 auth:user:view 也不可进入
            id: 'access-management-user-management',
            path: 'user-management',
            loadPage: () =>
              import('@/pages/access-management/UserManagement/UserManagement'),
            meta: {
              title: '用户管理',
              menuCode: MENU_PERM.AUTH_USER_VIEW,
              rootOnly: true,
            },
          },
          {
            id: 'access-management-role-management',
            path: 'role-management',
            loadPage: () =>
              import('@/pages/access-management/RoleManagement/RoleManagement'),
            meta: {
              title: '角色管理',
              menuCode: MENU_PERM.AUTH_ROLE_VIEW,
              rootOnly: true,
            },
          },
        ],
      },
      {
        id: 'analyze-visual',
        path: 'analyze-visual',
        meta: { title: '数据统计', icon: Signal, menuCode: MENU_PERM.STATISTICS_MANAGE },
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
            meta: { title: '任务统计', menuCode: MENU_PERM.STATISTICS_ORDER_VIEW },
          },
          {
            // 本轮暂缓：录制回放留待下一轮
            id: 'analyze-visual-record-playback',
            path: 'record-playback',
            loadPage: () => import('@/pages/deferred/DeferredPage/DeferredPage'),
            meta: deferredMeta('录制回放', MENU_PERM.RECORD_PLAYBACK_VIEW, { icon: CirclePlay }),
          },
          {
            id: 'analyze-visual-dashboard-realtime',
            path: 'dashboard-realtime',
            loadPage: () =>
              import('@/pages/analyze-visual/RealtimeDashboard/RealtimeDashboard'),
            meta: {
              title: '实时看板',
              icon: Gauge,
              menuCode: MENU_PERM.DASHBOARD_REALTIME_VIEW,
            },
          },
          {
            id: 'analyze-visual-dashboard-task',
            path: 'dashboard-task',
            loadPage: () =>
              import('@/pages/analyze-visual/TaskStatisticsReport/TaskStatisticsReport'),
            meta: {
              title: '任务统计报表',
              icon: ListTodo,
              menuCode: MENU_PERM.DASHBOARD_TASK_VIEW,
            },
          },
          {
            id: 'analyze-visual-dashboard-fault',
            path: 'dashboard-fault',
            loadPage: () => import('@/pages/analyze-visual/FaultAlert/FaultAlert'),
            meta: {
              title: '故障告警',
              icon: TriangleAlert,
              menuCode: MENU_PERM.DASHBOARD_FAULT_VIEW,
            },
          },
          {
            id: 'analyze-visual-vehicle-status',
            path: 'vehicle-status',
            loadPage: () => import('@/pages/analyze-visual/VehicleStatus/VehicleStatus'),
            meta: {
              title: '车辆状态统计',
              icon: ChartColumn,
              menuCode: MENU_PERM.VEHICLE_STATUS_VIEW,
            },
          },
          {
            // 菜单别名：点击后 replace 到布局外的全屏监控页
            id: 'analyze-visual-server-resource',
            path: 'server-resource',
            redirect: '/analyze-visual/server-resource-monitor',
            meta: {
              title: '服务器资源',
              icon: Server,
              menuCode: MENU_PERM.SERVER_RESOURCE_MONITOR_VIEW,
            },
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
    // 任务详情：应用内按 orderTaskKey 区分对象页签（SPEC §8.1/P38）
    id: 'order-info',
    path: '/order-info',
    loadPage: () => import('@/pages/order-info/OrderInfo/OrderInfo'),
    meta: {
      title: '任务详情',
      hideInMenu: true,
      i18nNamespaces: ['common'],
      objectParam: 'orderTaskKey',
    },
  },
  {
    // 车辆详情：应用内按 vehicleKey 区分对象页签（SPEC §8.1/P39）
    id: 'vehicle-info',
    path: '/vehicle-info',
    loadPage: () => import('@/pages/vehicle-info/VehicleInfo/VehicleInfo'),
    meta: {
      title: '车辆详情',
      hideInMenu: true,
      i18nNamespaces: ['common'],
      objectParam: 'vehicleKey',
    },
  },
  {
    // 服务器资源监控全屏页：「服务器资源」菜单别名 redirect 的实际目标；
    // 全屏是会话内视图切换，隐藏外壳但不销毁会话层缓存宿主
    id: 'server-resource-monitor',
    path: '/analyze-visual/server-resource-monitor',
    loadPage: () =>
      import('@/pages/analyze-visual/ServerRealtimeResources/ServerRealtimeResources'),
    meta: {
      ...sessionOverlayMeta('服务器资源监控'),
      menuCode: MENU_PERM.SERVER_RESOURCE_MONITOR_VIEW,
    },
  },
  {
    id: 'no-permission',
    path: '/no-permission',
    loadPage: () => import('@/pages/un-access/UnAccess/UnAccess'),
    meta: { ...sessionOverlayMeta('无权限'), i18nNamespaces: ['common'] },
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

/* pathname → 叶子定义反查（静态路径路由，无动态段；'*' 通配不收录） */

const definitionByPath = new Map<string, AppRouteDefinition>()

function collectLeafPaths(definitions: readonly AppRouteDefinition[], basePath: string): void {
  for (const definition of definitions) {
    const path = joinPath(basePath, definition.path)
    if (definition.children?.length) {
      collectLeafPaths(definition.children, path)
      continue
    }
    if (definition.path !== undefined && !definition.path.includes('*')) {
      definitionByPath.set(path, definition)
    }
  }
}
collectLeafPaths(appRouteDefinitions, '/')

/** 取规范化 pathname（去尾斜杠，根除外）命中的叶子定义；未命中返回 undefined */
export function findDefinitionByPath(pathname: string): AppRouteDefinition | undefined {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return definitionByPath.get(normalized)
}

/** 常驻页签播种数据：affixTab 叶子的规范化地址（无 search）与路由 id */
export interface AffixTabSeed {
  key: string
  routeId: string
  pathname: string
}

/** 收集全部 affixTab 页面路由（按定义顺序）；页签状态初始化时据此播种，刷新后常驻页签不丢失 */
export function collectAffixTabSeeds(): AffixTabSeed[] {
  const seeds: AffixTabSeed[] = []
  const walk = (definitions: readonly AppRouteDefinition[], basePath: string): void => {
    for (const definition of definitions) {
      const path = joinPath(basePath, definition.path)
      if (definition.children?.length) {
        walk(definition.children, path)
        continue
      }
      if (
        definition.loadPage &&
        definition.meta.affixTab === true &&
        definition.meta.hideInTabs !== true
      ) {
        seeds.push({ key: path, routeId: definition.id, pathname: path })
      }
    }
  }
  walk(appRouteDefinitions, '/')
  return seeds
}
