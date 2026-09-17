# 迁移基线（T00.1 交付）

> 创建：2026-09-17（T00 运行 run-20260917-121624-7468）。
> 本文件是迁移基线台账：源路由清点、API 契约规模、依赖版本、检查故障与排除的历史实现。
> 任务分派见 `TASKS.md`；串行队列见 `RUN_STATE.json`；共享契约见 `contracts.md`；缺口见 `gaps.md`。

## 1. 源与目标

| 项 | 值 | 核验时间 |
| --- | --- | --- |
| 旧仓库 | `C:\code\dd`（Umi + Ant Design 5） | 2026-09-17 |
| 旧路由真相源 | `C:\code\dd\.umirc.ts`（hash 路由） | 2026-09-17 读取 |
| 目标仓库 | `C:\code\apex-admin-web`（React 19 + Vite 8，分支 `apple-rxx`，基线 `b09d285`） | 2026-09-17 |
| 新路由真相源 | `src/router/definitions.tsx` | 2026-09-17 读取 |
| OpenAPI 文件 | `C:\yangwenhua\ApexTableReact\default_OpenAPI.json`（526,857 字节） | 2026-09-17 |
| OpenAPI SHA-256 | `A82E9B5F6EF5E564DEEE16E4E74713B28FCCB35CD0A651E3631CFD9D63D49C7C` | 2026-09-17 与规格一致 |
| OpenAPI 规模 | 238 HTTP operation / 408 schema（脚本统计，与规格一致） | 2026-09-17 |
| endpoint 明细 | `docs/migration/openapi-inventory.md` | 2026-09-17 生成 |
| 代理目标 | 旧 `/fms`、`/rcsFlow` → `http://10.11.2.67:8888`（`/rcsFlow` 前缀用途待页面任务核实，未见 OpenAPI 声明） | 2026-09-17 |

## 2. 45 个旧叶子入口 → 目标路由映射

约定：`PERM.*` 为旧系统 `src/constants/permission` 权限码原名（目标项目须以后端菜单树/按钮码为准，见规格第 5 章）。「无 access」表示旧路由未声明权限字段，处理策略见第 5 节。

