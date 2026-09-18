# 操作映射总台账（operations）

> 由统筹者汇总维护；页面任务只更新自己的 `tasks/<ID>.md`，由统筹者把已合并实现的映射汇总到这里。
> 列：旧路由/组件/操作 → 新实现 → method/path/operationId → 权限 → 状态/证据。
> T00.1 初始化（2026-09-17）：尚无已合并页面实现，全部待各任务交付后登记。

| 任务 | 旧入口/操作 | 新实现 | Method + Path | operationId | 权限 | 状态 | 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P02 | AuthorizeIngress/硬件码展示 | `pages/authorize-ingress` + `features/license-activation/hooks/useHardwareInfo` | GET /fms/v1/auth/license/getHardwareInfo | getHardwareInfo | 无需认证（实证） | 已合并；验证已通过 | tasks/P02.md（联验 2026-09-18） |
| P02 | AuthorizeIngress/硬件码复制 | `features/license-activation/utils/copyText` | — | — | 登录 | 已合并；验证已通过 | 剪贴板读回实证 |
| P02 | AuthorizeIngress/激活提交 | `features/license-activation/components/ActivationForm`（P29 复用） | POST /fms/v1/auth/license/softwareActivation | softwareActivation | 登录（security None） | 已合并；读链路通过，**写副作用待专用环境** | tasks/P02.md |
| P02 | （旧）成功跳 /over-look | activationConfirmed + resolveLandingPath 按权限导航 | — | — | 登录 | 已合并；落点机制实证 | tasks/P02.md |
| P41 | UnAccess/403 反馈+退出登录 | `pages/un-access` + logout 服务 | POST /fms/v1/auth/authorize/logout | logout | 登录 | 已合并；验证已通过 | tasks/P41.md（联验 2026-09-18） |
| P42 | NotFound/404 反馈+恢复路径 | `pages/error/NotFound`（公开 /404 与受保护根内 `*` 兜底共用） | — | — | 公开或登录 | 已合并；验证已通过 | tasks/P42.md（联验 2026-09-18） |
| P42 | （旧）首页按钮 → /over-look | 「首页」+ resolveLandingPath 落点导航（replace）；未登录「去登录」 | — | — | 登录或未登录分支 | 已合并；验证已通过 | tasks/P42.md |
| P42 | ServerError /500 + 两级错误边界 | `pages/error/ServerError` + `RouterErrorBoundary` + `PageErrorBoundary`（error 分片基座常载） | — | — | 登录（/500 守卫） | 已合并；错误边界运行时呈现待自然场景复核（资源齐备静态核对通过） | tasks/P42.md |
| H01 | Overlook/调度监控入口 | `pages/overlook/Overlook` 渲染统一暂缓说明（MigrationPending 玻璃面板）；`migrationDeferred` 标记不作落点/回跳候选 | — | — | overview:view（菜单/直访一致） | 已合并；验证已通过（零业务请求/零 WebSocket/查询上下文保留） | tasks/H01.md（联验 2026-09-18） |
| H02 | MapNestModify/地图编辑入口 | `pages/map-through/MapNestModify` 渲染统一暂缓说明（复用 MigrationPending）；`migrationDeferred` 标记，旧 Konva 编辑器不迁移（P09/P07 资源归属不受影响） | — | — | map-edit:view（菜单/直访一致） | 已合并；验证已通过（零业务请求/查询上下文保留/五语言/两主题） | tasks/H02.md（联验 2026-09-18） |
| H03 | RecordPlayback/录制回放入口 | `pages/record-playback/RecordPlayback` 渲染统一暂缓说明（复用 MigrationPending）；`migrationDeferred` 标记，旧 Konva 回放/导入导出/时间轴/轮询整体不迁移（P03/P34 资源归属不受影响） | — | — | record-playback:view（菜单/直访一致） | 已合并；验证已通过（零业务请求/查询上下文保留/五语言/两主题） | tasks/H03.md（联验 2026-09-18） |

| P03 | OrderRecord/状态统计 | `features/order-record/components/OrderStatisticsBar` + useVisiblePolling（约 5s 可见串行） | GET /fms/v1/dispatcher/orderRecord/orderRecordStateStatistic | orderRecordStateStatistic | order-record:view | 前端完成；带令牌联验受阻（后端凭据失效） | tasks/P03.md（2026-09-18） |
| P03 | OrderRecord/列表分页筛选+导出 | `pages/order-record/OrderRecord`（Apex request 模式）+ OrderSearchForm + api.downloadGet/transferManager | GET /fms/v1/dispatcher/orderRecord/pageOrderRecords；GET …/exportOrderRecords | pageOrderRecords / exportOrderRecords | order-record:view | 前端完成；G04 平铺形态已实证，带令牌联验受阻 | tasks/P03.md |
| P03 | RecordTable/取消+移队列+跳过+继续 | confirmCommand 确认 + OrderCancelModal（取消原因必填） | POST /fms/v1/dispatcher/orderTask/orderTaskOperate | orderTaskOperate | order-record:operate | 前端完成；写操作待专用环境；data 语义待联调 | tasks/P03.md |
| P03 | MockDispatchModal/模拟分配（真实仿真，标注仿真） | MockDispatchModal（防重复提交） | POST /fms/v1/dispatcher/orderTask/mockDispatch | mockDispatch | order-record:check | 前端完成；待专用环境验收 | tasks/P03.md |
| P03 | CreateOrderModal/创建任务 | CreateOrderModal（互斥约束/按行站点选项/草稿保留） | POST /fms/v1/dispatcher/orderRecord/createOrderRecord | createOrderRecord | order-record:create | 前端完成；待专用环境验收 | tasks/P03.md |
| P03 | OrderInfoModal/详情快速预览（mission 分页+动作子表） | OrderInfoModal + MissionActionsTable（Apex） | POST /fms/v1/dispatcher/orderRecord/getOrderRecordDetail | getOrderRecordDetail | order-record:view | 前端完成；带令牌联验受阻；P38 往返待联验 | tasks/P03.md |

## 汇总状态口径

- 页面任务记录中的「操作映射」表是权威明细；本表只汇总已合并到工作分支的实现。
- 状态沿用 TASKS.md：实施状态（未开始/进行中/前端完成/受阻/已合并）与验证状态（未验证/部分通过/已通过/不适用）分开记录。
