/**
 * @description 菜单权限码常量与全量菜单结构
 *
 * 集中维护后端 permissionsTree 中 type=MENU 的 code，
 * 与 .umirc.ts 路由层级、后端 MENU 节点一一对齐。
 *
 * 三大用途：
 *   1. access.ts 路由 access 判定 —— 显式枚举 PERM 生成 access map（§6.3）
 *   2. MENU_TREE 派生 MENU_ROUTE_ORDER —— getFirstAccessiblePath 的有序遍历依据（§6.8.1 / D16）
 *   3. expandWithAncestors 祖先填充的结构依据（D15）
 *
 * 维护说明：本结构是 .umirc.ts 菜单层级的镜像，菜单低频变更；
 *           新增/调整菜单时需同步更新此处与 .umirc.ts。
 */

/**
 * 菜单权限码常量
 * 与后端 permissionsTree 中 type=MENU 的 code 一一对应
 * 路由 access 字段与 useAccess 判定统一引用此处，避免魔法字符串
 *
 * 说明：仅收录前端有对应路由的 code（§9.1 三个无路由的 gap 菜单不收录）
 */
export const PERM = {
  // 顶级分组（后端 path 为空，仅作菜单层级容器）
  VEHICLE_MANAGE: "vehicle:manage",
  MAP_MANAGE: "map:manage",
  THIRD_PARTY_MANAGE: "third-party:manage",
  THIRD_PARTY_DEVICE_MANAGE: "third-party-device:manage",
  PROCESS_MANAGE: "process:manage",
  ACTION_MANAGE: "action:manage",
  SYSTEM_MANAGE: "system:manage",
  STATISTICS_MANAGE: "statistics:manage",
  // G3 对齐（2026-06-30）：后端权限管理顶级码为 auth:manage，前端已从 access:manage 对齐
  AUTH_MANAGE: "auth:manage",

  // 可访问菜单（前端有实际路由）
  OVERVIEW_VIEW: "overview:view",
  ORDER_RECORD_VIEW: "order-record:view",
  VEHICLE_GROUP_VIEW: "vehicle-group:view",
  VEHICLE_LIST_VIEW: "vehicle-list:view",
  CARRIER_VIEW: "carrier:view",
  /*
   * AGV节点映射的菜单权限（2026-08-19 后端权限码下发，按 SPEC_node_mapping §6 接入）。
   */
  NODE_MAPPING_VIEW: "node-mapping:view",
  VEHICLE_ALARM_CODE_VIEW: "vehicle-alarm-code:view",
  MAP_LIST_VIEW: "map-list:view",
  MAP_EDIT_VIEW: "map-edit:view",
  CROSS_MAP_VIEW: "cross-map:view",
  POINT_EDGE_COMBINATION_VIEW: "point-edge-combination:view",
  MAP_PUSH_RECORD_VIEW: "map-push-record:view",
  DISPATCH_HUB_VIEW: "dispatch-hub:view",
  DEVICE_ELEVATOR_VIEW: "device:elevator:view",
  DEVICE_AUTO_DOOR_VIEW: "device:auto-door:view",
  DEVICE_CHARGE_PILE_VIEW: "device:charge-pile:view",
  DEVICE_TRAFFIC_LIGHT_VIEW: "device:traffic-light:view",
  DEVICE_AIR_SHOWER_DOOR_VIEW: "device:air-shower-door:view",
  TRAFFIC_TRIPARTITE_VIEW: "traffic:tripartite:view",
  MISSION_FLOW_VIEW: "mission-flow:view",
  MISSION_TEMPLATE_VIEW: "mission-template:view",
  OBSTACLE_AVOIDANCE_VIEW: "obstacle-avoidance:view",
  ACTION_VEHICLE_VIEW: "action:vehicle:view",
  ACTION_GROUP_VIEW: "action-group:view",
  SYSTEM_VERSION_VIEW: "system:version:view",
  SYSTEM_LOG_VIEW: "system:log:view",
  SYSTEM_SETTING_VIEW: "system:setting:view",
  SYSTEM_OPERATION_LOG_VIEW: "system:operation-log:view",
  SYSTEM_SOFTWARE_VIEW: "system:software:view",
  SYSTEM_DATABASE_BACKUP_VIEW: "system:database-backup:view",
  // G3 对齐（2026-06-30）：后端用户/角色管理码为 auth:* 前缀，前端已从 system:* 对齐，常量名同步改为 AUTH_*
  AUTH_USER_VIEW: "auth:user:view",
  AUTH_ROLE_VIEW: "auth:role:view",
  STATISTICS_ORDER_VIEW: "statistics:order:view",
  RECORD_PLAYBACK_VIEW: "record-playback:view",
  /*
   * 码对齐（2026-08-19）：后端「数据统计」下运行看板/报表类菜单码为无前缀形式
   * （dashboard-realtime:view 等），前端已从 statistics:* 对齐，
   * 常量名同步去掉 STATISTICS_ 前缀（同 G3 对齐先例）。
   * 运行看板三个独立页面的菜单权限（原 statistics:dashboard:view 单码拆分而来，
   * 对应原 Dashboard Tabs 拆分后的独立路由页面，值须与后端权限树 MENU 节点一致）。
   */
  DASHBOARD_REALTIME_VIEW: "dashboard-realtime:view",
  DASHBOARD_TASK_VIEW: "dashboard-task:view",
  DASHBOARD_FAULT_VIEW: "dashboard-fault:view",
  /*
   * AGV 各状态总时长统计报表的菜单权限（值须与后端权限树 MENU 节点一致）。
   */
  VEHICLE_STATUS_VIEW: "vehicle-status:view",
  /*
   * 服务器实时资源监控大屏的菜单权限（值须与后端权限树 MENU 节点一致）。
   * 页面为全屏大屏形态（固定定位覆盖布局），菜单项仍走常规嵌套路由注册。
   */
  SERVER_RESOURCE_MONITOR_VIEW: "server-resource-monitor:view",
} as const;

