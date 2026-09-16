# 基线记录（T001 交付）

> 记录迁移开工时三仓实际版本、工作区状态、目标依赖锁与类型检查现状。
> 与 SPEC §3.1 调研基线的差异逐项列出；业务范围不因源码更新而扩大（SPEC §3.1）。

## 1. 三仓实况（2026-09-16，T001 认领时）

| 仓库 | 实际 HEAD | 提交时间 | 工作区 | SPEC 调研基线 | 基线以来差异 |
| --- | --- | --- | --- | --- | --- |
| 目标项目 apex-admin-web（本仓库） | `ebe6f0a5da4ca1a5f342cf6b6aab60859cff836c` | 2026-09-16 16:28 | 干净 | `08c42d2` | 3 个文档提交（docs: 文档更新/优化），无代码差异 |
| 旧项目 C:\code\dd | `e570b8df24ed7493bb2369b052e19759eafed211` | 2026-09-16 14:25 | 干净（0 改动） | `70762c19`（当时无改动） | 1 个提交：`e570b8d feat: 优化利用率统计` |
| 表格库 C:\yangwenhua\ApexTableReact | `ae34e0a28493db57f5593f00b4c9abe4a9f3c94e` | 2026-09-16 13:52 | 干净（0 改动） | `b208762d`（展开行改动**未提交**） | 2 个提交：`972604f feat: 新增行展开`、`ae34e0a feat: 版本更新` |

### 基线以来差异清单（不扩大已确认范围）

- **旧项目 `e570b8d`**（涉及 T085 域）：`src/pages/AnalyzeVisual/TaskStatisticsReport/TaskStatistics.tsx`（+43/-20 行左右，利用率统计优化）、`src/types/AnalyzeVisual/VehicleStateStatistics.d.ts`、`src/locales/zh-CN.json`、`src/locales/en-US.json` 各 2 行。T085 冻结 P35 动作时以本 HEAD 的快照为准，需对照该提交重核任务统计报表的现状。
- **表格库 `972604f` + `ae34e0a`**（涉及 T021/T022 域）：行展开能力（`src/internal/expansion.ts` 新增、`src/ApexTable/index.tsx` 扩展、types/locale/styles 共 17 文件 +372/-39）已随版本更新提交，且 **npm 已发布 `apex-table-react@0.1.0`**（调研时为 `0.1.0-rc.0`）。T021"先核对已具备能力"时按 0.1.0 已发布状态核对，展开行不再是"进行中未提交改动"。

## 2. 目标项目依赖锁与配置现状

- 包管理：`packageManager: pnpm@11.21.0`，`engines.node >= 22.22.0`；安装可复现命令：`pnpm install --frozen-lockfile`（lock 为 pnpm-lock.yaml）。
- 关键依赖（锁定时点，见 package.json 与 pnpm-lock.yaml）：react ^19.2.8、react-router ^8.3.0、vite ^8.2.0、typescript ~6.0.2、@reduxjs/toolkit ^2.12.0、axios ^1.19.0、react-i18next ^17.0.12。
- **antd：已由 `^6.6.1` 锁定为精确版本 `6.6.4`**（2026-09-16 经 registry 核实的最新稳定版，与 SPEC §5.2 调研基准一致），pnpm-lock.yaml 已同步。
- vite.config.ts：`@` → `src` 别名不变；dev 代理 `/api` → `APEX_DEV_PROXY_TARGET`（默认 `http://localhost:8000`）不变；**新增 `/fms`、`/rcsFlow` 旧协议前缀代理**，由 `APEX_DEV_LEGACY_TARGET` 驱动、未配置不注册（详见 environment.md §2）。
- 新增 `.env.example`（`.env.local` 等本地文件沿用 .gitignore 的 `*.local` 忽略）。

## 3. 类型检查现状（执行口径：TASKS §2 第 5 条，只跑 `pnpm typecheck`）

| 时点 | antd | 结果 |
| --- | --- | --- |
| T001 认领时（基线） | 6.6.1（^6.6.1 解析） | `tsc -b --noEmit` 通过（exit 0，无输出） |
| 锁定 antd 后 | 6.6.4（精确） | `tsc -b --noEmit` 通过（exit 0，无输出） |

未运行 lint / 结构检查 / 构建（超出本任务清单口径）。

## 4. 目标入口索引（只索引入口，逐页动作由页面首任务按 SPEC 附录C 冻结）

来源：`src/router/definitions.tsx`（路由单源）。共 **49 个 `loadPage` 页面节点**、10 个 index/别名重定向节点、目录节点若干；affix 常驻页签当前仅 `dashboard`。暂缓模块入口（本轮展示暂缓状态、不接业务运行时）：`over-look`、`map-through-map-nest-modify`、`analyze-visual-record-playback`。

### 布局外公开/辅助页（无 BasicLayout、无页签）

