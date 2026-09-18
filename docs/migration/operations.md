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

| P03 | OrderRecord/状态统计 | `features/order-record/components/OrderStatisticsBar` + useVisiblePolling（约 5s 可见串行） | GET /fms/v1/dispatcher/orderRecord/orderRecordStateStatistic | orderRecordStateStatistic | order-record:view | 已验证（带令牌真实计数+轮询递增实证，2026-09-18） | tasks/P03.md（2026-09-18） |
| P03 | OrderRecord/列表分页筛选+导出 | `pages/order-record/OrderRecord`（Apex request 模式+列设置面板）+ OrderSearchForm + api.downloadGet/transferManager | GET /fms/v1/dispatcher/orderRecord/pageOrderRecords；GET …/exportOrderRecords | pageOrderRecords / exportOrderRecords | order-record:view | 已验证（带令牌：真实数据/分页/筛选命中/导出 4362 字节单条 xlsx+RFC5987；G04 平铺后端接受实证；列偏好闭环+缺陷修复） | tasks/P03.md |
| P03 | RecordTable/取消+移队列+跳过+继续 | confirmCommand 确认 + OrderCancelModal（取消原因必填） | POST /fms/v1/dispatcher/orderTask/orderTaskOperate | orderTaskOperate | order-record:operate | 前端完成；写操作待专用环境；data 语义随写操作联调 | tasks/P03.md |
| P03 | MockDispatchModal/模拟分配（真实仿真，标注仿真） | MockDispatchModal（防重复提交） | POST /fms/v1/dispatcher/orderTask/mockDispatch | mockDispatch | order-record:check | 前端完成；待专用环境验收 | tasks/P03.md |
| P03 | CreateOrderModal/创建任务 | CreateOrderModal（互斥约束/按行站点选项/草稿保留） | POST /fms/v1/dispatcher/orderRecord/createOrderRecord | createOrderRecord | order-record:create | 弹窗渲染/选项/草稿已验证；提交待专用环境验收 | tasks/P03.md |
| P03 | OrderInfoModal/详情快速预览（mission 分页+动作子表） | OrderInfoModal + MissionActionsTable（Apex；P38 起迁入 features/order-detail 为「壳+OrderDetailPanel」） | POST /fms/v1/dispatcher/orderRecord/getOrderRecordDetail | getOrderRecordDetail | order-record:view | 已验证（带令牌主体+mission+动作子表；P38 往返已联验闭环） | tasks/P03.md；tasks/P38.md |
| P05 | VehicleDisplay/列表分页+名称标识搜索 | `pages/vehicle-deploy/VehicleDisplay`（Apex request 模式+列设置面板+选择列）+ useVisiblePolling（约 5s 可见串行） | GET /fms/v1/dispatcher/vehicle/pageVehicles | pageVehicles | vehicle-list:view | 已验证（带令牌真实 56 辆/分页/筛选命中；G04 平铺后端接受实证；轮询保持筛选） | tasks/P05.md（2026-09-18） |
| P05 | VehicleDisplay/详情快速预览 | `features/vehicle-list/components/VehicleDetailDrawer`（24 项，数据取行记录零请求） | —（pageVehicles 行内数据） | — | 详情不限权（view） | 已验证（坐标三位小数/空值留白/JSON 原文）；P39 独立详情往返已联验（2026-09-18 补验：抽屉→完整详情→页签→往返列表保留） | tasks/P05.md |
| P05 | VehicleModal/接入车辆（新增） | `features/vehicle-list/components/VehicleFormModal`（草稿保留+useTabDirtyGuard；未关联选项 getUnRelationSimpleVehicles） | POST /fms/v1/dispatcher/vehicle/addVehicle；GET …/getUnRelationSimpleVehicles | addVehicle / getUnRelationSimpleVehicles | vehicle-list:add | 弹窗/选项/草稿已验证（未关联真实空集合）；提交待专用环境 | tasks/P05.md |
| P05 | VehicleModal/编辑车辆 | VehicleFormModal 编辑模式（按行重填，agvKey 禁用；已修复编辑→新增残留缺陷） | POST /fms/v1/dispatcher/vehicle/updateVehicle | updateVehicle | vehicle-list:update | 预填已验证；提交待专用环境 | tasks/P05.md |
| P05 | Switch 调度状态翻转 | confirmCommand → verifyVehicleFresh 核验 → updateVehicle 全量翻转（旧实现同通道） | POST /fms/v1/dispatcher/vehicle/updateVehicle | updateVehicle | vehicle-list:enable（无权限 disabled） | 确认框/核验链路已验证；执行待专用环境 | tasks/P05.md |
| P05 | 删除车辆 | confirmCommand（danger）→ deleteVehicle → 清理选择集 | POST /fms/v1/dispatcher/vehicle/deleteVehicle | deleteVehicle | vehicle-list:delete | 确认框已验证；执行待专用环境 | tasks/P05.md |
| P05 | 单车指令（暂停/继续）+ 批量指令（一键暂停/继续/启用/禁用） | 操作/一键操作 Dropdown → confirmCommand（无勾选=全部车辆）→ 核验（单车）→ operate；整批接受诚实文案（A15） | POST /fms/v1/dispatcher/vehicle/vehicleOperate；POST …/allVehicleOperate | vehicleOperate / allVehicleOperate | vehicle-list:operate / vehicle-list:batch-operate | 确认框（含跨页对象清单/全部车辆语义）已验证；执行待专用环境 | tasks/P05.md |
| P38 | 直访 /order-info 按任务上下文查询（主体+mission 分页+动作展开） | `pages/order-info/OrderInfo`（工作区页签默认形态，features/order-detail/OrderDetailPanel 单请求喂两区域） | POST /fms/v1/dispatcher/orderRecord/getOrderRecordDetail | getOrderRecordDetail | order-record:view（守卫） | 已验证（带令牌主体 17 项+mission 2 条+动作子表；不存在任务 code=200+data=null 实证→「任务不存在」反馈） | tasks/P38.md（联验 2026-09-18） |
| P38 | 详情参数（orderKey）+ 实体页签隔离 + 独立窗口 | 命名参数 `?orderKey=`（buildOrderInfoPath/parseOrderInfoSearch 单一真相，裸值 `?KEY` 与 `?KEY=` 兼容）；不同任务独立页签；「独立窗口」按钮经 openStandaloneWindow 打开同一路径 | — | — | order-record:view（新窗口同守卫） | 已验证（守卫回跳带参数/页签隔离/往返快照/独立窗口渲染） | tasks/P38.md |
| P38 | （旧）列表弹窗「完整详情」入口（D08 新增导航便利，旧系统无） | OrderInfoModal footer「完整详情」→ 关弹窗 + navigate /order-info?orderKey=… | — | — | order-record:view | 已验证（弹窗回归+导航+新页签生成+返回快照） | tasks/P38.md |
| P39 | 直访 /vehicle-info 按车辆标识查询实时状态（33 叶子字段递归展平三列 Descriptions，空值留白/枚举映射/时间戳秒级） | `pages/vehicle-info/VehicleInfo`（工作区页签默认形态；features/vehicle-detail/VehicleDetailPanel：getVehicleState + useVisiblePolling 约 5s 可见轮询，失败清空远端区域退避重查，不存在态停轮询） | GET /fms/v1/dispatcher/vehicle/getVehicleState | getVehicleState | vehicle-list:view（守卫） | 已验证（带令牌真实车辆完整字段渲染/不存在车辆 code=200+data=null 实证→「车辆不存在」反馈/缺参数零请求） | tasks/P39.md（联验 2026-09-18） |
| P39 | 详情参数（vehicleKey）+ 实体页签隔离 + 独立窗口 + 五语言 | 命名参数 `?vehicleKey=`（buildVehicleInfoPath/parseVehicleInfoSearch 单一真相，裸值 `?KEY` 与 `?KEY=` 兼容）；不同车辆独立页签；「独立窗口」按钮；vehicleInfo 四语言分片 67 key 同构（en 旧真译沿用，繁日韩 B1 基线）；P05 列表抽屉新增「完整详情」入口（宿主 VehicleDisplay 组装跨域导航） | — | — | vehicle-list:view（新窗口同守卫） | 已验证（守卫回跳带参数/两 vehicleKey 页签隔离/独立窗口渲染/五语言 html lang/裸值兼容/双主题双宽度截图）；抽屉点击链路经 RO 垫片补验通过（IAB ResizeObserver/rAF 抑制为环境问题，登记 P39.md 与 AGENTS 第 5 节） | tasks/P39.md |
| P04 | VehicleGroup/列表分页+搜索+展开行组内车辆 Tag | `pages/vehicle-deploy/VehicleGroup`（Apex request 模式+列设置面板+expandable 展开行；G09 不开放排序） | GET /fms/v1/dispatcher/vehicleGroup/pageVehicleGroups（G04 平铺 query） | pageVehicleGroups | vehicle-group:view（守卫） | 已验证（带令牌：空集合如实呈现/新增后行渲染/筛选命中与空结果/展开行 Tag；XHR 抓包平铺形态实证） | tasks/P04.md（2026-09-18） |
| P04 | GroupModal/新增分组（名称+Transfer 选车） | `features/vehicle-group/components/GroupFormModal`（草稿保留+useTabDirtyGuard；Transfer 复用共享选项 getSimpleVehicles；失效关联合成条目保留原标识+「已不可用」标注） | POST /fms/v1/dispatcher/vehicleGroup/addVehicleGroup；GET …/vehicle/getSimpleVehicles | addVehicleGroup / getSimpleVehicles | vehicle-group:add（无权限隐藏） | 已验证（真实新增成功+后端落库一致；Transfer 56 项真实加载；草稿保留闭环） | tasks/P04.md |
| P04 | GroupModal/编辑分组 | GroupFormModal 编辑模式（按行重填，simpleAGVs key 回填/缺失回退 agvKeys） | POST /fms/v1/dispatcher/vehicleGroup/updateVehicleGroup | updateVehicleGroup | vehicle-group:update（无权限隐藏） | 前端已验证（XHR 请求体正确+code=200+自动刷新）；**后端缺陷 P04-G1：groupName 不落库**（仅 updateTime 更新；vehicleKeys 生效），登记 gaps.md 待后端修复复验 | tasks/P04.md |
| P04 | 删除分组 | confirmCommand（danger，对象+影响+提交≠完成附注）→ deleteVehicleGroup → 刷新 | POST /fms/v1/dispatcher/vehicleGroup/deleteVehicleGroup | deleteVehicleGroup | vehicle-group:delete（无权限隐藏） | 已验证（取消路径保留；确认路径真实删除+列表清空+后端 total=0 自清理） | tasks/P04.md |

## 汇总状态口径

- 页面任务记录中的「操作映射」表是权威明细；本表只汇总已合并到工作分支的实现。
- 状态沿用 TASKS.md：实施状态（未开始/进行中/前端完成/受阻/已合并）与验证状态（未验证/部分通过/已通过/不适用）分开记录。