/** 权限码字面量类型（PERM 取值的联合类型） */
export type PermCode = (typeof PERM)[keyof typeof PERM];

/**
 * 按钮权限码常量（全量）
 * 与后端 data.permissions / permissionsTree 中 type=BUTTON 的 code 一一对应
 * useAccess.hasPerm 参数受其派生的 PermButtonCode 联合类型约束 (B11/B12)
 *
 * 维护说明：后端新增按钮时须同步追加此处（dev 一致性告警 §10 会提示）；
 *           前缀命名取 code 第一段，多词用下划线分隔大写。
 *
 * 规范（B18）：禁止用 as PermButtonCode 断言绕过类型检查；
 *             后端新增按钮码时，必须先追加到本常量再引用。
 */
export const PERM_BUTTON = {
  // 调度监控
  OVERVIEW_MAP_CHECK: "overview:map-check",
  OVERVIEW_ORDER_RECORD_CREATE: "overview:order-record-create",
  OVERVIEW_VEHICLE_OPERATE: "overview:vehicle-operate",
  OVERVIEW_ORDER_RECORD_CHECK: "overview:order-record-check",
  OVERVIEW_ORDER_RECORD_OPERATE: "overview:order-record-operate",
  // 任务管理
  ORDER_RECORD_CREATE: "order-record:create",
  ORDER_RECORD_CHECK: "order-record:check",
  ORDER_RECORD_OPERATE: "order-record:operate",
  // 车辆分组
  VEHICLE_GROUP_ADD: "vehicle-group:add",
  VEHICLE_GROUP_UPDATE: "vehicle-group:update",
  VEHICLE_GROUP_DELETE: "vehicle-group:delete",
  // 车辆列表
  VEHICLE_LIST_ADD: "vehicle-list:add",
  VEHICLE_LIST_UPDATE: "vehicle-list:update",
  VEHICLE_LIST_DELETE: "vehicle-list:delete",
  VEHICLE_LIST_OPERATE: "vehicle-list:operate",
  VEHICLE_LIST_ENABLE: "vehicle-list:enable",
  VEHICLE_LIST_BATCH_OPERATE: "vehicle-list:batch-operate",
  // 载具类型
  CARRIER_ADD: "carrier:add",
  CARRIER_UPDATE: "carrier:update",
  CARRIER_DELETE: "carrier:delete",
  // 节点映射
  NODE_MAPPING_ADD: "node-mapping:add",
  NODE_MAPPING_UPDATE: "node-mapping:update",
  NODE_MAPPING_DELETE: "node-mapping:delete",
  // 车辆告警码
  VEHICLE_ALARM_CODE_UPLOAD: "vehicle-alarm-code:upload",
  VEHICLE_ALARM_CODE_DOWNLOAD: "vehicle-alarm-code:download",
  VEHICLE_ALARM_CODE_ADD: "vehicle-alarm-code:add",
  VEHICLE_ALARM_CODE_UPDATE: "vehicle-alarm-code:update",
  VEHICLE_ALARM_CODE_DELETE: "vehicle-alarm-code:delete",
  // 地图列表
  MAP_LIST_ADD: "map-list:add",
  MAP_LIST_UPLOAD_DISPATCHER_MAP: "map-list:upload-dispatcher-map",
  MAP_LIST_UPLOAD_VEHICLE_MAP: "map-list:upload-vehicle-map",
  MAP_LIST_UPDATE: "map-list:update",
  MAP_LIST_DELETE: "map-list:delete",
  MAP_LIST_VERSION: "map-list:version",
  // 地图版本（注意前缀为 map-version，独立于 map-list）
  MAP_VERSION_UPDATE: "map-version:update",
  MAP_VERSION_PUBLISH: "map-version:publish",
  MAP_VERSION_DOWNLOAD: "map-version:download",
  // 地图编辑
  MAP_EDIT_UPDATE: "map-edit:update",
  // 地图关联
  CROSS_MAP_ADD: "cross-map:add",
  CROSS_MAP_UPDATE: "cross-map:update",
  CROSS_MAP_DELETE: "cross-map:delete",
  // 多地图点边组合
  POINT_EDGE_COMBINATION_ADD: "point-edge-combination:add",
  POINT_EDGE_COMBINATION_UPDATE: "point-edge-combination:update",
  POINT_EDGE_COMBINATION_DELETE: "point-edge-combination:delete",
  // 地图推送记录
  MAP_PUSH_RECORD_RE_PUSH: "map-push-record:re-push",
  // 调度中心
  DISPATCH_HUB_SAVE: "dispatch-hub:save",
  DISPATCH_HUB_RESET: "dispatch-hub:reset",
  // 三方设备（电梯/自动门/充电桩/交通灯/风淋门，各 add/update/delete/operate）
  DEVICE_ELEVATOR_ADD: "device:elevator:add",
  DEVICE_ELEVATOR_UPDATE: "device:elevator:update",
  DEVICE_ELEVATOR_DELETE: "device:elevator:delete",
  DEVICE_ELEVATOR_OPERATE: "device:elevator:operate",
  DEVICE_AUTO_DOOR_ADD: "device:auto-door:add",
  DEVICE_AUTO_DOOR_UPDATE: "device:auto-door:update",
  DEVICE_AUTO_DOOR_DELETE: "device:auto-door:delete",
  DEVICE_AUTO_DOOR_OPERATE: "device:auto-door:operate",
  DEVICE_CHARGE_PILE_ADD: "device:charge-pile:add",
  DEVICE_CHARGE_PILE_UPDATE: "device:charge-pile:update",
  DEVICE_CHARGE_PILE_DELETE: "device:charge-pile:delete",
  DEVICE_CHARGE_PILE_OPERATE: "device:charge-pile:operate",
  DEVICE_TRAFFIC_LIGHT_ADD: "device:traffic-light:add",
  DEVICE_TRAFFIC_LIGHT_UPDATE: "device:traffic-light:update",
  DEVICE_TRAFFIC_LIGHT_DELETE: "device:traffic-light:delete",
  DEVICE_TRAFFIC_LIGHT_OPERATE: "device:traffic-light:operate",
  DEVICE_AIR_SHOWER_DOOR_ADD: "device:air-shower-door:add",
  DEVICE_AIR_SHOWER_DOOR_UPDATE: "device:air-shower-door:update",
  DEVICE_AIR_SHOWER_DOOR_DELETE: "device:air-shower-door:delete",
  DEVICE_AIR_SHOWER_DOOR_OPERATE: "device:air-shower-door:operate",
  // 三方交管
  TRAFFIC_TRIPARTITE_ADD: "traffic:tripartite:add",
  TRAFFIC_TRIPARTITE_UPDATE: "traffic:tripartite:update",
  TRAFFIC_TRIPARTITE_DELETE: "traffic:tripartite:delete",
  TRAFFIC_TRIPARTITE_CHECK: "traffic:tripartite:check",
  // 任务工艺
  MISSION_FLOW_ADD: "mission-flow:add",
  MISSION_FLOW_UPDATE: "mission-flow:update",
  MISSION_FLOW_DELETE: "mission-flow:delete",
  MISSION_FLOW_COPY: "mission-flow:copy",
  // 工艺管理
  MISSION_TEMPLATE_CREATE: "mission-template:create",
  MISSION_TEMPLATE_RESEND: "mission-template:resend",
  MISSION_TEMPLATE_OPERATE: "mission-template:operate",
  MISSION_TEMPLATE_SUB_OPERATE: "mission-template:sub-operate",
  // 避障模板
  OBSTACLE_AVOIDANCE_ADD: "obstacle-avoidance:add",
  OBSTACLE_AVOIDANCE_UPDATE: "obstacle-avoidance:update",
  OBSTACLE_AVOIDANCE_DELETE: "obstacle-avoidance:delete",
  // 车辆动作
  ACTION_VEHICLE_ADD: "action:vehicle:add",
  ACTION_VEHICLE_UPDATE: "action:vehicle:update",
  ACTION_VEHICLE_DELETE: "action:vehicle:delete",
  // 动作分组
  ACTION_GROUP_ADD: "action-group:add",
  ACTION_GROUP_UPDATE: "action-group:update",
  ACTION_GROUP_DELETE: "action-group:delete",
  // 版本管理
  SYSTEM_VERSION_RESTART: "system:version:restart",
  SYSTEM_VERSION_UPLOAD: "system:version:upload",
  SYSTEM_VERSION_ROLLBACK: "system:version:rollback",
  SYSTEM_VERSION_DOWNLOAD: "system:version:download",
  SYSTEM_VERSION_DELETE: "system:version:delete",
  // 系统日志
  SYSTEM_LOG_DOWNLOAD: "system:log:download",
  // 系统设置
  SYSTEM_SETTING_UPLOAD_NAVBAR: "system:setting:upload-navbar",
  SYSTEM_SETTING_UPLOAD_LOGIN_BG: "system:setting:upload-login-bg",
  SYSTEM_SETTING_UPLOAD_TAB_ICON: "system:setting:upload-tab-icon",
  // 软件信息
  SYSTEM_SOFTWARE_ACTIVATE: "system:software:activate",
  // 数据库备份
  SYSTEM_DATABASE_BACKUP_DOWNLOAD: "system:database-backup:download",
  // 用户管理（后端为 auth:user:*，注意与菜单级 system:user:view 的前缀差异 G3）
  AUTH_USER_ADD: "auth:user:add",
  AUTH_USER_RESET_PASSWORD: "auth:user:resetPassword",
  AUTH_USER_ASSIGN_ROLE: "auth:user:assign-role",
  AUTH_USER_DELETE: "auth:user:delete",
  // 角色管理（后端为 auth:role:*）
  AUTH_ROLE_ADD: "auth:role:add",
  AUTH_ROLE_UPDATE: "auth:role:update",
  AUTH_ROLE_ASSIGN_PERMISSION: "auth:role:assign-permission",
  AUTH_ROLE_DELETE: "auth:role:delete",
} as const;