| # | 旧路径 | 旧组件（相对 `src/pages`） | 旧权限 | 目标路由 id / 路径 | 任务 |
| --- | --- | --- | --- | --- | --- |
| 1 | `/login` | `Login` | —（layout:false） | `auth-login` `/login` | P01 |
| 2 | `/authorize-ingress` | `AuthorizeIngress` | —（layout:false） | `authorize-ingress` `/authorize-ingress` | P02 |
| 3 | `/over-look` | `Overlook` | `OVERVIEW_VIEW` | `over-look` `/over-look` | H01 暂缓 |
| 4 | `/order-record` | `OrderRecord` | `ORDER_RECORD_VIEW` | `order-record` `/order-record` | P03 |
| 5 | `/vehicle-deploy/vehicle-group` | `VehicleDeploy/VehicleGroup` | `VEHICLE_GROUP_VIEW` | `vehicle-deploy-vehicle-group` | P04 |
| 6 | `/vehicle-deploy/vehicle-diplay` | `VehicleDeploy/VehicleDisplay` | `VEHICLE_LIST_VIEW` | `vehicle-deploy-vehicle-display`（保留 `vehicle-diplay` 拼写） | P05 |
| 7 | `/vehicle-deploy/vehicle-type` | `VehicleDeploy/VehicleType` | **无 access** | `vehicle-deploy-vehicle-type` | P06 |
| 8 | `/vehicle-deploy/node-mapping` | `VehicleDeploy/NodeMapping` | `NODE_MAPPING_VIEW` | `vehicle-deploy-node-mapping` | P07 |
| 9 | `/vehicle-deploy/alarm-code-management` | `SystemInvolve/AlarmCodeManagement` | `VEHICLE_ALARM_CODE_VIEW` | `vehicle-deploy-alarm-code` | P08 |
| 10 | `/map-through/map-list` | `MapThrough/MapList` | `MAP_LIST_VIEW` | `map-through-map-list` | P09 |
| 11 | `/map-through/map-nest-modify` | `MapThrough/MapNestModify` | `MAP_EDIT_VIEW` | `map-through-map-nest-modify` | H02 暂缓 |
| 12 | `/map-through/cross-maps` | `MapThrough/CrossMaps` | `CROSS_MAP_VIEW` | `map-through-cross-maps` | P10 |
| 13 | `/map-through/point-edge-combination` | `MapThrough/PointEdgeCombination` | `POINT_EDGE_COMBINATION_VIEW` | `map-through-point-edge-combination` | P11 |
| 14 | `/map-through/map-push-records` | `MapThrough/MapPushNotificationRecords` | `MAP_PUSH_RECORD_VIEW` | `map-through-map-push-records` | P12 |
| 15 | `/dispatch-hub` | `DispatchHub` | `DISPATCH_HUB_VIEW` | `dispatch-hub` `/dispatch-hub` | P13 |
| 16 | `/tri-resource/tri-device/elevator` | `TriDevice/Elevator_back` | `DEVICE_ELEVATOR_VIEW` | `tri-resource-tri-device-elevator` | P14 |
| 17 | `/tri-resource/tri-device/auto-door` | `TriDevice/AutoDoor_back` | `DEVICE_AUTO_DOOR_VIEW` | `tri-resource-tri-device-auto-door` | P15 |
| 18 | `/tri-resource/tri-device/charge-pie` | `TriDevice/ChargePile/ModbusChargePile` | `DEVICE_CHARGE_PILE_VIEW` | `tri-resource-tri-device-charge-pile`（保留 `charge-pie` 拼写） | P16 |
| 19 | `/tri-resource/tri-device/traffic-lights` | `TriResource/TrafficLights` | `DEVICE_TRAFFIC_LIGHT_VIEW` | `tri-resource-tri-device-traffic-lights` | P17 |
| 20 | `/tri-resource/tri-device/air-shower-door` | `TriDevice/AirShowerDoor_back` | `DEVICE_AIR_SHOWER_DOOR_VIEW` | `tri-resource-tri-device-air-shower-door` | P18 |
| 21 | `/tri-resource/tri-traffic` | `TriTraffic` | `TRAFFIC_TRIPARTITE_VIEW` | `tri-resource-tri-traffic` | P19 |
| 22 | `/mission-cluster/mission-create` | `MissionCluster/MissionCreate` | `MISSION_FLOW_VIEW` | `mission-cluster-mission-create` | P20 |
| 23 | `/mission-cluster/mission-flow` | `MissionCluster/MissionFlow` | `MISSION_TEMPLATE_VIEW` | `mission-cluster-mission-flow` | P21 |
| 24 | `/mission-cluster/obstacle-avoidance` | `ObstacleAvoidance` | `OBSTACLE_AVOIDANCE_VIEW` | `mission-cluster-obstacle-avoidance` | P22 |
| 25 | `/mission-cluster/action-control/agv-action` | `ActionControl/AGVAction` | `ACTION_VEHICLE_VIEW` | `mission-cluster-action-control-agv-action` | P23 |
| 26 | `/mission-cluster/action-control/agv-action-group` | `ActionControl/AGVActionGroup` | `ACTION_GROUP_VIEW` | `mission-cluster-action-control-agv-action-group` | P24 |
| 27 | `/system-involve/version-control` | `SystemInvolve/VersionControl` | `SYSTEM_VERSION_VIEW` | `system-involve-version-control` | P25 |
| 28 | `/system-involve/system-log` | `SystemInvolve/SystemLog` | `SYSTEM_LOG_VIEW` | `system-involve-system-log` | P26 |
| 29 | `/system-involve/system-setting` | `SystemInvolve/SystemSetting` | `SYSTEM_SETTING_VIEW` | `system-involve-system-setting` | P27 |
| 30 | `/system-involve/operation-log` | `SystemInvolve/OperationLog` | `SYSTEM_OPERATION_LOG_VIEW` | `system-involve-operation-log` | P28 |
| 31 | `/system-involve/software-information` | `SystemInvolve/SoftwareInformation` | `SYSTEM_SOFTWARE_VIEW` | `system-involve-software-information` | P29 |
| 32 | `/system-involve/database-backup` | `SystemInvolve/DatabaseBackupManagement` | **无 access** | `system-involve-database-backup` | P30 |
| 33 | `/access-management/user-management` | `AccessManagement/UserManagement` | `AUTH_USER_VIEW` | `access-management-user-management` | P31 |
| 34 | `/access-management/role-management` | `AccessManagement/RoleManagement` | `AUTH_ROLE_VIEW` | `access-management-role-management` | P32 |
| 35 | `/analyze-visual/order-statistics` | `AnalyzeVisual/OrderStatistics` | `STATISTICS_ORDER_VIEW` | `analyze-visual-order-statistics` | P33 |
| 36 | `/analyze-visual/record-playback` | `RecordPlayback` | `RECORD_PLAYBACK_VIEW` | `analyze-visual-record-playback` | H03 暂缓 |
| 37 | `/analyze-visual/dashboard-realtime` | `AnalyzeVisual/RealtimeDashboard` | `DASHBOARD_REALTIME_VIEW` | `analyze-visual-dashboard-realtime` → P34 合并入 `/dashboard` | P34 |
| 38 | `/analyze-visual/dashboard-task` | `AnalyzeVisual/TaskStatisticsReport` | `DASHBOARD_TASK_VIEW` | `analyze-visual-dashboard-task` | P35 |
| 39 | `/analyze-visual/dashboard-fault` | `AnalyzeVisual/FaultAlert` | `DASHBOARD_FAULT_VIEW` | `analyze-visual-dashboard-fault` | P36 |
| 40 | `/analyze-visual/vehicle-status` | `AnalyzeVisual/VehicleStatus` | `VEHICLE_STATUS_VIEW` | `analyze-visual-vehicle-status` | P37 |
| 41 | `/analyze-visual/server-resource` | redirect → `/analyze-visual/server-resource-monitor` | `SERVER_RESOURCE_MONITOR_VIEW` | `analyze-visual-server-resource`（别名 redirect，已在目标树） | P40 |
| 42 | `/analyze-visual/server-resource-monitor` | `AnalyzeVisual/ServerRealtimeResources`（layout:false 全屏） | `SERVER_RESOURCE_MONITOR_VIEW` | `server-resource-monitor`（顶层 standalone） | P40 |
| 43 | `/order-info` | `OrderInfo`（layout:false） | `ORDER_RECORD_VIEW`（复用任务管理） | `order-info` `/order-info` | P38 |
| 44 | `/vehicle-info` | `VehicleInfo`（layout:false） | `VEHICLE_LIST_VIEW`（复用车辆列表） | `vehicle-info` `/vehicle-info` | P39 |
| 45 | `/no-permission` | `UnAccess`（layout:false） | — | `no-permission` `/no-permission` | P41 |
| — | `/*` | `@/pages/NotFound` | — | `root-not-found`（树内 `*`）+ `error-404` `/404` | P42 |

