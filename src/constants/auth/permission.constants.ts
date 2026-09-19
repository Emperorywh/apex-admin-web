/**
 * 权限码契约（T00.4 权限与路由）。
 *
 * 码值逐一对应后端 permissionsTree 中 type=MENU 的 code 与
 * 登录返回 data.permissions（按钮码平铺数组）中的 code；
 * 来源为旧项目 src/constants/permission.ts 的已核实映射
 * （旧 .umirc.ts 路由 access 与后端权限树一一对齐的结论），不在迁移期改写任何码值。
 *
 * 维护约定：
 * - 菜单码通过路由定义树（src/router/definitions.tsx）的 meta.perm 挂接，
 *   不再维护旧项目式的前端菜单结构镜像（MENU_TREE）；菜单层级唯一真相源是定义树。
 * - 后端新增/调整权限码时先同步本文件，再引用；禁止在业务代码里散落权限码字面量。
 */

/**
 * 菜单级权限码（permissionsTree 中 type=MENU 的 code）。
 * 挂接在路由定义树节点 meta.perm 上；分组目录节点也持有码
 * （后端权限树的同名分组码，用于「有子菜单则父分组可见」的祖先填充语义）。
 *
 * 注意旧系统的名称交叉：路由 /mission-cluster/mission-create（页面称「任务工艺」）
 * 使用 mission-flow:view；/mission-cluster/mission-flow（页面称「工艺管理」）
 * 使用 mission-template:view。这是后端权限树的真实码值，不得凭页面名称"纠正"。
 */
export const PERM = {
  /** 调度监控（旧系统首页） */
  OVERVIEW_VIEW: 'overview:view',
  /** 任务管理 */
  ORDER_RECORD_VIEW: 'order-record:view',
  /** 车辆管理（分组目录） */
  VEHICLE_MANAGE: 'vehicle:manage',
  /** 车辆分组 */
  VEHICLE_GROUP_VIEW: 'vehicle-group:view',
  /** 车辆列表 */
  VEHICLE_LIST_VIEW: 'vehicle-list:view',
  /**
   * 载具类型（P06 核对登记）：后端权限树真实下发 carrier:view（MENU，
   * 旧系统 permission 数据 id=23；旧前端路由未写 access、由 MENU_TREE 兜底
   * 映射 /vehicle-deploy/vehicle-type）。本处仅登记后端已有码，非凭空创造；
   * 路由挂此码后未登录守卫 + 无码用户拦截，不公开访问。
   */
  CARRIER_VIEW: 'carrier:view',
  /** 节点映射 */
  NODE_MAPPING_VIEW: 'node-mapping:view',
  /** 告警码管理 */
  VEHICLE_ALARM_CODE_VIEW: 'vehicle-alarm-code:view',
  /** 地图管理（分组目录） */
  MAP_MANAGE: 'map:manage',
  /** 地图列表 */
  MAP_LIST_VIEW: 'map-list:view',
  /** 地图编辑（H02 暂缓入口） */
  MAP_EDIT_VIEW: 'map-edit:view',
  /** 地图关联 */
  CROSS_MAP_VIEW: 'cross-map:view',
  /** 多地图点边组合 */
  POINT_EDGE_COMBINATION_VIEW: 'point-edge-combination:view',
  /** 地图推送记录 */
  MAP_PUSH_RECORD_VIEW: 'map-push-record:view',
  /** 调度中心 */
  DISPATCH_HUB_VIEW: 'dispatch-hub:view',
  /** 三方资源（分组目录） */
  THIRD_PARTY_MANAGE: 'third-party:manage',
  /** 三方设备（嵌套分组目录） */
  THIRD_PARTY_DEVICE_MANAGE: 'third-party-device:manage',
  /** 电梯 */
  DEVICE_ELEVATOR_VIEW: 'device:elevator:view',
  /** 自动门 */
  DEVICE_AUTO_DOOR_VIEW: 'device:auto-door:view',
  /** 充电桩 */
  DEVICE_CHARGE_PILE_VIEW: 'device:charge-pile:view',
  /** 交通灯 */
  DEVICE_TRAFFIC_LIGHT_VIEW: 'device:traffic-light:view',
  /** 风淋门 */
  DEVICE_AIR_SHOWER_DOOR_VIEW: 'device:air-shower-door:view',
  /** 三方交管 */
  TRAFFIC_TRIPARTITE_VIEW: 'traffic:tripartite:view',
  /** 工艺配置（分组目录） */
  PROCESS_MANAGE: 'process:manage',
  /** 任务工艺（挂 mission-flow:view，历史码值） */
  MISSION_FLOW_VIEW: 'mission-flow:view',
  /** 工艺管理（挂 mission-template:view，历史码值） */
  MISSION_TEMPLATE_VIEW: 'mission-template:view',
  /** 避障模板 */
  OBSTACLE_AVOIDANCE_VIEW: 'obstacle-avoidance:view',
  /** 动作管理（嵌套分组目录） */
  ACTION_MANAGE: 'action:manage',
  /** 车辆动作 */
  ACTION_VEHICLE_VIEW: 'action:vehicle:view',
  /** 动作分组 */
  ACTION_GROUP_VIEW: 'action-group:view',
  /** 系统管理（分组目录） */
  SYSTEM_MANAGE: 'system:manage',
  /** 版本管理 */
  SYSTEM_VERSION_VIEW: 'system:version:view',
  /** 系统日志 */
  SYSTEM_LOG_VIEW: 'system:log:view',
  /** 系统设置 */
  SYSTEM_SETTING_VIEW: 'system:setting:view',
  /** 操作日志 */
  SYSTEM_OPERATION_LOG_VIEW: 'system:operation-log:view',
  /** 软件信息 */
  SYSTEM_SOFTWARE_VIEW: 'system:software:view',
  /** 数据库备份（旧 .umirc.ts 漏写 access 但权限清单真实存在，P30 核对收敛） */
  SYSTEM_DATABASE_BACKUP_VIEW: 'system:database-backup:view',
  /** 权限管理（分组目录；root 专属） */
  AUTH_MANAGE: 'auth:manage',
  /** 用户管理（root 专属） */
  AUTH_USER_VIEW: 'auth:user:view',
  /** 角色管理（root 专属） */
  AUTH_ROLE_VIEW: 'auth:role:view',
  /** 任务统计 */
  STATISTICS_ORDER_VIEW: 'statistics:order:view',
  /** 录制回放（H03 暂缓入口） */
  RECORD_PLAYBACK_VIEW: 'record-playback:view',
  /** 数据统计（分组目录） */
  STATISTICS_MANAGE: 'statistics:manage',
  /** 实时看板（P34 合并后的首页同码） */
  DASHBOARD_REALTIME_VIEW: 'dashboard-realtime:view',
  /** 任务统计报表 */
  DASHBOARD_TASK_VIEW: 'dashboard-task:view',
  /** 故障告警 */
  DASHBOARD_FAULT_VIEW: 'dashboard-fault:view',
  /** 车辆状态统计 */
  VEHICLE_STATUS_VIEW: 'vehicle-status:view',
  /** 服务器资源监控（菜单别名与全屏页同码） */
  SERVER_RESOURCE_MONITOR_VIEW: 'server-resource-monitor:view',
} as const