/** 按钮权限码字面量联合类型（hasPerm 参数约束用，B12） */
export type PermButtonCode = (typeof PERM_BUTTON)[keyof typeof PERM_BUTTON];

/**
 * root 专属权限码
 * 命中的菜单/路由仅对 username === "root" 可见可访问；
 * 非 root 用户一律拦截，即使后端将这些 code 分配给了某个非 root 角色也不可见
 *
 * 用途：敏感模块（当前为「权限管理」：用户管理 / 角色管理）限定仅超管可见
 * 生效位置：src/access.ts（菜单可见性 + URL 拦截）、src/utils/permission.ts（登录跳转跳过）
 */
export const ROOT_ONLY_CODES: ReadonlySet<string> = new Set<string>([
  PERM.AUTH_MANAGE,
  PERM.AUTH_USER_VIEW,
  PERM.AUTH_ROLE_VIEW,
]);

/**
 * 全量菜单权限结构节点
 * code  : 权限码，与 PERM 常量一致
 * path  : 前端路由路径；分组节点（层级容器）为空字符串 ""
 *         —— path 为空的节点不会进入 MENU_ROUTE_ORDER，避免首菜单跳转到分组壳页
 */
export interface MenuPermNode {
  code: string;
  path: string;
  children?: MenuPermNode[];
}

