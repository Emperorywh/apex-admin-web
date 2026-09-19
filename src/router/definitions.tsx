/**
 * 路由定义唯一来源（AppRouteDefinition[]）：id 与 path 只在此声明。
 * 顶层节点用绝对路径（以 / 开头），子节点用相对段；完整路径由树推导进
 * ROUTE_PATHS（按 id 索引），业务代码不拼接、不复制路径。
 * 新增页面只需在树中加一个节点（id、path、loadPage、meta），访问路由、
 * 纯渲染路由、菜单与 ROUTE_IDS/ROUTE_PATHS/RouteId 自动生效。
 * 业务页面只能通过 loadPage 延迟加载，且必须指向具名实现路径。
 *
 * 权限挂接（T00.4）：业务节点 meta.perm 对应后端 permissionsTree 的菜单码
 * （PERM 常量，码值与旧系统逐一核实对齐，见 permission.constants.ts）；
 * 分组目录节点同样持码，用于「有子菜单则父分组可见」的祖先填充。
 * 未声明 perm 的业务页 = 登录即可达（旧 Umi「未写 access」语义；
 * 载具类型/数据库备份等待 P06/P30 核对后端菜单树后决定是否收码）。
 *
 * 迁移过渡（meta.migrationPending）：页面迁移任务未完成的叶子渲染统一迁移
 * 占位、不加载页面代码、不作为登录落点候选；对应任务完成后由统筹移除标记。
 *
 * 菜单结构复刻自源系统路由配置：
 * - 完全公开页（meta.public）仅登录页与显式 404；其余独立页（软件授权、
 *   无权限、独立详情、全屏监控）一律受认证守卫，不因布局外而公开；
 * - 目录节点的默认子页用 index 表达，点击目录索引时动态解析为
 *   「首个有权限且已完成迁移」的子页，不得指向无权限/未迁移页；
 * - 「服务器资源」菜单别名 redirect 到布局外的全屏监控页。
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
  LayoutDashboard,
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
import { PERM } from '@/constants/auth/permission.constants'
import type { AppRouteDefinition, RouteMeta } from '@/router/router.types'

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

/** 布局外独立页（源配置 layout: false）的辅助路由 meta：不公开，受认证守卫 */
function standaloneMeta(
  title: string,
  extra?: Partial<Pick<RouteMeta, 'perm' | 'migrationPending' | 'i18nNamespaces'>>,
): AppRouteDefinition['meta'] {
  return {
    title,
    hideInMenu: true,
    hideInTabs: true,
    noCache: true,
    ...extra,
  }
}

/** 目录默认子页（index 节点）的辅助路由 meta：落点由守卫动态解析 */
function indexRedirectMeta(title: string): AppRouteDefinition['meta'] {
  return {
    title,
    hideInMenu: true,
    hideInTabs: true,
    noCache: true,
  }
}

/**
 * 业务叶子 meta（挂权限码）。
 * pending 为 true 时追加迁移过渡标记：统一占位呈现、不作登录落点候选；
 * 对应页面迁移任务完成后由统筹移除该标记（本文件唯一改动点）。
 * deferred 为 true 时追加本期暂缓标记（D07/H01–H03）：页面加载统一
 * 「本期暂未迁移」说明、菜单/直访按原权限可达，但不作登录落点候选。
 */