/** 菜单权限码字面量联合类型；路由 meta.perm 受此约束 */
export type PermCode = (typeof PERM)[keyof typeof PERM]

/**
 * 按钮级权限码（登录返回 data.permissions 平铺数组中的 code）。
 * 全量登记自旧项目已核实映射；页面迁移任务在按钮上经 usePermission().hasPerm 消费，
 * 禁止 as 断言绕过类型检查——后端新增按钮码时先在此登记再引用。
 */
export const PERM_BUTTON = {
  // 调度监控（旧首页可达控制，H01 暂缓期间不接入）
  OVERVIEW_MAP_CHECK: 'overview:map-check',
  OVERVIEW_ORDER_RECORD_CREATE: 'overview:order-record-create',
  OVERVIEW_VEHICLE_OPERATE: 'overview:vehicle-operate',
  OVERVIEW_ORDER_RECORD_CHECK: 'overview:order-record-check',
  OVERVIEW_ORDER_RECORD_OPERATE: 'overview:order-record-operate',
  // 任务管理
  ORDER_RECORD_CREATE: 'order-record:create',
  ORDER_RECORD_CHECK: 'order-record:check',
  ORDER_RECORD_OPERATE: 'order-record:operate',
  // 车辆分组
  VEHICLE_GROUP_ADD: 'vehicle-group:add',
  VEHICLE_GROUP_UPDATE: 'vehicle-group:update',
  VEHICLE_GROUP_DELETE: 'vehicle-group:delete',
  // 车辆列表
  VEHICLE_LIST_ADD: 'vehicle-list:add',
  VEHICLE_LIST_UPDATE: 'vehicle-list:update',
  VEHICLE_LIST_DELETE: 'vehicle-list:delete',
  VEHICLE_LIST_OPERATE: 'vehicle-list:operate',
  VEHICLE_LIST_ENABLE: 'vehicle-list:enable',
  VEHICLE_LIST_BATCH_OPERATE: 'vehicle-list:batch-operate',
  // 载具类型
  CARRIER_ADD: 'carrier:add',
  CARRIER_UPDATE: 'carrier:update',
  CARRIER_DELETE: 'carrier:delete',
  // 节点映射
  NODE_MAPPING_ADD: 'node-mapping:add',
  NODE_MAPPING_UPDATE: 'node-mapping:update',
  NODE_MAPPING_DELETE: 'node-mapping:delete',
  // 告警码管理
  VEHICLE_ALARM_CODE_UPLOAD: 'vehicle-alarm-code:upload',
  VEHICLE_ALARM_CODE_DOWNLOAD: 'vehicle-alarm-code:download',
  VEHICLE_ALARM_CODE_ADD: 'vehicle-alarm-code:add',
  VEHICLE_ALARM_CODE_UPDATE: 'vehicle-alarm-code:update',
  VEHICLE_ALARM_CODE_DELETE: 'vehicle-alarm-code:delete',
  // 地图列表（含地图版本，版本前缀为 map-version）
  MAP_LIST_ADD: 'map-list:add',
  MAP_LIST_UPLOAD_DISPATCHER_MAP: 'map-list:upload-dispatcher-map',
  MAP_LIST_UPLOAD_VEHICLE_MAP: 'map-list:upload-vehicle-map',
  MAP_LIST_UPDATE: 'map-list:update',
  MAP_LIST_DELETE: 'map-list:delete',
  MAP_LIST_VERSION: 'map-list:version',
  MAP_VERSION_UPDATE: 'map-version:update',
  MAP_VERSION_PUBLISH: 'map-version:publish',
  MAP_VERSION_DOWNLOAD: 'map-version:download',
  // 地图编辑（H02 暂缓期间不接入）
  MAP_EDIT_UPDATE: 'map-edit:update',
  // 地图关联
  CROSS_MAP_ADD: 'cross-map:add',
  CROSS_MAP_UPDATE: 'cross-map:update',
  CROSS_MAP_DELETE: 'cross-map:delete',
  // 多地图点边组合
  POINT_EDGE_COMBINATION_ADD: 'point-edge-combination:add',
  POINT_EDGE_COMBINATION_UPDATE: 'point-edge-combination:update',
  POINT_EDGE_COMBINATION_DELETE: 'point-edge-combination:delete',
  // 地图推送记录
  MAP_PUSH_RECORD_RE_PUSH: 'map-push-record:re-push',
  // 调度中心
  DISPATCH_HUB_SAVE: 'dispatch-hub:save',
  DISPATCH_HUB_RESET: 'dispatch-hub:reset',
  // 三方设备：电梯 / 自动门 / 充电桩 / 交通灯 / 风淋门
  DEVICE_ELEVATOR_ADD: 'device:elevator:add',
  DEVICE_ELEVATOR_UPDATE: 'device:elevator:update',
  DEVICE_ELEVATOR_DELETE: 'device:elevator:delete',
  DEVICE_ELEVATOR_OPERATE: 'device:elevator:operate',
  DEVICE_AUTO_DOOR_ADD: 'device:auto-door:add',
  DEVICE_AUTO_DOOR_UPDATE: 'device:auto-door:update',
  DEVICE_AUTO_DOOR_DELETE: 'device:auto-door:delete',
  DEVICE_AUTO_DOOR_OPERATE: 'device:auto-door:operate',
  DEVICE_CHARGE_PILE_ADD: 'device:charge-pile:add',
  DEVICE_CHARGE_PILE_UPDATE: 'device:charge-pile:update',
  DEVICE_CHARGE_PILE_DELETE: 'device:charge-pile:delete',
  DEVICE_CHARGE_PILE_OPERATE: 'device:charge-pile:operate',
  DEVICE_TRAFFIC_LIGHT_ADD: 'device:traffic-light:add',
  DEVICE_TRAFFIC_LIGHT_UPDATE: 'device:traffic-light:update',
  DEVICE_TRAFFIC_LIGHT_DELETE: 'device:traffic-light:delete',
  DEVICE_TRAFFIC_LIGHT_OPERATE: 'device:traffic-light:operate',
  DEVICE_AIR_SHOWER_DOOR_ADD: 'device:air-shower-door:add',
  DEVICE_AIR_SHOWER_DOOR_UPDATE: 'device:air-shower-door:update',
  DEVICE_AIR_SHOWER_DOOR_DELETE: 'device:air-shower-door:delete',
  DEVICE_AIR_SHOWER_DOOR_OPERATE: 'device:air-shower-door:operate',
  // 三方交管
  TRAFFIC_TRIPARTITE_ADD: 'traffic:tripartite:add',
  TRAFFIC_TRIPARTITE_UPDATE: 'traffic:tripartite:update',
  TRAFFIC_TRIPARTITE_DELETE: 'traffic:tripartite:delete',
  TRAFFIC_TRIPARTITE_CHECK: 'traffic:tripartite:check',
  // 任务工艺
  MISSION_FLOW_ADD: 'mission-flow:add',
  MISSION_FLOW_UPDATE: 'mission-flow:update',
  MISSION_FLOW_DELETE: 'mission-flow:delete',
  MISSION_FLOW_COPY: 'mission-flow:copy',
  // 工艺管理
  MISSION_TEMPLATE_CREATE: 'mission-template:create',
  MISSION_TEMPLATE_RESEND: 'mission-template:resend',
  MISSION_TEMPLATE_OPERATE: 'mission-template:operate',
  MISSION_TEMPLATE_SUB_OPERATE: 'mission-template:sub-operate',
  // 避障模板
  OBSTACLE_AVOIDANCE_ADD: 'obstacle-avoidance:add',
  OBSTACLE_AVOIDANCE_UPDATE: 'obstacle-avoidance:update',
  OBSTACLE_AVOIDANCE_DELETE: 'obstacle-avoidance:delete',
  // 车辆动作
  ACTION_VEHICLE_ADD: 'action:vehicle:add',
  ACTION_VEHICLE_UPDATE: 'action:vehicle:update',
  ACTION_VEHICLE_DELETE: 'action:vehicle:delete',
  // 动作分组
  ACTION_GROUP_ADD: 'action-group:add',
  ACTION_GROUP_UPDATE: 'action-group:update',
  ACTION_GROUP_DELETE: 'action-group:delete',
  // 版本管理
  SYSTEM_VERSION_RESTART: 'system:version:restart',
  SYSTEM_VERSION_UPLOAD: 'system:version:upload',
  SYSTEM_VERSION_ROLLBACK: 'system:version:rollback',
  SYSTEM_VERSION_DOWNLOAD: 'system:version:download',
  SYSTEM_VERSION_DELETE: 'system:version:delete',
  // 系统日志
  SYSTEM_LOG_DOWNLOAD: 'system:log:download',
  // 系统设置（品牌图片上传）
  SYSTEM_SETTING_UPLOAD_NAVBAR: 'system:setting:upload-navbar',
  SYSTEM_SETTING_UPLOAD_LOGIN_BG: 'system:setting:upload-login-bg',
  SYSTEM_SETTING_UPLOAD_TAB_ICON: 'system:setting:upload-tab-icon',
  // 软件信息
  SYSTEM_SOFTWARE_ACTIVATE: 'system:software:activate',
  // 数据库备份
  SYSTEM_DATABASE_BACKUP_DOWNLOAD: 'system:database-backup:download',
  // 用户管理（后端码前缀 auth:user:*）
  AUTH_USER_ADD: 'auth:user:add',
  AUTH_USER_RESET_PASSWORD: 'auth:user:resetPassword',
  AUTH_USER_ASSIGN_ROLE: 'auth:user:assign-role',
  AUTH_USER_DELETE: 'auth:user:delete',
  // 角色管理（后端码前缀 auth:role:*）
  AUTH_ROLE_ADD: 'auth:role:add',
  AUTH_ROLE_UPDATE: 'auth:role:update',
  AUTH_ROLE_ASSIGN_PERMISSION: 'auth:role:assign-permission',
  AUTH_ROLE_DELETE: 'auth:role:delete',
} as const

/** 按钮权限码字面量联合类型；hasPerm 参数受此约束 */
export type PermButtonCode = (typeof PERM_BUTTON)[keyof typeof PERM_BUTTON]

/**
 * root 专属菜单码：仅超管账号可见可访问。
 * 非 root 用户即使后端把这些码分配给其角色也一律拦截（旧 access.ts 同语义）——
 * 敏感模块（权限管理：用户/角色管理）的前端可见性不受后端分配影响，后端仍是最终鉴权方。
 */
export const ROOT_ONLY_CODES: ReadonlySet<PermCode> = new Set<PermCode>([
  PERM.AUTH_MANAGE,
  PERM.AUTH_USER_VIEW,
  PERM.AUTH_ROLE_VIEW,
])