/**
 * 全量菜单权限结构（与 .umirc.ts 路由层级、后端 permissionsTree 的 MENU 节点一一对齐）
 *
 * 注意：分组节点（如车辆管理 vehicle:manage）的 path 设为 ""，
 *       这样 MENU_ROUTE_ORDER 派生时只会收录「有实际页面」的叶子菜单，
 *       getFirstAccessiblePath 不会把用户跳到一个空的分组壳页。
 *       分组节点本身仍参与 expandWithAncestors 的祖先填充（只用 code + 层级）。
 */
export const MENU_TREE: MenuPermNode[] = [
  { code: PERM.OVERVIEW_VIEW, path: "/over-look" },
  { code: PERM.ORDER_RECORD_VIEW, path: "/order-record" },
  {
    code: PERM.VEHICLE_MANAGE,
    path: "",
    children: [
      { code: PERM.VEHICLE_GROUP_VIEW, path: "/vehicle-deploy/vehicle-group" },
      { code: PERM.VEHICLE_LIST_VIEW, path: "/vehicle-deploy/vehicle-diplay" },
      { code: PERM.CARRIER_VIEW, path: "/vehicle-deploy/vehicle-type" },
      { code: PERM.NODE_MAPPING_VIEW, path: "/vehicle-deploy/node-mapping" },
      { code: PERM.VEHICLE_ALARM_CODE_VIEW, path: "/vehicle-deploy/alarm-code-management" },
    ],
  },
  {
    code: PERM.MAP_MANAGE,
    path: "",
    children: [
      { code: PERM.MAP_LIST_VIEW, path: "/map-through/map-list" },
      { code: PERM.MAP_EDIT_VIEW, path: "/map-through/map-nest-modify" },
      { code: PERM.CROSS_MAP_VIEW, path: "/map-through/cross-maps" },
      { code: PERM.POINT_EDGE_COMBINATION_VIEW, path: "/map-through/point-edge-combination" },
      { code: PERM.MAP_PUSH_RECORD_VIEW, path: "/map-through/map-push-records" },
    ],
  },
  { code: PERM.DISPATCH_HUB_VIEW, path: "/dispatch-hub" },
  {
    code: PERM.THIRD_PARTY_MANAGE,
    path: "",
    children: [
      {
        code: PERM.THIRD_PARTY_DEVICE_MANAGE,
        path: "",
        children: [
          { code: PERM.DEVICE_ELEVATOR_VIEW, path: "/tri-resource/tri-device/elevator" },
          { code: PERM.DEVICE_AUTO_DOOR_VIEW, path: "/tri-resource/tri-device/auto-door" },
          { code: PERM.DEVICE_CHARGE_PILE_VIEW, path: "/tri-resource/tri-device/charge-pie" },
          { code: PERM.DEVICE_TRAFFIC_LIGHT_VIEW, path: "/tri-resource/tri-device/traffic-lights" },
          { code: PERM.DEVICE_AIR_SHOWER_DOOR_VIEW, path: "/tri-resource/tri-device/air-shower-door" },
        ],
      },
      { code: PERM.TRAFFIC_TRIPARTITE_VIEW, path: "/tri-resource/tri-traffic" },
    ],
  },
  {
    code: PERM.PROCESS_MANAGE,
    path: "",
    children: [
      { code: PERM.MISSION_FLOW_VIEW, path: "/mission-cluster/mission-create" },
      { code: PERM.MISSION_TEMPLATE_VIEW, path: "/mission-cluster/mission-flow" },
      { code: PERM.OBSTACLE_AVOIDANCE_VIEW, path: "/mission-cluster/obstacle-avoidance" },
      {
        code: PERM.ACTION_MANAGE,
        path: "",
        children: [
          { code: PERM.ACTION_VEHICLE_VIEW, path: "/mission-cluster/action-control/agv-action" },
          { code: PERM.ACTION_GROUP_VIEW, path: "/mission-cluster/action-control/agv-action-group" },
        ],
      },
    ],
  },
  {
    code: PERM.SYSTEM_MANAGE,
    path: "",
    children: [
      { code: PERM.SYSTEM_VERSION_VIEW, path: "/system-involve/version-control" },
      { code: PERM.SYSTEM_LOG_VIEW, path: "/system-involve/system-log" },
      { code: PERM.SYSTEM_SETTING_VIEW, path: "/system-involve/system-setting" },
      { code: PERM.SYSTEM_OPERATION_LOG_VIEW, path: "/system-involve/operation-log" },
      { code: PERM.SYSTEM_SOFTWARE_VIEW, path: "/system-involve/software-information" },
      { code: PERM.SYSTEM_DATABASE_BACKUP_VIEW, path: "/system-involve/database-backup" },
    ],
  },
  {
    code: PERM.AUTH_MANAGE,
    path: "",
    children: [
      { code: PERM.AUTH_USER_VIEW, path: "/access-management/user-management" },
      { code: PERM.AUTH_ROLE_VIEW, path: "/access-management/role-management" },
    ],
  },
  {
    code: PERM.STATISTICS_MANAGE,
    path: "",
    children: [
      { code: PERM.STATISTICS_ORDER_VIEW, path: "/analyze-visual/order-statistics" },
      { code: PERM.RECORD_PLAYBACK_VIEW, path: "/analyze-visual/record-playback" },
      /*
       * 运行看板拆分为三个独立路由页面（原 /analyze-visual/dashboard 单码已废弃）。
       * 各页面扁平挂在「数据统计」下，各自独立菜单权限。
       */
      { code: PERM.DASHBOARD_REALTIME_VIEW, path: "/analyze-visual/dashboard-realtime" },
      { code: PERM.DASHBOARD_TASK_VIEW, path: "/analyze-visual/dashboard-task" },
      { code: PERM.DASHBOARD_FAULT_VIEW, path: "/analyze-visual/dashboard-fault" },
      { code: PERM.VEHICLE_STATUS_VIEW, path: "/analyze-visual/vehicle-status" },
      /* path 取菜单别名（点击后重定向到全屏路由），保持与 .umirc.ts 菜单层级一致 */
      { code: PERM.SERVER_RESOURCE_MONITOR_VIEW, path: "/analyze-visual/server-resource" },
    ],
  },
];