计数：42 个迁移/合并入口（P01–P42，其中 P40 对应 2 行别名+全屏）+ 3 个暂缓入口（H01–H03）= 45 个组件叶子；`/analyze-visual/server-resource` 为 redirect 别名，不计组件叶子。

### 目录/重定向结构

- 旧目录路由（`/vehicle-deploy`、`/map-through`、`/tri-resource`、`/mission-cluster`、`/system-involve`、`/access-management`、`/analyze-visual`）在目标树中表达为目录节点 + `index: true` 重定向到首个子页，与旧「点击目录进入第一个子页」行为对应。
- 旧根 `/` redirect `/login`；目标 `root-index` 目前无 redirect、无 loadPage（空锚点）——T00.4 需按登录落点规则（P34 合并首页优先）重写该落点。
- 服务器资源菜单别名 redirect 已在目标树保留（`analyze-visual-server-resource` → `server-resource-monitor`）。

## 3. 目标项目已有页面入口现状

目标树已包含全部 45 个旧叶子的路由节点（`loadPage` 已指向 `src/pages/...` 具名路径）。模板遗留与调度业务现状：

- `src/pages/dashboard/Dashboard`：模板仪表盘，配 `dashboard.service.ts` + **`dashboard.mock.ts`（mock，P34 清理）**；`affixTab` 常驻首页。
- `src/pages/order-record/OrderRecord`：存在实现，使用 Ant Design Table（待 P03 替换 Apex）；`order-record` 服务含 **`order.mock.ts`（mock，P03 清理）**。
- 其余业务页多为 `PagePlaceholder` 占位（逐页任务复核）。
- `src/services/auth/auth.service.ts`：**临时直通登录**——任意账号密码放行并生成本地 `super_admin` 会话；`loadSession()` 调用虚构 `/users/me`；`logout()` 调用 `/auth/logout`。均属 T00.3 改造范围（G01/G02）。
- 模板公共入口：`/profile`（P43 收口）、`/500`（`error-500`）。
- `src/i18n`：`SUPPORTED_LANGUAGES = ['zh-CN','en-US']` 两语言；`locales/` 仅 `en-US` 目录。五语言扩展是 T00.8。

