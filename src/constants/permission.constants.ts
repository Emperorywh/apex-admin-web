/**
 * 菜单权限码常量（迁移自旧系统 src/constants/permission.ts @ e570b8df 的 PERM）。
 *
 * 与后端 permissionsTree 中 type=MENU 的 code 一一对应，值不改名；
 * 路由级鉴权（guard）、菜单过滤（Dock）与权限树注入（permissionTree）
 * 统一引用此处，避免魔法字符串散落。
 *
 * 与源系统的两处明确差异（SPEC §8.2 修正，纳入差异清单）：
 * - 载具类型（/vehicle-deploy/vehicle-type）：源 .umirc.ts 遗漏 access，
 *   目标统一要求 CARRIER_VIEW（菜单与直访一致）；
 * - 数据库备份（/system-involve/database-backup）：源同样遗漏 access，
 *   目标统一要求 SYSTEM_DATABASE_BACKUP_VIEW（下载按钮码另按页面卡接入）。
 */

/** 菜单（含分组）权限码；键名沿用源 PERM 命名，值与后端 MENU 节点一致 */
export const MENU_PERM = {
  // 顶级分组（后端 path 为空，仅作菜单层级容器）
  VEHICLE_MANAGE: 'vehicle:manage',
  MAP_MANAGE: 'map:manage',
  THIRD_PARTY_MANAGE: 'third-party:manage',
  THIRD_PARTY_DEVICE_MANAGE: 'third-party-device:manage',
  PROCESS_MANAGE: 'process:manage',
  ACTION_MANAGE: 'action:manage',
  SYSTEM_MANAGE: 'system:manage',
  STATISTICS_MANAGE: 'statistics:manage',
  AUTH_MANAGE: 'auth:manage',

  // 叶子页面菜单码
  OVERVIEW_VIEW: 'overview:view',
  ORDER_RECORD_VIEW: 'order-record:view',
  VEHICLE_GROUP_VIEW: 'vehicle-group:view',
  VEHICLE_LIST_VIEW: 'vehicle-list:view',
  CARRIER_VIEW: 'carrier:view',
  NODE_MAPPING_VIEW: 'node-mapping:view',
  VEHICLE_ALARM_CODE_VIEW: 'vehicle-alarm-code:view',
  MAP_LIST_VIEW: 'map-list:view',
  MAP_EDIT_VIEW: 'map-edit:view',
  CROSS_MAP_VIEW: 'cross-map:view',
  POINT_EDGE_COMBINATION_VIEW: 'point-edge-combination:view',
  MAP_PUSH_RECORD_VIEW: 'map-push-record:view',
  DISPATCH_HUB_VIEW: 'dispatch-hub:view',
  DEVICE_ELEVATOR_VIEW: 'device:elevator:view',
  DEVICE_AUTO_DOOR_VIEW: 'device:auto-door:view',
  DEVICE_CHARGE_PILE_VIEW: 'device:charge-pile:view',
  DEVICE_TRAFFIC_LIGHT_VIEW: 'device:traffic-light:view',
  DEVICE_AIR_SHOWER_DOOR_VIEW: 'device:air-shower-door:view',
  TRAFFIC_TRIPARTITE_VIEW: 'traffic:tripartite:view',
  MISSION_FLOW_VIEW: 'mission-flow:view',
  MISSION_TEMPLATE_VIEW: 'mission-template:view',
  OBSTACLE_AVOIDANCE_VIEW: 'obstacle-avoidance:view',
  ACTION_VEHICLE_VIEW: 'action:vehicle:view',
  ACTION_GROUP_VIEW: 'action-group:view',
  SYSTEM_VERSION_VIEW: 'system:version:view',
  SYSTEM_LOG_VIEW: 'system:log:view',
  SYSTEM_SETTING_VIEW: 'system:setting:view',
  SYSTEM_OPERATION_LOG_VIEW: 'system:operation-log:view',
  SYSTEM_SOFTWARE_VIEW: 'system:software:view',
  SYSTEM_DATABASE_BACKUP_VIEW: 'system:database-backup:view',
  AUTH_USER_VIEW: 'auth:user:view',
  AUTH_ROLE_VIEW: 'auth:role:view',
  STATISTICS_ORDER_VIEW: 'statistics:order:view',
  RECORD_PLAYBACK_VIEW: 'record-playback:view',
  DASHBOARD_REALTIME_VIEW: 'dashboard-realtime:view',
  DASHBOARD_TASK_VIEW: 'dashboard-task:view',
  DASHBOARD_FAULT_VIEW: 'dashboard-fault:view',
  VEHICLE_STATUS_VIEW: 'vehicle-status:view',
  SERVER_RESOURCE_MONITOR_VIEW: 'server-resource-monitor:view',
} as const

/** 菜单权限码字面量联合类型 */
export type MenuPermCode = (typeof MENU_PERM)[keyof typeof MENU_PERM]

/** 对象详情页签的规范化查询参数名（SPEC §8.1：路由+业务对象标识） */
export const OBJECT_TAB_PARAMS = {
  orderInfo: 'orderTaskKey',
  vehicleInfo: 'vehicleKey',
} as const