function businessMeta(
  title: string,
  perm: RouteMeta['perm'],
  options?: {
    icon?: RouteMeta['icon']
    i18nNamespaces?: RouteMeta['i18nNamespaces']
    affixTab?: boolean
    pending?: boolean
    migrationDeferred?: boolean
  },
): RouteMeta {
  return {
    title,
    perm,
    migrationPending: options?.pending === true || undefined,
    ...(options?.migrationDeferred === true ? { migrationDeferred: true } : {}),
    ...(options?.icon !== undefined ? { icon: options.icon } : {}),
    ...(options?.i18nNamespaces !== undefined
      ? { i18nNamespaces: options.i18nNamespaces }
      : {}),
    ...(options?.affixTab === true ? { affixTab: true } : {}),
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
      // 登录页是唯一的登录前公开入口之一（另一处是显式 404）
      public: true,
    },
  },
  {
    // 软件授权：独立页但绝不公开（规格 5.6）；未登录被守卫送回登录页，
    // activated=false 的用户由登录落点引导至此。P02 已交付页内真实激活流程
    // （硬件码读取/复制 + 激活提交 + 成功按落点规则导航），迁移过渡标记摘除
    id: 'authorize-ingress',
    path: '/authorize-ingress',
    loadPage: () => import('@/pages/authorize-ingress/AuthorizeIngress/AuthorizeIngress'),
    meta: standaloneMeta('软件授权', { i18nNamespaces: ['license-activation'] }),
  },
  {
    id: 'root',
    path: '/',
    meta: { title: '调度系统' },
    children: [
      {
        // 受保护根的默认落点：守卫按会话动态解析（D29），
        // 不再静态指向某个固定页面，避免指向无权限/未迁移页
        id: 'root-index',
        index: true,
        meta: { title: '工作台', hideInMenu: true, hideInTabs: true, noCache: true },
      },
      {
        // 个人中心：登录即可达（无菜单码；模板能力，P43 收口）
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
        // 合并业务首页（P34 将合并模板仪表盘与旧实时看板到本实例）：
        // 与实时看板同码 dashboard-realtime:view；迁移完成前不作落点
        id: 'dashboard',
        path: 'dashboard',
        loadPage: () => import('@/pages/dashboard/Dashboard/Dashboard'),
        meta: businessMeta('仪表盘', PERM.DASHBOARD_REALTIME_VIEW, {
          icon: LayoutDashboard,
          i18nNamespaces: ['dashboard'],
          affixTab: true,
          pending: true,
        }),
      },
      {
        id: 'over-look',
        path: 'over-look',
        loadPage: () => import('@/pages/overlook/Overlook/Overlook'),
        meta: businessMeta('调度监控', PERM.OVERVIEW_VIEW, {
          icon: LayoutGrid,
          // H01 交付：本期暂缓入口（D07），页面加载统一「本期暂未迁移」说明；
          // 权限保持旧 .umirc.ts 的 overview:view，不迁业务、不作登录落点
          migrationDeferred: true,
        }),
      },
      {
        id: 'order-record',
        path: 'order-record',
        loadPage: () => import('@/pages/order-record/OrderRecord/OrderRecord'),
        meta: businessMeta('任务管理', PERM.ORDER_RECORD_VIEW, {
          icon: List,
          // orderInfo：详情弹窗「完整详情」按钮文案（P38 新增，弹窗共用该分片）
          i18nNamespaces: ['orderRecord', 'orderInfo'],
        }),
      },
      {
        id: 'vehicle-deploy',
        path: 'vehicle-deploy',
        meta: { title: '车辆管理', icon: Car, perm: PERM.VEHICLE_MANAGE },
        children: [
          {
            id: 'vehicle-deploy-index',
            index: true,
            meta: indexRedirectMeta('车辆管理'),
          },
          {
            id: 'vehicle-deploy-vehicle-group',
            path: 'vehicle-group',
            loadPage: () => import('@/pages/vehicle-deploy/VehicleGroup/VehicleGroup'),
            // P04 交付解除 pending：真实分组管理页（vehicleGroup 为页面私有分片）
            meta: businessMeta('车辆分组', PERM.VEHICLE_GROUP_VIEW, {
              i18nNamespaces: ['vehicleGroup'],
            }),
          },
          {
            // path 保持源配置原样拼写（vehicle-diplay，历史别名按 A22 保留）
            id: 'vehicle-deploy-vehicle-display',
            path: 'vehicle-diplay',
            loadPage: () => import('@/pages/vehicle-deploy/VehicleDisplay/VehicleDisplay'),
            meta: businessMeta('车辆列表', PERM.VEHICLE_LIST_VIEW, {
              // vehicleList：列表页私有分片；vehicleInfo：详情抽屉「完整详情」
              // 按钮文案（P39 分片，跳转 /vehicle-info 往返链路共用）
              i18nNamespaces: ['vehicleList', 'vehicleInfo'],
            }),
          },
          {
            // 载具类型（P06 交付解除 pending）：后端权限树真实下发 carrier:view
            // （MENU，旧 permission 数据 id=23，无 path；旧前端路由未写 access、
            // 由 MENU_TREE 兜底映射本路径）——路由挂后端已有码 PERM.CARRIER_VIEW，
            // 不公开访问也不凭空造码（contracts.md 第 3 节核对结论）
            id: 'vehicle-deploy-vehicle-type',
            path: 'vehicle-type',
            loadPage: () => import('@/pages/vehicle-deploy/VehicleType/VehicleType'),
            meta: businessMeta('载具类型', PERM.CARRIER_VIEW, {
              i18nNamespaces: ['carrierType'],
            }),
          },
          {
            // 节点映射（P07 交付解除 pending）：旧 SPEC §6 权限码 node-mapping:view
            // 后端已下发接入，路由挂后端已有码 PERM.NODE_MAPPING_VIEW；
            // 选点弹窗画布文案随 ReadOnlyMap 消费共享 map 命名空间
            id: 'vehicle-deploy-node-mapping',
            path: 'node-mapping',
            loadPage: () => import('@/pages/vehicle-deploy/NodeMapping/NodeMapping'),
            meta: businessMeta('节点映射', PERM.NODE_MAPPING_VIEW, {
              i18nNamespaces: ['nodeMapping', 'map'],
            }),
          },
          {
            // 告警码管理（P08 交付解除 pending）：后端权限树真实下发 vehicle-alarm-code:view
            // （MENU，旧 permission 数据 id=27，path=/vehicle-deploy/vehicle-alarm-code；
            // 任务卡入口沿用旧前端路由拼写 /vehicle-deploy/alarm-code-management，
            // 新路由树以 meta.perm 挂后端已有码判权，不公开访问不凭空造码）
            id: 'vehicle-deploy-alarm-code',
            path: 'alarm-code-management',
            loadPage: () =>
              import('@/pages/system-involve/AlarmCodeManagement/AlarmCodeManagement'),
            meta: businessMeta('告警码管理', PERM.VEHICLE_ALARM_CODE_VIEW, {
              i18nNamespaces: ['vehicleAlarmCode'],
            }),
          },
        ],
      },
      {
        id: 'map-through',
        path: 'map-through',
        meta: { title: '地图管理', icon: Image, perm: PERM.MAP_MANAGE },
        children: [
          {
            id: 'map-through-index',
            index: true,
            meta: indexRedirectMeta('地图管理'),
          },
          {
            // 地图列表（P09 交付解除 pending）：菜单码 map-list:view 挂路由守卫
            // （后端权限树/旧权限数据按既有码判权，不公开访问不凭空造码）
            id: 'map-through-map-list',
            path: 'map-list',
            loadPage: () => import('@/pages/map-through/MapList/MapList'),
            meta: businessMeta('地图列表', PERM.MAP_LIST_VIEW, {
              i18nNamespaces: ['mapList'],
            }),
          },
          {
            // H02 暂缓入口：菜单与直访保留给有权限用户，进入统一暂缓/迁移说明
            id: 'map-through-map-nest-modify',
            path: 'map-nest-modify',
            loadPage: () => import('@/pages/map-through/MapNestModify/MapNestModify'),
            meta: businessMeta('地图编辑', PERM.MAP_EDIT_VIEW, { migrationDeferred: true }),
          },
          {
            // 跨地图关联（P10 交付解除 pending）：菜单码 cross-map:view 挂路由守卫
            // （按钮码 cross-map:add/update/delete 在页面内控制入口显隐，
            // 与旧 §7/§8.2 一致，后端权限树按既有码判权不凭空造码）
            id: 'map-through-cross-maps',
            path: 'cross-maps',
            loadPage: () => import('@/pages/map-through/CrossMaps/CrossMaps'),
            meta: businessMeta('地图关联', PERM.CROSS_MAP_VIEW, {
              i18nNamespaces: ['crossMap'],
            }),
          },
          {
            // 多地图点边组合（P11 交付解除 pending）：菜单码 point-edge-combination:view
            // 挂路由守卫（按钮码 add/update/delete 在页面内控制入口显隐，
            // 与旧 §7/§8.2 一致，后端权限树按既有码判权不凭空造码）
            id: 'map-through-point-edge-combination',
            path: 'point-edge-combination',
            loadPage: () =>
              import('@/pages/map-through/PointEdgeCombination/PointEdgeCombination'),
            meta: businessMeta('多地图点边组合', PERM.POINT_EDGE_COMBINATION_VIEW, {
              i18nNamespaces: ['nodeEdgeGroup'],
            }),
          },
          {
            id: 'map-through-map-push-records',
            path: 'map-push-records',
            loadPage: () =>
              import('@/pages/map-through/MapPushNotificationRecords/MapPushNotificationRecords'),
            // P12 整页交付：解除 pending 挂菜单码 map-push-record:view
            // （按钮码 map-push-record:re-push 在页面内控制重推/取消入口显隐）
            meta: businessMeta('地图推送记录', PERM.MAP_PUSH_RECORD_VIEW, {
              i18nNamespaces: ['mapPushRecord'],
            }),
          },
        ],
      },
      {
        id: 'dispatch-hub',
        path: 'dispatch-hub',
        loadPage: () => import('@/pages/dispatch-hub/DispatchHub/DispatchHub'),
        // P13 整页交付：解除 pending 挂菜单码 dispatch-hub:view
        // （按钮码 save/reset 在页面内控制保存/重置入口与单元格可编辑显隐）
        meta: businessMeta('调度中心', PERM.DISPATCH_HUB_VIEW, {
          icon: Box,
          i18nNamespaces: ['dispatchConfig'],
        }),
      },
      {
        id: 'tri-resource',
        path: 'tri-resource',
        meta: { title: '三方资源', icon: Cable, perm: PERM.THIRD_PARTY_MANAGE },
        children: [
          {
            id: 'tri-resource-index',
            index: true,
            meta: indexRedirectMeta('三方资源'),
          },
          {
            id: 'tri-resource-tri-device',
            path: 'tri-device',
            meta: {
              title: '三方设备',
              icon: Cpu,
              perm: PERM.THIRD_PARTY_DEVICE_MANAGE,
            },
            children: [
              {
                id: 'tri-resource-tri-device-index',
                index: true,
                meta: indexRedirectMeta('三方设备'),
              },
              {
                id: 'tri-resource-tri-device-elevator',
                path: 'elevator',
                loadPage: () => import('@/pages/tri-device/Elevator/Elevator'),
                meta: businessMeta('电梯', PERM.DEVICE_ELEVATOR_VIEW, {
                  icon: ArrowDownUp,
                  // P14 交付：deviceElevator 页面私有命名空间
                  i18nNamespaces: ['deviceElevator'],
                }),
              },
              {
                id: 'tri-resource-tri-device-auto-door',
                path: 'auto-door',
                loadPage: () => import('@/pages/tri-device/AutoDoor/AutoDoor'),
                meta: businessMeta('自动门', PERM.DEVICE_AUTO_DOOR_VIEW, {
                  icon: DoorOpen,
                  // P15 交付：deviceAutoDoor 页面私有命名空间
                  i18nNamespaces: ['deviceAutoDoor'],
                }),
              },
              {
                // path 保持源配置原样拼写（charge-pie）
                id: 'tri-resource-tri-device-charge-pile',
                path: 'charge-pie',
                loadPage: () => import('@/pages/tri-device/ModbusChargePile/ModbusChargePile'),
                meta: businessMeta('充电桩', PERM.DEVICE_CHARGE_PILE_VIEW, {
                  icon: PlugZap,
                  // P16 交付：deviceChargePile 页面私有命名空间
                  i18nNamespaces: ['deviceChargePile'],
                }),
              },
              {
                id: 'tri-resource-tri-device-traffic-lights',
                path: 'traffic-lights',
                loadPage: () => import('@/pages/tri-device/TrafficLights/TrafficLights'),
                meta: businessMeta('交通灯', PERM.DEVICE_TRAFFIC_LIGHT_VIEW, {
                  icon: TrafficCone,
                  pending: true,
                }),
              },
              {
                id: 'tri-resource-tri-device-air-shower-door',
                path: 'air-shower-door',
                loadPage: () => import('@/pages/tri-device/AirShowerDoor/AirShowerDoor'),
                meta: businessMeta('风淋门', PERM.DEVICE_AIR_SHOWER_DOOR_VIEW, {
                  icon: Wind,
                  pending: true,
                }),
              },
            ],
          },
          {
            id: 'tri-resource-tri-traffic',
            path: 'tri-traffic',
            loadPage: () => import('@/pages/tri-traffic/TriTraffic/TriTraffic'),
            meta: businessMeta('三方交管', PERM.TRAFFIC_TRIPARTITE_VIEW, {
              icon: CircleMinus,
              pending: true,
            }),
          },
        ],
      },
      {
        id: 'mission-cluster',
        path: 'mission-cluster',
        meta: { title: '工艺配置', icon: Workflow, perm: PERM.PROCESS_MANAGE },
        children: [
          {
            id: 'mission-cluster-index',
            index: true,
            meta: indexRedirectMeta('工艺配置'),
          },
          {
            // 注意历史码值交叉：本页（任务工艺）挂 mission-flow:view
            id: 'mission-cluster-mission-create',
            path: 'mission-create',
            loadPage: () => import('@/pages/mission-cluster/MissionCreate/MissionCreate'),
            meta: businessMeta('任务工艺', PERM.MISSION_FLOW_VIEW, { pending: true }),
          },
          {
            // 注意历史码值交叉：本页（工艺管理）挂 mission-template:view
            id: 'mission-cluster-mission-flow',
            path: 'mission-flow',
            loadPage: () => import('@/pages/mission-cluster/MissionFlow/MissionFlow'),
            meta: businessMeta('工艺管理', PERM.MISSION_TEMPLATE_VIEW, { pending: true }),
          },
          {
            id: 'mission-cluster-obstacle-avoidance',
            path: 'obstacle-avoidance',
            loadPage: () =>
              import('@/pages/obstacle-avoidance/ObstacleAvoidance/ObstacleAvoidance'),
            meta: businessMeta('避障模板', PERM.OBSTACLE_AVOIDANCE_VIEW, {
              icon: CircleMinus,
              pending: true,
            }),
          },
          {
            id: 'mission-cluster-action-control',
            path: 'action-control',
            meta: { title: '动作管理', icon: SquareFunction, perm: PERM.ACTION_MANAGE },
            children: [
              {
                id: 'mission-cluster-action-control-index',
                index: true,
                meta: indexRedirectMeta('动作管理'),
              },
              {
                id: 'mission-cluster-action-control-agv-action',
                path: 'agv-action',
                loadPage: () => import('@/pages/action-control/AGVAction/AGVAction'),
                meta: businessMeta('车辆动作', PERM.ACTION_VEHICLE_VIEW, { pending: true }),
              },
              {
                id: 'mission-cluster-action-control-agv-action-group',
                path: 'agv-action-group',
                loadPage: () =>
                  import('@/pages/action-control/AGVActionGroup/AGVActionGroup'),
                meta: businessMeta('动作分组', PERM.ACTION_GROUP_VIEW, { pending: true }),
              },
            ],
          },
        ],
      },
      {
        id: 'system-involve',
        path: 'system-involve',
        meta: { title: '系统管理', icon: Settings, perm: PERM.SYSTEM_MANAGE },
        children: [
          {
            id: 'system-involve-index',
            index: true,
            meta: indexRedirectMeta('系统管理'),
          },
          {
            id: 'system-involve-version-control',
            path: 'version-control',
            loadPage: () => import('@/pages/system-involve/VersionControl/VersionControl'),
            meta: businessMeta('版本管理', PERM.SYSTEM_VERSION_VIEW, { pending: true }),
          },
          {
            id: 'system-involve-system-log',
            path: 'system-log',
            loadPage: () => import('@/pages/system-involve/SystemLog/SystemLog'),
            meta: businessMeta('系统日志', PERM.SYSTEM_LOG_VIEW, { pending: true }),
          },
          {
            id: 'system-involve-system-setting',
            path: 'system-setting',
            loadPage: () => import('@/pages/system-involve/SystemSetting/SystemSetting'),
            meta: businessMeta('系统设置', PERM.SYSTEM_SETTING_VIEW, { pending: true }),
          },
          {
            id: 'system-involve-operation-log',
            path: 'operation-log',
            loadPage: () => import('@/pages/system-involve/OperationLog/OperationLog'),
            meta: businessMeta('操作日志', PERM.SYSTEM_OPERATION_LOG_VIEW, {
              pending: true,
            }),
          },
          {
            id: 'system-involve-software-information',
            path: 'software-information',
            loadPage: () =>
              import('@/pages/system-involve/SoftwareInformation/SoftwareInformation'),
            meta: businessMeta('软件信息', PERM.SYSTEM_SOFTWARE_VIEW, { pending: true }),
          },
          {
            // 数据库备份：旧路由未写 access（P30 核对原权限清单后再定，规格 5.12）
            id: 'system-involve-database-backup',
            path: 'database-backup',
            loadPage: () =>
              import('@/pages/system-involve/DatabaseBackupManagement/DatabaseBackupManagement'),
            meta: businessMeta('数据库备份管理', undefined, { pending: true }),
          },
        ],
      },
      {
        // 权限管理：root 专属码（ROOT_ONLY_CODES），非超管即使后端下发也不可见
        id: 'access-management',
        path: 'access-management',
        meta: { title: '权限管理', icon: ShieldCheck, perm: PERM.AUTH_MANAGE },
        children: [
          {
            id: 'access-management-index',
            index: true,
            meta: indexRedirectMeta('权限管理'),
          },
          {
            id: 'access-management-user-management',
            path: 'user-management',
            loadPage: () =>
              import('@/pages/access-management/UserManagement/UserManagement'),
            meta: businessMeta('用户管理', PERM.AUTH_USER_VIEW, { pending: true }),
          },
          {
            id: 'access-management-role-management',
            path: 'role-management',
            loadPage: () =>
              import('@/pages/access-management/RoleManagement/RoleManagement'),
            meta: businessMeta('角色管理', PERM.AUTH_ROLE_VIEW, { pending: true }),
          },
        ],
      },
      {
        id: 'analyze-visual',
        path: 'analyze-visual',
        meta: { title: '数据统计', icon: Signal, perm: PERM.STATISTICS_MANAGE },
        children: [
          {
            id: 'analyze-visual-index',
            index: true,
            meta: indexRedirectMeta('数据统计'),
          },
          {
            id: 'analyze-visual-order-statistics',
            path: 'order-statistics',
            loadPage: () =>
              import('@/pages/analyze-visual/OrderStatistics/OrderStatistics'),
            meta: businessMeta('任务统计', PERM.STATISTICS_ORDER_VIEW, { pending: true }),
          },
          {
            // H03 暂缓入口（D07）：本期确定不迁移，页面加载统一「本期暂未迁移」说明；
            // 权限保持旧 .umirc.ts 的 record-playback:view，不迁业务、不作登录落点
            id: 'analyze-visual-record-playback',
            path: 'record-playback',
            loadPage: () => import('@/pages/record-playback/RecordPlayback/RecordPlayback'),
            meta: businessMeta('录制回放', PERM.RECORD_PLAYBACK_VIEW, {
              icon: CirclePlay,
              migrationDeferred: true,
            }),
          },
          {
            // P34 将把本页与 /dashboard 合并为同一实例（D29）；迁移前不作落点
            id: 'analyze-visual-dashboard-realtime',
            path: 'dashboard-realtime',
            loadPage: () =>
              import('@/pages/analyze-visual/RealtimeDashboard/RealtimeDashboard'),
            meta: businessMeta('实时看板', PERM.DASHBOARD_REALTIME_VIEW, {
              icon: Gauge,
              pending: true,
            }),
          },
          {
            id: 'analyze-visual-dashboard-task',
            path: 'dashboard-task',
            loadPage: () =>
              import('@/pages/analyze-visual/TaskStatisticsReport/TaskStatisticsReport'),
            meta: businessMeta('任务统计报表', PERM.DASHBOARD_TASK_VIEW, {
              icon: ListTodo,
              pending: true,
            }),
          },
          {
            id: 'analyze-visual-dashboard-fault',
            path: 'dashboard-fault',
            loadPage: () => import('@/pages/analyze-visual/FaultAlert/FaultAlert'),
            meta: businessMeta('故障告警', PERM.DASHBOARD_FAULT_VIEW, {
              icon: TriangleAlert,
              pending: true,
            }),
          },
          {
            id: 'analyze-visual-vehicle-status',
            path: 'vehicle-status',
            loadPage: () => import('@/pages/analyze-visual/VehicleStatus/VehicleStatus'),
            meta: businessMeta('车辆状态统计', PERM.VEHICLE_STATUS_VIEW, {
              icon: ChartColumn,
              pending: true,
            }),
          },
          {
            // 菜单别名：点击后 replace 到布局外的全屏监控页（守卫按同码校验）
            id: 'analyze-visual-server-resource',
            path: 'server-resource',
            redirect: '/analyze-visual/server-resource-monitor',
            meta: businessMeta('服务器资源', PERM.SERVER_RESOURCE_MONITOR_VIEW, {
              icon: Server,
            }),
          },
        ],
      },
      {
        // 完整任务详情（P38）：位于受保护根内 = 默认工作区页签形态（D08/规格 7）。
        // 完整路径保持 /order-info（joinPath('/', 'order-info')），历史地址不变；
        // 实体定位参数 ?orderKey=... 进入页签 key（pathname+规范化 search），
        // 不同任务自动获得独立页签与请求 scope；hideInMenu 保证详情页不进
        // Dock 菜单、也不作为登录落点候选（isLandingCandidate 排除 hideInMenu）。
        // 独立窗口形态由页面工具栏经 openStandaloneWindow 打开同一路径（同守卫）。
        id: 'order-info',
        path: 'order-info',
        loadPage: () => import('@/pages/order-info/OrderInfo/OrderInfo'),
        meta: {
          title: '任务详情',
          perm: PERM.ORDER_RECORD_VIEW,
          hideInMenu: true,
          // orderInfo：P38 页面私有分片（独立窗口/缺参数等新增文案）；
          // orderRecord：详情业务组件文案（P03 已交付四语言，弹窗/页面共用）
          i18nNamespaces: ['orderInfo', 'orderRecord'],
        },
      },
      {
        // 完整车辆详情（P39）：同构 order-info 迁入受保护根 = 默认工作区页签形态。
        // 完整路径保持 /vehicle-info（joinPath('/', 'vehicle-info')），历史地址不变；
        // 实体定位参数 ?vehicleKey=... 进入页签 key，不同车辆独立页签/请求 scope；
        // hideInMenu 不进菜单、不作为登录落点候选；独立窗口由页面工具栏
        // openStandaloneWindow 打开同一路径（同守卫）。
        // vehicleInfo：页面私有分片（详情标签/枚举/独立窗口/缺参数等文案）。
        id: 'vehicle-info',
        path: 'vehicle-info',
        loadPage: () => import('@/pages/vehicle-info/VehicleInfo/VehicleInfo'),
        meta: {
          title: '车辆详情',
          perm: PERM.VEHICLE_LIST_VIEW,
          hideInMenu: true,
          i18nNamespaces: ['vehicleInfo'],
        },
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
    // 服务器资源监控全屏页：与菜单别名同码，鉴权不公开（P40）
    id: 'server-resource-monitor',
    path: '/analyze-visual/server-resource-monitor',
    loadPage: () =>
      import('@/pages/analyze-visual/ServerRealtimeResources/ServerRealtimeResources'),
    meta: standaloneMeta('服务器资源监控', {
      perm: PERM.SERVER_RESOURCE_MONITOR_VIEW,
      migrationPending: true,
    }),
  },
  {
    // 无权限落点（P41）：受认证守卫（未登录访问送回登录页），不公开但无菜单码；
    // 声明 access-denied 分片供 I18nPageGate 预载（common 为常驻基座无需声明）
    id: 'no-permission',
    path: '/no-permission',
    loadPage: () => import('@/pages/un-access/UnAccess/UnAccess'),
    meta: standaloneMeta('无权限', { i18nNamespaces: ['access-denied'] }),
  },
  {
    // 显式 404：登录前也可达的兜底页
    id: 'error-404',
    path: '/404',
    loadPage: () => import('@/pages/error/NotFound/NotFound'),
    meta: { ...auxiliaryMeta('页面不存在'), public: true },
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