## 4. API 域分布（与任务接口族对齐）

| OpenAPI 二级前缀 | operation 数 | 对应任务接口族 |
| --- | --- | --- |
| `/fms/v1/dispatcher/*` | 123 | orderRecord、orderTask、orderTemplate、orderFlow、vehicle、vehicleGroup、carrier、agvNodeMapping、vehicleAlarmCode、map、mapVersion、crossMap、systemNodeEdgeGroup、mapPushRecord、taskConfig、tripartiteTraffic 之外的调度主体、dashboard/board、vehicle/getSimpleVehicles、getVehicleState 等 |
| `/fms/v1/device/*` | 48 | elevator、autoDoor、chargePile、trafficLight、airShowerDoor（含驱动/状态/控制） |
| `/fms/v1/auth/*` | 20 | authorize/login、license、user、role、permission |
| `/fms/v1/action/*` | 18 | agvAction、agvActionGroup、sysAction（sysAction 为未挂路由系统动作页所用，只登记不迁移） |
| `/fms/v1/report/*` | 7 | orderStatisticsReport（含 taskStatistics）、vehicleStatisticsReport、systemAlarmRecord |
| `/fms/v1/systemLogos/*` | 6 | 品牌（P27、P01） |
| `/fms/v1/systemVersion/*` | 6 | 版本管理（P25） |
| `/fms/v1/systemLog/*` | 3 | 系统日志（P26） |
| `/fms/v1/dataBase/*` | 3 | 数据库备份（P30） |
| `/fms/v1/common/*` | 2 | sysLog/pageSysLogs（P28）、metrics |
| `/fms/v1/tripartiteTraffic/*` | 1 | 三方交管（P19） |
| `/fms/v1/serverResource/*` | 1 | 服务器资源（P40） |

operationId 全表见 `openapi-inventory.md`。每个页面任务开工时逐 operation 核对 method/path/字段/权限/响应，不得把本表当请求协议。

## 5. 旧路由权限特殊点（交接给页面任务）

1. **无 access 声明的页面**：`/vehicle-deploy/vehicle-type`（P06）、`/system-involve/database-backup`（P30）。旧系统未写 access 不等于公开访问；两页须核对后端菜单树实际包含与按钮码后再定权限呈现，不凭空创造权限码（规格 5.12）。
2. **复用权限码的独立页**：`/order-info` 用 `ORDER_RECORD_VIEW`（与任务管理同码）；`/vehicle-info` 用 `VEHICLE_LIST_VIEW`（与车辆列表同码）。目标树当前是 standalone 无守卫，T00.4 落实按码守卫。
3. **父目录权限**：旧父目录（如 `/vehicle-deploy` = `VEHICLE_MANAGE`）与子页权限独立判断；目录索引不能指向无权限/未实现页（T00.4）。
4. **服务器资源**：菜单别名与全屏页同一权限码 `SERVER_RESOURCE_MONITOR_VIEW`，别名 redirect 行为已在目标树，权限接线归 T00.4 + P40。
5. **软件授权 `/authorize-ingress`**：旧系统 layout:false 无 access，但只开放后端允许的授权入口，不等同免鉴权（P02）。

## 6. 历史实现与范围外登记（不迁移）

以下旧实现未被当前路由或可达组件引用（以 `.umirc.ts` 与逐页递归复核为准），只登记不迁移、不自动删除：

| 项 | 位置（旧仓库） | 说明 | 复核责任 |
| --- | --- | --- | --- |
| 历史电梯实现 | `TriDevice/Elevator`（现路由用 `Elevator_back`） | 未挂路由；P14 不得从历史实现复制能力 | P14 |
| 历史自动门实现 | `TriDevice/AutoDoor_back` 之外的 `AutoDoor` | 同上 | P15 |
| 输送线 | `TriDevice/ConveyorLine` | 无入口 | T00.1 登记 |
| 系统动作页 | `action/sysAction` 接口族（OpenAPI 有 operation） | 旧页面未挂路由；接口存在不构成新增页面依据 | 不迁移 |
| 重复用户/角色页 | `SystemInvolve/UserManagement`、`SystemInvolve/RoleManagement` | 与 AccessManagement 重复 | P31/P32 合并时复核 |
| 历史系统文件页面、旧动作策略代码 | 待逐页复核 | 无入口不迁；不因文件名删除仍被引用的共享模块 | 各页任务 |
| 旧全局监控 WebSocket | 硬编码 ws 地址（监控用） | G14；不迁回暂缓监控页 | T00/H01 |