| 路由 id | 路径 | 页面入口（src/ 下） | 标题 | 备注 |
| --- | --- | --- | --- | --- |
| auth-login | /login | pages/auth/Login/Login | 登录 | P01 相关 |
| authorize-ingress | /authorize-ingress | pages/authorize-ingress/AuthorizeIngress/AuthorizeIngress | 软件授权 | P02 相关 |
| order-info | /order-info | pages/order-info/OrderInfo/OrderInfo | 任务详情 | 布局外详情（P38 相关，待 T007 改对象页签） |
| vehicle-info | /vehicle-info | pages/vehicle-info/VehicleInfo/VehicleInfo | 车辆详情 | 布局外详情（P39 相关） |
| server-resource-monitor | /analyze-visual/server-resource-monitor | pages/analyze-visual/ServerRealtimeResources/ServerRealtimeResources | 服务器资源监控 | 布局外全屏（P40） |
| no-permission | /no-permission | pages/un-access/UnAccess/UnAccess | 无权限 | 撤权落地页 |
| error-500 | /500 | pages/error/ServerError/ServerError | 服务错误 | 辅助页 |
| root-not-found | /*（root 内） | pages/error/NotFound/NotFound | 页面不存在 | 辅助页 |
| error-404 | /404 | pages/error/NotFound/NotFound | 页面不存在 | 辅助页 |

### BasicLayout 内业务页（完整路径按树推导）

| 路由 id | 完整路径 | 页面入口 | 标题 | 备注 |
| --- | --- | --- | --- | --- |
| profile | /profile | pages/profile/Profile/Profile | 个人中心 | 改密入口（G02 相关） |
| dashboard | /dashboard | pages/dashboard/Dashboard/Dashboard | 仪表盘 | affix 常驻页签 |
| over-look | /over-look | pages/overlook/Overlook/Overlook | 调度监控 | **暂缓模块入口** |
| order-record | /order-record | pages/order-record/OrderRecord/OrderRecord | 任务管理 | P03，现走 mock（T066 替换） |
| vehicle-deploy-vehicle-group | /vehicle-deploy/vehicle-group | pages/vehicle-deploy/VehicleGroup/VehicleGroup | 车辆分组 | P06 |
| vehicle-deploy-vehicle-display | /vehicle-deploy/vehicle-diplay | pages/vehicle-deploy/VehicleDisplay/VehicleDisplay | 车辆列表 | P05；path 保留源拼写 vehicle-diplay |
| vehicle-deploy-vehicle-type | /vehicle-deploy/vehicle-type | pages/vehicle-deploy/VehicleType/VehicleType | 载具类型 | P04 |
| vehicle-deploy-node-mapping | /vehicle-deploy/node-mapping | pages/vehicle-deploy/NodeMapping/NodeMapping | 节点映射 | P07 |
| vehicle-deploy-alarm-code | /vehicle-deploy/alarm-code-management | pages/system-involve/AlarmCodeManagement/AlarmCodeManagement | 告警码管理 | P08（注意页面目录在 system-involve） |
| map-through-map-list | /map-through/map-list | pages/map-through/MapList/MapList | 地图列表 | P09 |
| map-through-map-nest-modify | /map-through/map-nest-modify | pages/map-through/MapNestModify/MapNestModify | 地图编辑 | **暂缓模块入口** |
| map-through-cross-maps | /map-through/cross-maps | pages/map-through/CrossMaps/CrossMaps | 地图关联 | P10 |
| map-through-point-edge-combination | /map-through/point-edge-combination | pages/map-through/PointEdgeCombination/PointEdgeCombination | 多地图点边组合 | P11 |
| map-through-map-push-records | /map-through/map-push-records | pages/map-through/MapPushNotificationRecords/MapPushNotificationRecords | 地图推送记录 | P12 |
| dispatch-hub | /dispatch-hub | pages/dispatch-hub/DispatchHub/DispatchHub | 调度中心 | P13 |
| tri-resource-tri-device-elevator | /tri-resource/tri-device/elevator | pages/tri-device/Elevator/Elevator | 电梯 | P14 |
| tri-resource-tri-device-auto-door | /tri-resource/tri-device/auto-door | pages/tri-device/AutoDoor/AutoDoor | 自动门 | P15 |
| tri-resource-tri-device-charge-pile | /tri-resource/tri-device/charge-pie | pages/tri-device/ModbusChargePile/ModbusChargePile | 充电桩 | P16；path 保留源拼写 charge-pie |
| tri-resource-tri-device-traffic-lights | /tri-resource/tri-device/traffic-lights | pages/tri-device/TrafficLights/TrafficLights | 交通灯 | P17 |
| tri-resource-tri-device-air-shower-door | /tri-resource/tri-device/air-shower-door | pages/tri-device/AirShowerDoor/AirShowerDoor | 风淋门 | P18 |
| tri-resource-tri-traffic | /tri-resource/tri-traffic | pages/tri-traffic/TriTraffic/TriTraffic | 三方交管 | P19 |
| mission-cluster-mission-create | /mission-cluster/mission-create | pages/mission-cluster/MissionCreate/MissionCreate | 任务工艺 | P20 |
| mission-cluster-mission-flow | /mission-cluster/mission-flow | pages/mission-cluster/MissionFlow/MissionFlow | 工艺管理 | P21 |
| mission-cluster-obstacle-avoidance | /mission-cluster/obstacle-avoidance | pages/obstacle-avoidance/ObstacleAvoidance/ObstacleAvoidance | 避障模板 | P22（页面目录独立于 mission-cluster） |
| mission-cluster-action-control-agv-action | /mission-cluster/action-control/agv-action | pages/action-control/AGVAction/AGVAction | 车辆动作 | P23 |
| mission-cluster-action-control-agv-action-group | /mission-cluster/action-control/agv-action-group | pages/action-control/AGVActionGroup/AGVActionGroup | 动作分组 | P24 |
| system-involve-version-control | /system-involve/version-control | pages/system-involve/VersionControl/VersionControl | 版本管理 | P25 |
| system-involve-system-log | /system-involve/system-log | pages/system-involve/SystemLog/SystemLog | 系统日志 | P26 |
| system-involve-system-setting | /system-involve/system-setting | pages/system-involve/SystemSetting/SystemSetting | 系统设置 | P27 图片配置 |
| system-involve-operation-log | /system-involve/operation-log | pages/system-involve/OperationLog/OperationLog | 操作日志 | P28 |
| system-involve-software-information | /system-involve/software-information | pages/system-involve/SoftwareInformation/SoftwareInformation | 软件信息 | P29 |
| system-involve-database-backup | /system-involve/database-backup | pages/system-involve/DatabaseBackupManagement/DatabaseBackupManagement | 数据库备份管理 | P30 |
| access-management-user-management | /access-management/user-management | pages/access-management/UserManagement/UserManagement | 用户管理 | P31 |
| access-management-role-management | /access-management/role-management | pages/access-management/RoleManagement/RoleManagement | 角色管理 | P32 |
| analyze-visual-order-statistics | /analyze-visual/order-statistics | pages/analyze-visual/OrderStatistics/OrderStatistics | 任务统计 | P33 |
| analyze-visual-record-playback | /analyze-visual/record-playback | pages/record-playback/RecordPlayback/RecordPlayback | 录制回放 | **暂缓模块入口**（页面目录独立） |
| analyze-visual-dashboard-realtime | /analyze-visual/dashboard-realtime | pages/analyze-visual/RealtimeDashboard/RealtimeDashboard | 实时看板 | P34 |
| analyze-visual-dashboard-task | /analyze-visual/dashboard-task | pages/analyze-visual/TaskStatisticsReport/TaskStatisticsReport | 任务统计报表 | P35 |
| analyze-visual-dashboard-fault | /analyze-visual/dashboard-fault | pages/analyze-visual/FaultAlert/FaultAlert | 故障告警 | P36 |
| analyze-visual-vehicle-status | /analyze-visual/vehicle-status | pages/analyze-visual/VehicleStatus/VehicleStatus | 车辆状态统计 | P37 |
| analyze-visual-server-resource | /analyze-visual/server-resource | （无 loadPage，redirect） | 服务器资源 | 菜单别名 → /analyze-visual/server-resource-monitor |

index 重定向节点（无业务页面）：root-index、vehicle-deploy-index（→ vehicle-group）、map-through-index（→ map-list）、tri-resource-index（→ tri-device）、tri-resource-tri-device-index（→ elevator）、mission-cluster-index（→ mission-create）、mission-cluster-action-control-index（→ agv-action）、system-involve-index（→ version-control）、access-management-index（→ user-management）、analyze-visual-index（→ order-statistics）。

## 5. 缺资料登记

| 项 | 状态 | 影响 | 责任/解除 |
| --- | --- | --- | --- |
| 旧项目 `.npmrc` 未入快照 | 主动排除（防 registry 令牌入仓） | 无——依赖安装不依赖该文件 | 如需 registry 配置由使用者本机自备 |
| 旧项目 dist、目标构建产物 | 排除（依赖与构建产物不入快照） | 无 | 需要时按 manifest 从原仓库或 lock 重建 |
| 旧后端测试地址/账号 | 未提供（SPEC §14） | 旧协议联调、真实写入待验 | 用户另行提供，T090 登记使用方式 |
| 表格库正式发布授权 | npm 发布由用户执行 | T107 才能切正式包 | 用户发布后 T107 锁定 |
| 视觉指南文件 docs/macos_ui_ux_design_guide_v3.md | 本仓库当前不存在（SPEC §3.1 已记录） | 以现存组件、globals.css、designTokens.ts 为视觉依据 | 如恢复由文档方补充 |