## 7. 目标项目检查与依赖基线

| 项 | 状态（2026-09-17） | 处理责任 |
| --- | --- | --- |
| `pnpm lint`（oxlint） | ✅ 通过：150 文件 0 警告 0 错误 | — |
| `pnpm typecheck`（tsc -b --noEmit） | ✅ 通过 | — |
| `pnpm check:structure` | ❌ 失败：`scripts/check-structure.mjs` 不存在（package.json 已引用） | T00.2 修复脚本后必须真实执行 |
| `pnpm build` | 本轮未跑（T00.2 一并验证） | T00.2 |
| antd | `^6.6.1`（规格核实正式版 6.6.4；T00.2 重核 latest 并锁版本） | T00.2 |
| apex-table-react | **未安装**（目标依赖清单中不存在；规格核实 0.1.0） | T00.2/T00.5 安装并验证 |
| react / vite / ts | 19.2 / 8.2 / ~6.0.2 与规格一致 | — |
| i18n | 仅 zh-CN + en-US；`locales/` 仅 en-US 目录 | T00.8 扩五语言 |
| mock 文件 | `src/services/dashboard/dashboard.mock.ts`、`src/services/order-record/order.mock.ts` 存在 | P03/P34 清理，V01 审计 |
| README 视觉指南 | 引用 `docs/macos_ui_ux_design_guide_v3.md`；CLAUDE.md 已将其列为视觉基准（文件现存），规格勘察时缺失的表述以现状为准 | T00.2 复核（G16） |

## 8. 旧五语言资源基线

| 语言 | 文件 | 顶层 key 数（实测 2026-09-17） |
| --- | --- | --- |
| zh-CN | `C:\code\dd\src\locales\zh-CN.json` | 2092（与规格 18.1 一致） |
| en-US | `C:\code\dd\src\locales\en-US.json` | 2092（同上） |
| zh-TW | `C:\code\dd\src\locales\zh-TW.json` | 1478（同上） |
| ja-JP | `C:\code\dd\src\locales\ja-JP.json` | 1478（同上） |
| ko-KR | `C:\code\dd\src\locales\ko-KR.json` | 1478（同上） |

嵌套结构解析与旧 key→新命名空间映射归 T00.8 建格式、各页面任务提供分片；台账见 `i18n-map.md` / `i18n-missing.md` / `terminology.md`。

## 9. 共享资源 owner（T00.1 初版，变更须记录在 contracts.md）

按 `TASKS.md` 2.2 节执行：公共文件 owner = T00（之后统筹者）；页面私有模块 owner = 对应 P/H 任务。跨页只读选项（地图/节点、车辆、分组、载具、动作、工艺模板、驱动、电梯、角色、品牌）唯一 owner 为 T00，页面任务只消费查询契约；具体 operation 在 `contracts.md` 逐项登记后冻结。

## 10. 检查故障清单（T00.1 登记，T00.2 起修复）

1. `check:structure` 引用不存在的 `scripts/check-structure.mjs` → `pnpm check` 不可用（G16）。
2. 依赖清单缺 `apex-table-react`，业务表格无从替换 → T00.2 安装、T00.5 验证。
3. `SUPPORTED_LANGUAGES` 仅两语言，`normalizeLanguage` 行为待核 → T00.8。
4. 认证服务假登录 + 虚构 `/users/me`、`/auth/logout` → T00.3。
5. 请求层协议为模板 REST（`/api/v1`、无 envelope、RFC 9457、Cookie 刷新），与调度 `/fms/v1` + `code/message/data/timestamp` 包装不匹配 → T00.3。
6. dev 代理指向 `http://localhost:8000`（`APEX_DEV_PROXY_TARGET` 可覆盖），需改为调度目标默认 `http://10.11.2.67:8888` 并明确前缀处理 → T00.2。
