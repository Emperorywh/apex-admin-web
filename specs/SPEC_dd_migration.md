# 调度系统页面与功能迁移规格

- 文档编号：SPEC_dd_migration
- 日期：2026-09-16
- 状态：访谈及规格评审修订完成，迁移规则已明确；动作级清单在页面实施前核对冻结，业务实现尚未开始。
- 目标项目：`C:\code\apex-admin-web`
- 参考项目：`C:\code\dd`，功能主体位于 `src`，路由依据为根目录 `.umirc.ts`。
- 表格组件库：`C:\yangwenhua\ApexTableReact`；最终依赖官方 npm 包 `apex-table-react`。
- 本次交付：本规格；不包含页面实现、后端改造、npm 发布或生产部署。

## 1. 目标与分轮实施边界

分轮在当前 React 项目中实现旧系统当前有效路由下的业务页面、字段、操作、校验、弹窗、子表、图表、权限及 API 调用。本轮完成§4的P01—P42及§1.2规定的暂缓页面入口状态；调度监控、地图编辑、录制回放因复杂度较高，业务实现留到下一轮，仍属于整体迁移目标。沿用当前项目外壳和视觉规范；全部业务数据表格统一使用 ApexTableReact；antd 升级至实施基线确定时的最新稳定版。

### 1.1 必须保留

1. 当前项目的 macOS 风格顶栏、Dock、多页签、主题能力和分层架构。
2. 旧系统当前有效路由及其实际依赖的组件、表单、弹窗、图表和业务规则；按本轮实现与下一轮暂缓划分交付，不因暂缓删除模块定义或既有业务契约。
3. 旧后端地址、HTTP 方法、请求参数、字段类型、业务枚举、响应协议及身份体系。
4. 五种语言：zh-CN、zh-TW、en-US、ja-JP、ko-KR。
5. 所有仍被保留页面使用的共享能力，包括地图数据查询、节点映射选点、设备控制、软件授权、上传下载。
6. 登录后的退出操作、当前用户修改密码、语言切换和系统图片配置等路由外公共交互。当前用户改密仍放在用户菜单中，不因此新增个人中心页。

### 1.2 本轮暂缓、下一轮实现

| 模块 | 路由 | 处理 |
| --- | --- | --- |
| 调度监控 | /over-look | 保留路由、菜单定义及权限关联；本轮显示“下一轮实现”提示，不接入监控数据、WebSocket和控制动作。下一轮迁移完整监控功能。 |
| 地图编辑 | /map-through/map-nest-modify | 保留路由、菜单定义及权限关联；独立编辑器和地图版本“查看／编辑”能力留到下一轮。本轮页面显示暂缓提示，版本相关入口标注“下一轮实现”并禁用，不另建独立地图预览。 |
| 录制回放 | /analyze-visual/record-playback | 保留路由、菜单定义及权限关联；本轮显示“下一轮实现”提示，不接入录制导入／导出／回放接口。下一轮迁移完整回放功能。 |

三个模块的菜单按原权限展示并标注暂缓状态，路由直访同样鉴权，通过后显示统一暂缓提示及返回本轮可用页面／退出登录入口，不作为404。已有源码、路由标识、权限码、接口契约及下一轮所需资料保留；不要求本轮搬运旧项目中的完整实现，也不因暂缓清理现有相关文件。暂缓页面不加载专用重型依赖、不发业务请求，不以模拟数据冒充已实现。下一轮在既有路由定义和领域契约上继续实现，届时再验收业务能力。

“调度中心”与“调度监控”不同，前者本轮完整实现。地图列表的名称等元数据编辑、导入、拉取、版本管理、发布、推送、下载均在本轮实现。节点映射已有的地图选点弹窗属于本轮功能，必须保留；不得因暂缓地图编辑而连带删去。本文后续“保留页面／保留入口”指本轮完整实现的业务页面；三个暂缓模块的入口状态另按本节处理。

### 1.3 不纳入本次迁移的历史及额外功能

未挂路由、未被有效页面引用的历史实现不迁移，例如输送线、策略管理、自定义动作及未启用的设备版本。实际路由指向 Elevator_back、AutoDoor_back、AirShowerDoor_back；不得仅按名称选择另一个同类实现。

当前项目额外仪表盘、个人中心不纳入业务交付，不作为默认首页或保留入口；重叠用户／角色管理合并到旧系统业务入口。不得将现有模拟仪表盘当作已完成的真实业务页面。

## 2. 访谈决策记录

以下 D01—D28 汇总访谈决策及后续范围修订，优先于本文引用的旧文档、旧注释及库的推荐默认值。

| 编号 | 已确定决策 |
| --- | --- |
| D01 | 保留旧 API 地址和协议；按当前 services／DTO 结构封装与适配，不改后端。 |
| D02 | 保留当前外壳和视觉规范；业务字段、流程、能力完整，布局可以适配。 |
| D03 | 调度监控、地图编辑、录制回放本轮暂缓、下一轮实现；保留路由和菜单并标注暂缓，暂不接入其业务能力，不新增地图预览。其他本轮业务能力完整实现。 |
| D04 | 允许修改 ApexTableReact 补齐实际所需通用能力，所有业务表格统一使用它。 |
| D05 | 以 .umirc.ts 当前路由及实际依赖为范围，不搬运未使用历史实现。 |
| D06 | 统一采用旧后端登录、用户、角色、权限；保留当前登录页视觉。 |
| D07 | 额外仪表盘、个人中心不纳入；重叠管理功能合并到旧入口。 |
| D08 | 复刻菜单与按钮权限；详情、全屏直访也保护；无权限动作入口隐藏。 |
| D09 | 车辆跨页勾选保留，筛选变化清空；提交前列出对象及数量。 |
| D10 | 仅可见页轮询；隐藏暂停，恢复立即刷新；原有页面刷新频率保留。 |
| D11 | 页签切换保留内存草稿；关闭、刷新、主动退出前提示；浏览器刷新后不恢复草稿。 |
| D12 | 表格外观只在当前会话保留，关闭浏览器后恢复默认，不按账号持久化到本机。 |
| D13 | 任务、车辆详情用应用内独立页签，可同时打开多个；服务器资源保持全屏。 |
| D14 | 写操作不自动重发；超时结果待确认，查询现状；有分项结果则展示，无则明确未知。 |
| D15 | 切换应用页签继续传输；关闭所属页签先提示取消；真实进度或处理中；大文件优先浏览器流式下载。 |
| D16 | 五种语言全部保留，补齐新增交互和第三方控件文案。 |
| D17 | 桌面 Chrome／Edge，1366×768 和 1920×1080，浅深两色，不做手机版。 |
| D18 | 指标定义保持一致；明确前端错误可修正并记录，统计定义／后端规则变化另行确认。 |
| D19 | 最终通过官方 npm 仓库的 apex-table-react 接入。 |
| D20 | 用户会提供可操作的独立测试环境及账号使用方式；未提供前不假定旧代理地址可写。 |
| D21 | 全量功能清单验收、关键流程浏览器实测、构建／类型／lint／结构检查全部通过。 |
| D22 | 常规规模：车辆不超过500，任务／日志百万级但服务端分页，单页不超过200，约10个页签。 |
| D23 | 可配置服务器 URL 回退，保留 BrowserRouter；旧 # 链接兼容不作为本次必交付项。 |
| D24 | 本轮权限编辑暂时隐藏三个暂缓模块节点，但保留节点定义和既有授权，不清理旧后端权限；下一轮模块实现时恢复对应权限编辑。 |
| D25 | 有草稿或传输的页签不自动淘汰；容量不足时先提示保存／关闭，不静默丢失、不无限扩容。 |
| D26 | 认证失效立即清空会话业务状态并返回登录；不恢复草稿、不自动续传。 |
| D27 | 允许本地构建包临时联调；最终锁定已发布 npm 明确版本，发布由用户负责。 |
| D28 | 无补充现场约束、期限或优先级，按以上方案实施。 |

D26 是 D11、D15 的明确例外：认证失效不得为等待“放弃草稿”确认而继续保留受保护页面。主动退出先执行草稿、普通写入和传输提示；权限撤销及软件授权失效按§9.1分别处理，不以草稿保护为由继续开放无权操作。

## 3. 调研依据与版本基线

### 3.1 已核实事实

| 项目 | 调研状态 |
| --- | --- |
| 当前项目 | React 19、TypeScript 6、Vite 8、React Router 8、Redux Toolkit、axios、react-i18next；package.json 中 antd 为 ^6.6.1。多数业务页为占位，任务列表仍使用 mock。 |
| 旧项目 | Umi Max、React 18 类型、antd ^5.4.0；hash 路由；API 集中在 src/api；有菜单权限、按钮权限、上传和报表实现。 |
| 当前 API | 默认 /api/v1，资源本体响应、problem+json、Cookie 刷新；与旧业务协议不同，不能直接原样复用其认证行为。 |
| 旧 API | /fms 与 /rcsFlow 地址，常见 code／message／data 包装，旧 token，1000000 过期与1001000软件未授权分支。 |
| 表格库 | npm 调研时为 0.1.0-rc.0；支持分页、选择、编辑、虚拟滚动等；展开行工作区存在进行中的未提交改动。不得把类型声明当作能力已验收。 |
| antd | 2026-09-16 核实最新稳定版为6.6.4，实施开始重新核实并锁定。 |

来源：[Ant Design 更新日志](https://ant.design/changelog/)、[antd registry 元数据](https://registry.npmjs.org/antd/latest)、[ApexTableReact registry 元数据](https://registry.npmjs.org/apex-table-react)、[用户指定 npm 页面](https://www.npmjs.com/package/apex-table-react)。npm 展示页在调研工具中返回403，包版本通过官方 registry 核实。

调研时 Git HEAD：

- 当前项目：08c42d22a710e4e836209dbc3036da6d29cc1b2b。
- 旧项目：70762c190fba9501341bfdd17ed3ce29d0ae183c；调研时工作区未见改动。
- 表格库：b208762d15f865ef03d06c1b21021b1e2ee85179；展开行实现、文档和样式正在变化。

实施时记录实际源码提交与未提交变更摘要，先检查组件库已有工作，衔接而非覆盖。若旧业务源码变化，更新差异清单，不自动扩大已确认范围。当前 README 引用的视觉指南文件在本工作区未找到，以现存组件、globals.css、designTokens.ts 和实际外壳为视觉依据。

### 3.2 “完整复刻”的可核查定义

每个保留页面开始实现前，必须按附录C核对并冻结动作级清单：逐项记录入口条件、路由参数、展示字段、查询条件、初始值、枚举、校验、动作、请求、权限、成功／失败反馈、刷新关系和嵌套内容。复制、启停、拖拽排序等复用已有接口或不单独发请求的交互也需独立列项，不能用API覆盖率代替功能覆盖率。字段、参数及业务枚举以本节记录的有效源码提交与真实接口为基线，不能凭页面名称简化为通用 CRUD。联调前无法验证的契约标记为待核验，不标记为已验证。

旧注释、旧规格与当前可执行代码不一致时，以当前有效实现和真实契约为核查依据；业务定义变化必须列出，不擅自“统一”口径。附录 API 静态清单属于保守依赖集，共享仓储会让一个页面列出不止其运行时实际调用的方法，不代表页面必须同时发出所有请求。

## 4. 页面与功能范围

下表为页面级范围清单；动作级验收以§3.2和附录C的冻结记录展开。每项包含其实际引用的弹窗、组件和下级交互，逐项附证据；不得仅凭页面或API已存在就判定该项完成。

| 编号 | 页面／入口 | 必须实现的功能 |
| --- | --- | --- |
| P01 | 登录 /login | 当前登录视觉，旧登录请求和密码转换，语言切换，登录背景配置，激活状态分流，首个有权页面跳转，过期提示。 |
| P02 | 软件授权 /authorize-ingress | 硬件码查询、复制、激活码提交、加载和错误反馈；成功后进入有权的本轮已实现页面，不默认跳暂缓的调度监控。 |
| P03 | 任务管理 /order-record | 状态统计、全部原筛选、分页、创建订单、模拟分配、原有任务控制与取消原因、详情、Excel导出；操作状态和权限完整。 |
| P04 | 车辆分组 /vehicle-deploy/vehicle-group | 查询分页、新增编辑删除、车辆分配、展开成员列表。 |
| P05 | 车辆列表 /vehicle-deploy/vehicle-diplay | 查询分页、新增关联上报车辆、编辑删除、调度状态启停和详情、单车控制、勾选车辆操作与全部车辆操作；按§6.4分别确认范围。保留旧路径拼写。 |
| P06 | 载具类型 /vehicle-deploy/vehicle-type | 查询分页、新增编辑删除、全部尺寸与类型字段及校验；菜单与直访统一使用carrier:view。 |
| P07 | 节点映射 /vehicle-deploy/node-mapping | 查询、新增编辑删除、车辆及地图选择、按地图分组的映射编辑、节点坐标回填、已有地图选点、采集节点建议、重复与缺项校验。 |
| P08 | 告警码管理 /vehicle-deploy/alarm-code-management | 查询分页、新增编辑删除、批量条目表单、文件导入和下载、格式校验及覆盖提示。 |
| P09 | 地图列表 /map-through/map-list | 查询分页、元数据新增编辑删除、调度地图和车载地图导入、拉取、版本列表、发布、推送、下载。版本查看／编辑器入口按原权限展示，但本轮标注“下一轮实现”并禁用；相应功能留到下一轮。 |
| P10 | 地图关联 /map-through/cross-maps | 查询分页、新增编辑删除、跨地图站点与电梯关联、展开关联明细。 |
| P11 | 多地图点边组合 /map-through/point-edge-combination | 查询分页、新增编辑删除、地图点边组合选择、展开明细。 |
| P12 | 地图推送记录 /map-through/map-push-records | 查询分页、推送状态与原有明细、展开记录、重推及取消推送、进行中和失败反馈。 |
| P13 | 调度中心 /dispatch-hub | 按配置分组展示、按类型编辑、默认值与范围单位、批量保存、重置、权限只读和草稿保护。 |
| P14 | 电梯 /tri-resource/tri-device/elevator | 采用 Elevator_back：驱动、查询、增改删、状态、呼梯／楼层指令、开关门、清占用及控制弹窗。 |
| P15 | 自动门 /tri-resource/tri-device/auto-door | 采用 AutoDoor_back：驱动、查询、增改删、状态、开关门、清占用。 |
| P16 | 充电桩 /tri-resource/tri-device/charge-pie | 采用 ModbusChargePile：驱动、查询、增改删、启动／停止充电；保留旧路径拼写。 |
| P17 | 交通灯 /tri-resource/tri-device/traffic-lights | 驱动、查询、增改删、配置字段、测试操作和反馈。 |
| P18 | 风淋门 /tri-resource/tri-device/air-shower-door | 采用 AirShowerDoor_back：驱动、查询、增改删、状态、门控、风淋、清占用和控制弹窗。 |
| P19 | 三方交管 /tri-resource/tri-traffic | 查询、增改删、点边组与动态配置、通信测试及结果。 |
| P20 | 任务工艺 /mission-cluster/mission-create | 工艺模板查询、新增、复制、编辑、删除、地图／站点／车辆关联、任务→动作的多级展开、动态嵌套表单和参数顺序。复制独立受MISSION_FLOW_COPY（mission-flow:copy）控制；按源实现回填模板及嵌套数据，草稿与源记录隔离，校验后调用createOrderTemplate，不调用更新接口。复制后源模板不变；身份字段沿用源创建契约，不擅自清空业务字段或改用更新语义。 |
| P21 | 工艺管理 /mission-cluster/mission-flow | 查询、创建／重发工艺、模板选择、触发类型及 Cron 编辑、主流程与子流程控制、展开子流程。 |
| P22 | 避障模板 /mission-cluster/obstacle-avoidance | 查询、增改删、模板参数编辑、展开参数和全部原校验。 |
| P23 | 车辆动作 /mission-cluster/action-control/agv-action | 查询、增改删、动作参数动态增删及参数类型校验。 |
| P24 | 动作分组 /mission-cluster/action-control/agv-action-group | 查询、增改删、动作选择及源系统已有分组操作，顺序和业务标识不丢失。 |
| P25 | 版本管理 /system-involve/version-control | 版本列表、zip上传、真实进度／速度／预计时间、取消、删除待用包、包下载、重启、回滚；上传成功不能自行触发重启。 |
| P26 | 系统日志 /system-involve/system-log | 日志类型查询、搜索分页、原有勾选与下载行为；批量范围清楚。 |
| P27 | 系统设置 /system-involve/system-setting | 原图片位置配置、查询预览、上传、更换后刷新关联外壳／登录显示，权限校验。 |
| P28 | 操作日志 /system-involve/operation-log | 原筛选、时间区间、服务端分页、全部日志字段及长文本查看。 |
| P29 | 软件信息 /system-involve/software-information | 许可证信息、硬件／有效期等源字段、软件激活及反馈。 |
| P30 | 数据库备份 /system-involve/database-backup | 数据库选择、备份文件列表、单文件下载；菜单与直访统一使用system:database-backup:view，下载另受system:database-backup:download控制。不新增恢复、删除备份或创建备份能力。 |
| P31 | 用户管理 /access-management/user-management | 源 AccessManagement 实现：分页、新增、删除、启停、密码重置、分配角色；root特殊限制完整。 |
| P32 | 角色管理 /access-management/role-management | 分页、增改删、权限分配、权限树原有三态交互；隐藏模块授权保留。 |
| P33 | 任务统计 /analyze-visual/order-statistics | 任务数量与效率统计、车辆和日期等原筛选、图表、提示和单位。 |
| P34 | 实时看板 /analyze-visual/dashboard-realtime | KPI、趋势、排行及原实时内容、五秒轮询、空数据与连接状态，使用真实仓储适配。 |
| P35 | 任务统计报表 /analyze-visual/dashboard-task | 当前实际查询控件与统计区间、任务统计、车辆利用率等原有图表和明细。不能照搬已过时的“固定天数”注释删掉查询能力。 |
| P36 | 故障告警 /analyze-visual/dashboard-fault | 原筛选、统计与分布图、告警明细服务端分页；明细翻页不触发整张报表重查。 |
| P37 | 车辆状态统计 /analyze-visual/vehicle-status | 车辆状态／运行时间统计、原筛选、堆叠图与明细、单位换算。 |
| P38 | 任务详情 /order-info | 应用内按任务身份分开的页签；主信息、任务子列表服务端分页、动作展开、合法直访及返回。 |
| P39 | 车辆详情 /vehicle-info | 应用内按车辆身份分开的页签；原状态描述字段和合法直访；各车辆状态相互隔离。 |
| P40 | 服务器资源 /analyze-visual/server-resource-monitor | 保持独立全屏、CPU／内存／磁盘等原指标与趋势、两秒轮询、连接状态、时钟；返回按§8.1排除自身及别名，无其他可返回页面时提供退出登录。菜单别名 /analyze-visual/server-resource 保留鉴权及 replace 跳转；进入全屏不销毁已有页签草稿。 |
| P41 | 无权限 /no-permission | 无可访问业务时明确提示，允许退出／重新登录，不循环重定向；仅拥有暂缓模块权限时明确提示“暂无本轮可用业务页面，相关模块将在下一轮实现”，不误报账号没有任何权限。 |
| P42 | 未匹配路径 /* | 真正未匹配路径显示404与安全返回；三个暂缓模块保留已注册路由，按§1.2显示暂缓提示，不落入404。 |

保留目录分组的顺序、名称与关系，Dock按当前视觉呈现，三个暂缓菜单按§1.2显示，过滤无任何可访问子项的空分组。/、目录默认入口、登录成功、激活成功、404及暂缓提示页返回均选取当前用户第一个有权且本轮已实现的业务页面，跳过暂缓模块；没有本轮可用入口则进入/no-permission并按P41区分无权限与仅有暂缓模块权限。特权账号本轮也不固定进入 /over-look 或额外仪表盘。服务器全屏页的返回另按§8.1排除自身和别名，不能直接复用可能返回自身的默认首页规则。

## 5. 技术架构与迁移约束

### 5.1 分层

- pages：页面入口与布局组合；文件与目录同名，禁止新增 index.tsx 作为实现。
- features：业务表单、列表列定义、业务 Hook、图表与领域适配。
- services：按领域拆分请求、DTO、旧协议适配；不得从页面目录反向导入类型。
- types：业务实体和页面消费的领域类型。
- components／hooks：不携带调度业务规则的复用能力。
- router：继续以 definitions 单一来源派生访问、渲染、菜单；不能另建一份手写路径／权限菜单镜像。
- store：认证、权限快照、页签元信息及确需跨组件共享的状态；大批分页数据不持久化。

不迁入 Umi 运行时；useModel、history、Umi request、Umi access及locale均换成当前框架对应能力。不保留两套运行时身份系统。遵守现有 check:structure 导入方向与命名门禁；需要调整门禁时只针对明确的新公共能力，不关闭整体检查。

新增和修改代码必须有多行简体中文注释，说明业务意图与关键边界；不主动格式化无关代码，不执行全仓自动格式化。当前任务不创建业务代码；这些约束适用于后续实施。

### 5.2 依赖与打包

- antd：确定实施时最新稳定版并锁定具体版本及 pnpm lock；调研基准6.6.4。不是运行时追随 latest。
- React／React DOM保持当前项目匹配版本；组件库和消费项目避免重复 React、antd 或不同 ConfigProvider 上下文。
- ApexTableReact：源码在独立目录维护；联调用本地构建包；交付依赖必须来自 npm 明确版本，不能残留绝对路径 link/file或未交付包。
- 组件库发布由用户执行。本规格不授权自动 npm publish。
- 旧 ECharts 图表保留业务定义并适配当前主题；旧地图选点依赖如 react-konva必须检查 React 19兼容性，不能直接复制 React 18专用依赖版本或忽略 peer错误。
- 禁止通过 iframe嵌入旧项目来替代迁移，禁止生产分支回退为 mock数据假成功。
- 图表、选点及重型弹窗按路由／功能惰性加载；暂缓模块的专用依赖本轮不加载，不因延期删除其源码或契约。本轮节点映射选点等共享能力仍正常接入所需依赖。

## 6. HTTP、DTO 与旧后端协议

### 6.1 统一请求风格，保留线上契约

继续通过当前项目请求基础设施与 services分域调用，统一 typed Promise、RequestOptions.signal、错误转换和 UI反馈。旧协议解析集中在请求／service边界；页面和业务Hook不重复检查 res.code、res.message或直接发起 fetch／XHR。

必须保留原接口完整路径、GET／POST／PUT方法、query与body位置、multipart字段、参数命名与枚举。例如旧系统删除可能为POST，不能为追求 REST风格改成DELETE。/fms与/rcsFlow请求不能自动前置 /api/v1。

分页在适配层转换：

- ApexTable pageIndex从0开始；旧接口pageNo通常从1开始。
- 旧响应records／current／size／total映射到领域items／page／pageSize／total；供表格request模式时再映射为data／rowCount。
- 不强制所有接口采用同一种旧分页形状。任务详情missionPage与订单主记录必须分别映射。
- 服务端分页不能只对当前页执行“全局排序／筛选”。仅开放真实支持的排序筛选，原本全量本地列表可按源行为本地处理。
- 超出当前页、删除最后一条、total变化时回到有效页码；筛选变化回第一页。
- ID用于行身份时可规范为字符串；发往后端仍保留字段契约，避免大整数精度损失或随意数值转换。

普通JSON与二进制响应需分开处理：下载要保留响应头、文件名、状态；binary响应可能实际上是JSON业务错误，不能保存为损坏文件。重复错误提示需去重；主动取消查询不弹错误，写入及上传的取消必须按§6.3、§9.1保留可见状态，不能一律静默吞掉。

旧成功语义以各接口的实际契约为准。源系统大量采用code===200且message==="success"，迁移先保留并集中处理；不因升级国际化自行放宽或改变业务成功判断。若真实环境文案与成功条件冲突，记录接口差异后处理。

### 6.2 认证和软件授权

- 登录、退出、用户详情来自旧后端。登录密码按源有效代码的MD5处理及编码规则发送，不擅自替换密码协议。
- Authorization最终只包含一份Bearer前缀，不能对已带前缀token重复拼接。
- 会话需支持刷新页面后按旧协议恢复有效登录；使用明确的存储结构和异常解析兜底，不存储密码。恢复时重新核对权限／身份，不只相信缓存用户对象。
- 当前Cookie刷新及 /auth/refresh重放逻辑不用于旧token，不启动两套认证。
- HTTP认证失败及旧业务码1000000统一触发一次失效处理，清token、权限、业务缓存、草稿、选中项、页签会话及任务状态；停止轮询，取消普通写入的前端等待及可取消传输，跳登录，不无限跳转。
- 失效期间的操作不得在重登后自动重发。不能把“取消前端请求”描述成后端已撤销执行。
- 1001000或登录activated===false进入软件授权流程；业务中途失效按§9.1暂停受保护活动，授权成功后重新核查身份与权限，通过后恢复仍有权的内存草稿及入口，不自动重发写入或续传。区分“未激活”和“没有菜单权限”。
- 请求携带当前语言；任何确需WebSocket的保留功能使用相同身份与语言策略，仅有消费者时连接。不能因原app的全局Provider而保留无用监控连接。
- 协议、Host、WebSocket地址通过环境配置，支持生产HTTPS对应WSS；不得硬编码10.11.2.67。

### 6.3 修改、失败与并发

- 同一动作提交期间防止双击，确认文案包含对象和动作，保留源必要的原因输入。结果待确认时保留对象、动作、提交时间及可用的查询入口；用户须先核查现状，若仍未知则明确确认重复执行风险后才能再次手动发起，不能把超时当作可直接重试的失败。
- 查询允许可控重试；写入、设备指令、推图、重启、回滚和上传不自动重试。
- 网络超时、响应丢失或已发送写请求被前端中止时显示“结果待确认”，优先重新查询资源／记录；没有可查询证据则保持未知，不承诺已执行或未执行。仅能证明请求尚未发出时才可判定为未提交。
- 批量操作有分项返回则区分成功、失败、未知；只有整体结果则如实展示，不能从HTTP200推断每辆车成功。
- 后端明确拒绝、状态冲突或权限拒绝时展示原因、刷新受影响数据；不伪造后端不存在的乐观锁或幂等支持。
- 保留表单输入以便处理可恢复错误；轮询结果不能覆盖正在编辑的草稿。
- 多查询竞争使用AbortSignal和过期响应防护，旧条件结果不能覆盖新条件；卸载后不能继续更新页面状态。

普通写入（保存表单、设备指令、权限提交等）与文件传输分别使用会话内任务控制器，均不得绑定隐藏页签时会清理的查询AbortSignal。任务按账号会话及所属页签记录状态，UI只订阅；切页和进入全屏后继续接收回执，成功或明确失败更新任务及对应草稿状态，失去回执转为待确认。失效会话的迟到响应不能写入新账号或新会话。关闭／刷新所属页签、退出及权限变化统一按§9.1处理，不新增全局操作中心。

### 6.4 车辆批量操作范围

保留旧allVehicleOperate的两种契约，以两个明确标注范围的入口呈现；均受VEHICLE_LIST_BATCH_OPERATE（vehicle-list:batch-operate）控制：

| 入口 | 确认范围 | 提交契约 |
| --- | --- | --- |
| 操作勾选车辆 | 跨页累计的明确车辆Key、名称及去重数量；空选择时禁用。确认前校验对象仍存在且可操作，范围变化后重新确认。 | 提交operate及非空vehicleKeys；不能因选择清空而省略该字段。 |
| 操作全部车辆 | 与当前筛选、分页、勾选均无关；明确提示执行时后端全部车辆均可能受影响。通过现有pageVehicles按空查询逐页获取完整清单，展示去重Key、名称、数量及查询时间，不以当前页或筛选后的total冒充全部车辆。 | 沿用源全量协议，只提交operate，省略vehicleKeys；不发送空数组，也不偷偷替换成快照Key列表。 |

全量清单获取失败、分页结果不完整、数量不一致或无法确认覆盖后端全量范围时，禁止确认该次全部车辆操作，允许重新查询；不得显示估算清单并继续提交。确认前重新核查清单，已观察到变化则更新并重新确认。清单是查询时快照，旧接口没有锁定成员的能力，必须明确执行时成员可能变化，不能承诺仅作用于快照对象。发现列表可见范围与全量控制范围不一致时，记录契约阻塞项，不擅自新增后端能力或缩小全量语义。清空勾选、修改筛选、取消确认均不会自动触发或切换到全部车辆操作。成功后沿用旧行为清空已消费选择并刷新列表；失败或结果未知按§6.3处理。

## 7. ApexTableReact 接入与能力补齐

### 7.1 替换范围

所有业务数据表格，包括主列表、弹窗表、展开子表、详情任务／动作表、参数编辑表和图表旁明细，统一使用ApexTableReact。不得以保留antd Table、ProTable或手写同类数据表规避。

antd Tree、Descriptions、Form、Transfer等非业务表格控件可以继续使用。业务权限和请求协议留在当前项目，不写入开源表格库。

### 7.2 必须覆盖的表格能力

| 能力 | 需求与验证 |
| --- | --- |
| 服务端分页 | 0/1页码转换、后端总数、页大小、空页回退、取消和过期响应。 |
| 固定列与滚动 | 宽表横向滚动、固定操作列、表头、容器尺寸变化、隐藏后重新显示无错位。 |
| 展开行 | 车辆分组、地图关联、点边组合、地图推送、避障参数、工艺流程等展开详情。 |
| 多层嵌套 | 任务工艺→任务→动作和任务详情→动作；各级行身份、分页、滚动、加载相互独立。 |
| 选择 | 稳定业务rowId、跨页选择、当前页全选、筛选清空、已选清单；表头选择不提供“全库全选”。独立的全部车辆业务操作按§6.4处理，不由空勾选推导。 |
| 编辑 | 调度配置类型控件、节点映射及其他原有编辑表；失焦／确认只更新本地草稿，原批量保存语义保留。 |
| 行高与虚拟化 | 展开详情高度不能按主行固定高度错误计算；需要动态测量、独立详情布局或经验证的分页范围内非虚拟模式。 |
| 列设置 | 宽度、显隐、顺序、固定与密度使用组件公开接口，仅会话内记忆，提供恢复默认。 |
| 反馈 | 初次加载、刷新、空结果、业务错误、重试、禁用与权限只读。 |
| 主题语言 | 当前主题令牌映射、五语locale、长文案截断与完整查看、键盘焦点可用。 |

优先验证已有展开行改动；仅补齐迁移实际需要的通用能力，不为假想需求建设完整分组引擎。多级表头、树形数据若有效页面确需则补齐，否则不作为额外库功能交付。嵌套表格展开不等于树形row model，二者不能混为一谈。

本地编辑采用库支持的data与onDataChange模式；不要强行让只读request入口承担不支持的编辑。每张列表只能有一条清晰的请求与轮询链，避免组件request和页面Hook各请求一次。

每行使用真实稳定标识；草稿行使用仅供前端的稳定ID，提交时去掉该辅助字段。不能用数组下标作为会移动、删除、分页或展开的行身份。

### 7.3 性能边界

常规分页≤200行，但不能将此解释为裁掉旧功能。节点映射源码标明存在万行级本地编辑场景，需要单独核验其虚拟化、选点、建议回填和校验，不把数据硬截为200条。通过分页／虚拟化控制DOM，不改变保存数据的完整性。

密度变化和展开内容必须同步滚动测量；不得出现遮挡、空洞、滚动跳至错误对象、键盘焦点消失。鼠标点击子表操作不应误触父行展开或选择。

## 8. 路由、权限与导航

### 8.1 路由行为

保留业务路径，包括vehicle-diplay、charge-pie等既有拼写；不额外重命名。使用BrowserRouter并要求部署对非API前端路径回退index.html。

任务和车辆详情按“路由+业务对象标识”区分页签，同对象重复打开聚焦已有页签，不同对象独立缓存。目标查询参数规范为orderTaskKey或vehicleKey；旧详情曾使用裸query字符串，至少兼容该已有参数形式再规范化，不把整个query误作对象ID。缺失／非法参数显示明确错误，不发送undefined查询。

详情不放入菜单，受对应列表查看权限保护。服务器资源全屏独立布局但仍受认证和SERVER_RESOURCE_MONITOR_VIEW保护；菜单别名使用replace。全屏返回优先使用应用内记录的仍有权来源业务页，来源失效或缺失时选取首个其他有权业务入口；候选须按最终路由身份排除全屏本身及其别名。没有其他候选时留在全屏页，以“退出登录”替代“返回”，执行主动退出保护流程，不跳/no-permission、不循环跳转。来源只能来自应用内导航记录，不能信任任意外部returnUrl或无条件history.back。

进入全屏、暂缓提示、404或无权限提示页属于同一登录会话内的视图切换，不能销毁仍有权页签的缓存宿主。缓存宿主及普通写入、传输任务管理应位于布局切换之上的稳定会话层；这些页面可以隐藏外壳，但隐藏页暂停查询、保留草稿与选中、继续既有写入和传输。业务中途转入软件授权页及权限撤销按§9.1处理。菜单、程序跳转及浏览器前进／后退均须遵守相同规则；整页刷新／关闭使用浏览器离开保护。

三个暂缓模块继续注册在definitions中并保留原菜单位置和权限关联，以明确的本轮暂缓状态派生菜单标记、暂缓提示及默认入口过滤，不另建一份路径镜像。直访通过认证和对应权限校验后显示“下一轮实现”，不调用模块业务接口。旧页签若指向这些路由，应落到同一暂缓提示；启动迁移时调整固定首页和旧缓存状态，不删除模块定义或将其伪装成已完成页面。

### 8.2 权限规则

- 菜单权限与按钮权限维持原数据源区分：permissionsTree与平铺permissions不能互相兜底。菜单集合沿用源祖先填充：拥有叶子菜单码时，从definitions派生其父级分组，不因后端缺少祖先节点而拒绝该叶子；仅拥有父级不自动获得子页访问权。
- 本文“root规则／root专属”指冻结源码isRootUser的实际判定：已登录且身份确认后，username为root或administrator均走特权分支；不照搬“只有root”的旧注释收窄行为。特权账号放行保留页面及按钮；其余账号即使持有auth:user:view或auth:role:view，也不得进入原特权专属用户／角色管理页。具体业务中对目标用户root的删除、启停等限制仍按源动作规则单独保留。
- 菜单、直接路由、详情、控制动作均按同一权限模型约束；隐藏入口不是唯一防线。
- 无权限动作入口隐藏；承载状态信息的Switch、编辑单元格退为只读／禁用，仍显示真实状态，符合旧规则。
- 载具类型菜单及直访统一要求carrier:view，父级为vehicle:manage；数据库备份菜单及直访统一要求system:database-backup:view，父级为system:manage，下载另要求system:database-backup:download。普通用户有叶子码即可经祖先填充访问，仅有父级码或按钮码均不能访问；特权账号按上一条放行。这是对源.umirc.ts遗漏access的明确修正，纳入差异清单，不再留给实施者另选策略。
- 接口403不当作登录失效反复登录；提示无权并刷新权限快照，核验期间阻止被拒动作重发。新快照确认撤销页面权限时，按§9.1清除该页受保护状态；仅撤销按钮权限时保留有权查看的页面和草稿，将相应动作隐藏／禁用，不允许提交。账号切换清除旧账号缓存。

本轮权限编辑暂时隐藏三个暂缓模块及其专用后代，保留完整节点定义，下一轮实现时恢复编辑；这不影响按现有授权展示暂缓菜单和校验直访。以完整已分配ID集合为基线，区分“允许编辑的可见集合”和“隐藏原有授权集合”；提交合并可见选择与隐藏原有授权。可见全选／清空仅影响可见节点，不撤销隐藏节点。

隐藏前保存原有父子语义，避免半选父节点推导改变旧授权。若角色读取失败或完整既有授权不可得，禁止提交一个不完整全量集合。未识别的后端权限节点不能擅自丢弃；保留现值，记录核对项。

## 9. 页签、草稿、实时数据与状态

### 9.1 状态生命周期

| 事件 | 查询／展示 | 草稿／选中 | 普通写入 | 文件传输 |
| --- | --- | --- | --- | --- |
| 切换应用页签／进入全屏、暂缓提示、404、无权限提示页 | 隐藏页停止查询和轮询，保留有权缓存宿主 | 保留内存草稿和当前选择 | 会话任务继续接收回执 | 独立控制器继续传输 |
| 返回页签 | 按原策略立即刷新；重新测量图表表格 | 不覆盖未保存草稿；校验已选对象是否仍可操作 | 展示最新执行结果或待确认状态 | 恢复显示当前进度 |
| 修改筛选 | 回第一页，取消过期查询 | 清车辆跨页选择 | 不改变已提交对象及任务 | 不影响独立已发起传输 |
| 主动关闭／刷新页签 | 保护流程完成后清对应查询和缓存 | 有草稿先确认放弃 | 运行中或待确认先执行下述离开确认 | 有可取消传输先提示取消 |
| 浏览器刷新／关闭 | 浏览器原生离开提示能力范围内保护 | 不承诺恢复；确认离开则丢弃 | 不承诺接收回执；重开不自动重发 | 不承诺跨浏览器刷新继续或断点续传 |
| 主动退出 | 先完成草稿／普通写入／传输确认，再退出清会话 | 清除 | 停止可取消等待，不承诺后端撤销 | 可取消传输中止；原生下载按浏览器能力 |
| 认证失效 | 立即停止受保护活动并返回登录 | 立即清除，无恢复 | 取消可取消等待并清记录，不自动重发 | 中止可取消任务，不自动续传 |
| 软件授权失效（1001000） | 立即转授权页，暂停全部业务查询及操作，保留不可访问的会话缓存 | 身份仍有效时仅在内存保留，不能在授权页查看／提交 | 中止可取消等待，已发送但无回执转待确认 | 中止可取消传输，已发送但无成功证据转待确认 |
| 新权限快照撤销页面权限 | 立即关闭并清除该页缓存及查询，提示权限已变更；其他有权页不受影响 | 清除被撤权页的草稿／选择，不以确认框阻止撤权 | 中止可取消等待，告知已发指令结果可能未知，不自动重发 | 中止可取消传输，不承诺后端撤销 |
| 缓存淘汰 | 仅释放可安全重建的页面实例及大批查询数据 | 有草稿页不能淘汰；干净页的轻量查询／选择状态另存会话 | 运行中或待确认的所属页不能自动淘汰 | 有传输页不能自动淘汰 |

普通写入的离开确认提供“留在页面等待／核查”与“停止等待并关闭／刷新／退出”。后一项必须明确列出对象、动作、执行中或待确认状态，说明停止等待不能撤销后端执行，用户确认后才清除所属任务记录和页面；已知结果正常显示，未知结果不能标成失败或已撤销。取消查询不报错的规则不适用于此状态提示。软件授权恢复后先重新核查身份和权限，仅恢复仍有权草稿及查询，不自动恢复写入／上传；待确认任务继续供手动核查。认证失效优先于其他保护流程；页面权限撤销直接清除该页状态并说明原因，不等待放弃草稿确认。

表格偏好不写localStorage，不跨浏览器会话恢复；采用内存会话状态，整页刷新可回默认。页面查询条件、分页、展开ID和选中ID等轻量状态保存在独立于可淘汰页面实例的页签会话中；LRU重建时恢复并核验对象，不保存大批查询结果来规避缓存上限。关闭／刷新页签清其状态，账号切换／认证失效全部清除。主题和语言沿用外壳机制，不得由持久化设置带回业务数据。

约10页签为正常使用目标；采用现有缓存上限并核验不少于目标的合理容量。有可淘汰干净页时继续LRU；草稿、运行中／待确认普通写入和文件传输均构成保护条件。全部受保护且容量不足时，在创建／替换页面前提示处理任务、保存或关闭，不先导航后丢状态。无稿初始值不能误标为脏；保存成功、重置确认只解除对应草稿保护，不能解除仍在执行的任务保护。关闭其他／关闭全部等批量操作先统一检查和确认，取消时不部分关闭；全部导航入口遵守§8.1。

### 9.2 实时数据

- 任务记录和状态统计：保留旧1秒轮询。
- 实时看板：每次请求结束5秒后下一次。
- 服务器资源：每次请求结束2秒后下一次。
- 其他页面按当前有效实现，不因为名字包含“状态”就擅自增加轮询。
- 应用页签可见且document可见才轮询；恢复后立即请求，不积攒隐藏期间任务。
- 同一查询不并发堆叠，离页／卸载取消可取消查询；重复失败不每秒堆叠toast。
- 初次加载失败与空数据区分；实时源失败保留源页面降级语义并明确连接失败／未更新，不能把假0当作真实0，不能让旧快照冒充当前状态。
- 轮询不重置用户筛选、分页、展开、滚动或已选项；记录确实删除时安全回退并提示。
- 任何保留WebSocket消费者采用按需连接／取消订阅，断线恢复显示状态，不重发设备控制指令。

## 10. 上传下载与长操作

### 10.1 上传

复用旧字段和扩展名约束，版本包只接受.zip且在选择器之外再次校验。地图与告警文件采用其实际类型约束，不凭扩展名假定已成功解析。

传输状态至少区分：准备／连接、上传中、服务端处理中、成功、失败、已取消、结果待确认。有真实字节总数才显示百分比；无总数显示不定进度。上传字节100%后须等待服务端业务成功响应，不能立即提示成功。“已取消”仅说明前端停止传输；已有数据发往后端且执行结果不明时，业务结果仍须标为待确认，不能据此宣称后端未执行。

版本上传保留实际速度、ETA、可计算总量判断和原60秒连接／停滞处理；不能使用普通15秒JSON超时截断所有大文件。服务端处理阶段单独处理超时语义，不在请求体完成后错误触发上传停滞。

切换页签继续上传，传输控制器独立于页面查询和隐藏Effect；UI仅订阅状态。关闭页签先提示取消，刷新／退出同样处理。不新增用户可见全局传输中心，不承诺断点续传。

### 10.2 下载

大文件优先浏览器原生下载，保留文件名与后端Content-Disposition；对要求Authorization头的接口不能随意改成裸a链接，亦不能把长期token放URL。已有GET下载协议不为沿用过时封装改回POST。

已发现数据库备份页面实际使用GET原生下载，但旧api/index.ts残留同URL的POST封装。迁移以有效页面的GET契约核验实现，该POST封装不构成必须复制的业务功能。

接口若只能通过带header的POST二进制响应下载，继续兼容；记录内存与大文件限制，不假称支持浏览器原生流式。若需后端短期下载URL支持，列为外部依赖，不擅自改后端。下载交给浏览器后只提示“已开始下载”，不能据此提示“下载完成”，也不能保证前端能取消其下载。

Excel导出等不因分页表格只加载当前页就截断数据；范围遵循旧导出接口参数。不要凭页面缓存拼接一个缺失其他页的“完整导出”。

## 11. UI／UX、国际化与数据语义

### 11.1 视觉与操作

- 保留当前外壳，业务区使用当前间距、颜色、圆角、字体和主题令牌；不要求旧系统像素级一致。
- 保留所有业务字段与操作层次；空间不足可重排或放入原有详情／弹窗，不得以适配名义删字段或改变提交含义。
- 在1366×768完整操作查询、分页和主要按钮；宽表只在表格区横向滚动，不造成整个外壳溢出。
- 长文本可省略但能查看完整内容；错误信息、禁用状态不能仅靠颜色区分。
- 弹窗支持合理滚动、键盘焦点、校验定位；点击蒙层／Esc同样遵守未保存提示。
- 浅色／深色均覆盖表格、弹窗、菜单、图表tooltip、滚动区和既有选点控件；全屏大屏可保留专属色板，但必须保证清晰可读与主题边界。
- 图表在隐藏恢复与resize时重新计算尺寸，卸载dispose；不得重复创建实例泄漏监听器。
- 当前登录视觉保留，同时仍可通过旧系统图片配置展示相应资源，加载失败使用本地默认资源。

### 11.2 五语与时间

沿用react-i18next按命名空间组织，迁移旧词条并补齐新增确认、结果未知、传输阶段、表格设置等文案。同步antd locale、dayjs locale、ApexTable locale及图表标签，切换语言不重置正在编辑的业务数据。

业务名称、节点标识、任务Key、后端自由文本不作为翻译key批量翻译。枚举显示名称可本地化，但请求枚举值不变。Accept-Language与界面同步；异步旧语言响应不能覆盖新界面文案。

统计口径、单位和空值按旧有效实现／后端契约保持。源报表并非统一时区：默认区间、快捷选择、手动输入、请求序列化和图表分桶必须分别核对，不能用全局Asia/Shanghai或浏览器本地时区覆盖所有页面。本次迁移保留以下实际行为，不顺带统一时间口径：

| 页面／环节 | 已核实源行为与目标规则 |
| --- | --- |
| P33任务统计 | 数量／效率页初始startTime、endTime为空；DatePicker选择后的dateString直接作为请求值，清空仍按源契约传空值。不额外转UTC、加时区偏移或套用近七日默认区间。 |
| P34实时看板及DashboardShared时间工具 | businessTime.ts的自然日边界和时间桶使用Asia/Shanghai；保留各实际调用点的分桶及时间标签逻辑。桶边界ISO值、带偏移快照时间和界面标签分别适配，不能仅因共享工具存在就推断所有标签及输入都已转换为上海时区。 |
| P35任务统计报表、P36故障告警 | 页面默认区间使用dayjs.tz(..., Asia/Shanghai)；共用TimeRangePicker的快捷区间却使用浏览器本地dayjs()，手动输入沿用选择器产生的时间值。请求对选定值直接format为YYYY-MM-DD HH:mm:ss，不附偏移、不另做时区转换。故障明细的起止过滤字段沿用相同的选值序列化方式。该混合行为须如实保留和记录，不能把“默认区间采用上海时区”扩大为全部输入已统一。 |
| P37车辆状态统计 | 默认近七个自然日及快捷区间按浏览器本地时间计算；手动输入沿用选择器值；startTime、endTime按YYYY-MM-DD HH:mm:ss发送，不强制转换为上海时区。保留按小时查询的24小时上限校验及原分母计算。 |

自然日快捷区间沿用源起日00:00:00到止日23:59:59的请求精度；源图表采用左闭右开时间桶时保留其边界，不能与接口结束时间互换。无偏移的请求时间字符串不能被适配层自动解析成UTC再序列化。跨日、零分母、缺失值、未知枚举、开始晚于结束、没有上一期比较值都要有确定展示。未知不是零，无效数值不渲染NaN／Infinity。

修正明确前端问题（如小数范围误用整数解析、重复提示、失效入口）记入差异清单；改变统计分母、状态分类、后端参数解释，或统一上述混合时区、改变默认／快捷区间均属业务口径变化，须另行确认后更新本节。迁移验收在Asia/Shanghai和至少一个非上海浏览器时区，以相同当前时刻和相同输入对照旧实现，记录实际请求与边界；不得仅在本机东八区通过就认定等价。

## 12. 实施分段与交付物

以下分段用于本轮依赖管理，本轮完成判定覆盖P01—P42及三个暂缓模块的入口状态。三个模块的业务实现与功能验收属于下一轮，不能将本轮完成表述为整个旧系统迁移完成。

1. 基线与基础设施：冻结源提交和本轮动作级清单、旧协议／认证适配、路由与明确的权限规则、语言主题；为三个暂缓模块保留路由／菜单／权限定义并接入统一暂缓提示。
2. 组件与生命周期：衔接ApexTable展开行、嵌套与编辑；跨布局页签草稿保护、轮询、普通写入及文件传输独立生命周期。
3. 基础业务：车辆、设备、地图列表与关联、权限管理及各类CRUD。
4. 复杂业务：任务控制和详情、节点映射、任务工艺／工艺管理、调度配置、文件与版本。
5. 统计与系统：图表报表、服务器全屏、系统设置、日志、软件授权和备份。
6. 整体验收：五语双主题、路由直访、故障分支、容量验证、真实测试环境写流程；切换最终npm版本后再验收组件相关链路。

实施交付物：当前项目源码、必要的表格库通用改动与文档、准确依赖锁文件、环境配置说明、页面／接口迁移对照、已修复差异清单、浏览器实测记录、检查结果和仍待外部条件的验收项。三个暂缓模块须记录下一轮源入口、相关契约及共享依赖边界；本轮仅验收其暂缓状态，不把提示页记为业务已实现。不要把临时包、假数据或本轮必需接口的空实现作为最终交付。

## 13. 验收标准

### 13.1 静态与构建

- 当前项目pnpm check通过（lint、typecheck、check:structure），pnpm build通过。
- 不新增Umi运行时依赖，本轮实现页面不残留业务antd Table／ProTable使用；三个暂缓模块保留路由／菜单／权限定义，入口只展示暂缓状态，不执行其业务请求或加载专用运行时。
- 正式依赖锁定已发布ApexTableReact版本及已核实antd稳定版本，在不依赖开发者绝对路径的环境可安装构建。
- 组件库修改完成其现有适用类型／构建／检查，并验证代表性嵌套、编辑、选择和尺寸变化演示。
- 不要求新建自动化测试体系；采用用户选择的清单及浏览器实测。组件库现有AGENT.md另写明不新增E2E／单元测试，实施时遵守其有效规范。

### 13.2 浏览器功能验收矩阵

| 编号 | 场景 | 通过标准 |
| --- | --- | --- |
| A01 | P01—P42动作级逐项 | 实施前冻结的字段、筛选、动作、表单和子层级逐项有证据；特别验证P20复制权限、嵌套数据回填、创建接口及源模板不变，以及P05调度启停等复用接口的独立动作。 |
| A02 | 正常登录、未激活、过期 | 旧接口接通；分流正确；无刷新token误请求。业务中途1001000暂停查询／写入／传输，激活后重新核查身份权限，只恢复有权草稿；1000000及HTTP认证失效立即清业务状态，迟到回执不能污染重登会话，不恢复写入／续传。 |
| A03 | 普通用户、特权账号、无权用户 | 分别验证root和administrator的源特权规则。P06、P30覆盖有叶子码无父级、有父级无叶子、仅有按钮码、无权限及直访；有备份查看权限无下载权限时能看不能下载。普通持auth管理码者仍不能进入特权专属页；无权详情与全屏不可访问。新快照撤销页面权限时清除该页状态，仅撤销按钮权限时阻止对应动作。 |
| A04 | 暂缓模块与本轮入口 | 三个菜单按原权限展示并标注“下一轮实现”；直访同样鉴权，通过后显示暂缓提示而非404，不发模块业务请求、不加载专用运行时。默认首页及登录／激活／404返回跳过暂缓模块；仅有暂缓权限时提示准确。地图版本查看／编辑入口按权限显示为暂缓禁用，其他地图功能及节点选点正常。 |
| A05 | 权限保存 | 本轮权限编辑暂时隐藏三个暂缓模块节点，定义及既有授权保持；编辑可见权限或可见清空不连带撤销隐藏授权，下一轮可按原节点恢复编辑。 |
| A06 | 任务与车辆多详情 | 至少两个不同任务、两个不同车辆同时打开；内容、分页、返回、关闭相互独立。 |
| A07 | 分页／筛选／竞态 | 第一页、末页、删除末项、空结果、快速切筛选、慢响应覆盖均正确。 |
| A08 | 勾选车辆与全部车辆操作 | 跨两页勾选、当前页全选、改筛选清空正确；空勾选不能提交勾选操作或自动转全量。带筛选时全量确认仍展示独立取得的全部清单，失败／缺项／范围不明阻止提交，观察到成员变化须重确认；明确快照不能锁定执行成员。核查勾选请求传非空vehicleKeys、全量请求省略该字段，取消确认不发写请求；部分／未知结果均可验证。 |
| A09 | 草稿、跨布局导航与容量 | 编辑中经菜单、程序导航或前进／后退进入全屏、暂缓提示、404再返回，草稿不丢；关闭／刷新／退出提示，批量关闭取消不部分执行。有稿、普通写入运行中／待确认或有传输页均不淘汰；容量不足先提示；干净页LRU重建恢复查询／分页／展开／选择；认证失效及页面撤权按各自规则立即清理。 |
| A10 | 展开表与编辑 | 工艺三级内容、详情动作、分组成员、推送记录、避障参数无错位；展开身份和保存语义正确。 |
| A11 | 普通写入与设备／地图／版本控制 | 保存表单、权限提交、设备指令发出后立即切页／进全屏，回执仍被正确记录；关闭／刷新／退出须确认停止等待及未知风险。模拟已执行但回执丢失，显示待确认、可查询、不自动重发；待确认时再次手动提交须核查并确认风险。防双击；真实操作仅在授权测试环境。 |
| A12 | 实时与保活 | 可见按1／5／2秒原频率，隐藏不轮询，恢复立即刷新；10页签无重复轮询链和显著资源持续增长。 |
| A13 | 文件与大操作 | 上传失败／取消／处理中可辨；切页继续；关页提示；下载文件有效；二进制错误不是坏文件；不伪造完成。 |
| A14 | 统计语义与时区 | 同一数据和当前时刻，在Asia/Shanghai及非上海浏览器时区分别核对P33—P37默认区间、快捷选择、手动输入、清空、请求字符串、午夜跨日和图表桶边界；保留§11.2的混合行为，不能静默统一。指标、单位、分母与空值对照旧系统；差异符合D18。 |
| A15 | 多语言与主题 | 五语切换，浅深两色，弹窗／图表／表格控件不漏翻；两种目标分辨率无关键操作遮挡。 |
| A16 | 路由与部署 | 深层URL直访／刷新无服务器404，API不被index.html回退吞掉。全屏返回覆盖有效来源、来源失权、无来源、仅有服务器资源权限；排除自身及别名，无其他候选显示退出登录且无跳转循环，不误报为无权限。 |
| A17 | 性能与特殊数据 | 500辆车、200行页、约10页签；另验节点映射万行场景，数据不截断。记录机器、数据量、接口耗时及观察结果。 |
| A18 | 最终npm切换 | 与本地联调包相比不丢能力、样式、类型或语言；正式安装后关键链路复验。 |

全量行数“百万”是后端累计量，不要求浏览器一次加载百万条。没有提供硬件及延迟基准，因此不虚构毫秒级性能SLA；记录真实环境数据，要求正常操作可用、滚动无明显持续卡顿、无持续内存泄漏。对未知规模不暗中承诺无限容量。

### 13.3 完成判定

本轮P清单与A清单全部具备验证记录；本轮必需业务功能无占位、静默假成功、未知权限绕过、草稿静默丢失或生产mock兜底。§1.2三个暂缓模块允许统一提示页，其入口状态须通过A04，业务能力保持“下一轮待实现”，不阻塞本轮完成，也不计为已实现。测试环境未到位、最终npm版本未发布或本轮高风险写动作未授权时，相应验收仍待完成。仅当下一轮三个模块也完成各自业务验收后，才可宣称整体迁移完成。

本规格定稿不等于上述实现验收通过。

## 14. 已知差异、外部依赖与实施核查

| 项目 | 已定处理／依赖 |
| --- | --- |
| 测试地址和测试账号 | 用户另行提供，当前不连接配置里的旧地址执行设备控制／重启等。 |
| 表格库正式版本 | 用户发布含已验收能力的版本后，当前项目锁定；临时联调包不能最终交付。 |
| 表格库已有改动 | 工作区正在变化，实施先检查与衔接，不覆盖或回滚他人改动。 |
| 网关配置 | 需提供SPA回退及/fms、/rcsFlow代理；有WebSocket时另配升级转发。 |
| 下载契约 | 备份有效页面GET与旧POST封装冲突需按真实环境核对；不新增后端能力。 |
| 暂缓模块 | 调度监控、地图编辑、录制回放留到下一轮；本轮保留路由、菜单、权限及契约，展示暂缓状态，不删除已有相关源码，不接入专用业务运行时。 |
| 共享选点 | 本轮实现节点映射的既有地图选点及所需数据／渲染依赖；独立地图编辑器留到下一轮。 |
| 特权身份与默认跳转 | 按实际isRootUser保留root、administrator特权分支，不沿用“仅root”的旧注释；从固定/over-look改为首个可访问保留入口。 |
| 详情与全屏路由 | 详情改为应用页签并隔离身份缓存；全屏返回排除自身及别名，无其他候选提供退出登录；跨布局导航保留会话缓存宿主。 |
| 车辆控制范围 | 按§6.4分开勾选与全量入口，保留全量请求省略vehicleKeys的旧契约；展示完整查询快照及执行时成员可能变化的边界。 |
| 载具类型与备份访问 | 补齐carrier:view和system:database-backup:view菜单／直访门禁；父级不能替代叶子授权，备份下载另校验按钮码。 |
| 旧权限编辑 | 增加隐藏授权保留，避免全量提交误删。 |
| 上传模拟进度 | 换真实进度或不定处理中，不延用假百分比。 |
| 控制超时与回执丢失 | 以待确认取代单纯失败重试；普通写入独立于页面查询生命周期，离开前确认停止等待的后果，不扩建全局操作中心。 |
| 源注释漂移及时间口径 | 按§11.2保留各报表默认区间、快捷选择和序列化的实际混合时区行为，不以统一时区之名改变统计范围。 |
| 当前保活清理 | 查询随隐藏暂停，普通写入和传输独立；草稿、写入运行中／待确认、传输保护覆盖关闭、刷新、退出及淘汰，跨布局保留宿主。 |
| 后端不提供的能力 | 不伪造幂等、版本冲突检测、撤回、断点续传或写入成功结果。 |

## 附录A：有效页面与静态API依赖

下表由旧项目当前路由及本地导入关系只读提取，反映本轮P01—P42的保守依赖集合，不含三个暂缓模块的专用业务能力。只用于确保不遗漏本轮迁移，不用于自动生成页面请求；实现需按实际操作触发。暂缓模块的源入口和契约留作下一轮依据，不因未列入此表而删除。源入口路径相对于 `C:\code\dd\src\pages`。

| 页面编号 | 源组件 | 路由 | 依赖的API导出项 |
| --- | --- | --- | --- |
| P01 | Login | /login | detail、fetchSystemImage、login |
| P02 | AuthorizeIngress | /authorize-ingress | getHardwareInfo、softwareActivation |
| P03 | OrderRecord | /order-record | createOrderRecord、exportOrderRecords、getAGVActionGroups、getAgvActions、getCrossMapStations、getOrderRecordDetail、getSimpleMaps、getSimpleVehicles、getVehicleGroups、mockDispatch、orderRecordStateStatistic、orderTaskOperate、pageOrderRecords |
| P04 | VehicleDeploy/VehicleGroup | /vehicle-deploy/vehicle-group | addVehicleGroup、deleteVehicleGroup、getSimpleVehicles、pageVehicleGroups、updateVehicleGroup |
| P05 | VehicleDeploy/VehicleDisplay | /vehicle-deploy/vehicle-diplay | addVehicle、allVehicleOperate、deleteVehicle、getUnRelationSimpleVehicles、pageVehicles、updateVehicle、vehicleOperate |
| P06 | VehicleDeploy/VehicleType | /vehicle-deploy/vehicle-type | createCarrier、deleteCarrier、pageCarriers、updateCarrier |
| P07 | VehicleDeploy/NodeMapping | /vehicle-deploy/node-mapping | deleteAGVNodeMapping、getMapInfo、getSimpleMaps、getSimpleVehicles、getSuggestionsForCollectionNodes、pageAGVNodeMappings、saveAGVNodeMapping、updateAGVNodeMapping |
| P08 | SystemInvolve/AlarmCodeManagement | /vehicle-deploy/alarm-code-management | addVehicleAlarmCode、deleteVehicleAlarmCode、downVehicleAlarmCodeFile、pageVehicleAlarmCodes、updateVehicleAlarmCode、uploadVehicleAlarmCodeFile |
| P09 | MapThrough/MapList | /map-through/map-list | createMap、deleteMap、downloadMap、downloadMapInfo、getSimpleVehicles、pageMapInfoVersions、pageMapInfos、publishMapInfoVersion、pushMapInfoVersion、updateMap、uploadMapFile、uploadVehicleMap |
| P10 | MapThrough/CrossMaps | /map-through/cross-maps | createCrossMap、deleteCrossMap、getCrossMapStations、getElevators、getSimpleMaps、pageCrossMaps、updateCrossMap |
| P11 | MapThrough/PointEdgeCombination | /map-through/point-edge-combination | createSystemNodeEdgeGroup、deleteSystemNodeEdgeGroup、getAllSimpleNodeEdgeGroups、pageSystemNodeEdgeGroups、updateSystemNodeEdgeGroup |
| P12 | MapThrough/MapPushNotificationRecords | /map-through/map-push-records | cancelPushMap、pageMapPushRecords、rePushMap |
| P13 | DispatchHub | /dispatch-hub | batchEditConfigs、getTaskConfigs |
| P14 | TriDevice/Elevator_back | /tri-resource/tri-device/elevator | addElevator、clearElevatorOccupy、closeDoor、deleteElevator、getElevatorDrivers、getElevatorState、innerCall、openDoor、outerCall、pageElevators、updateElevator |
| P15 | TriDevice/AutoDoor_back | /tri-resource/tri-device/auto-door | addAutoDoor、autoDoorClose、autoDoorOpen、clearAutoDoorOccupy、deleteAutoDoor、getAutoDoorDrivers、getAutoDoorState、pageAutoDoors、updateAutoDoor |
| P16 | TriDevice/ChargePile/ModbusChargePile | /tri-resource/tri-device/charge-pie | addChargePile、deleteChargePile、getChargePileDrivers、pageChargePiles、startCharge、stopCharge、updateChargePile |
| P17 | TriResource/TrafficLights | /tri-resource/tri-device/traffic-lights | addTrafficLight、deleteTrafficLight、getTrafficLightDrivers、pageTrafficLights、testTrafficLight、updateTrafficLight |
| P18 | TriDevice/AirShowerDoor_back | /tri-resource/tri-device/air-shower-door | addAirShowerDoor、airDoorClose、airDoorOpen、clearAirShowerDoorOccupy、deleteAirShowerDoor、getAirShowerDoorDrivers、getAirShowerDoorState、pageAirShowerDoors、shower、updateAirShowerDoor |
| P19 | TriTraffic | /tri-resource/tri-traffic | addTripartiteTraffic、deleteTripartiteTraffic、getSimpleTripartiteTrafficEdgeGroups、pageTripartiteTraffics、testCommunication、updateTripartiteTraffic |
| P20 | MissionCluster/MissionCreate | /mission-cluster/mission-create | createOrderTemplate、deleteOrderTemplate、getCrossMapStations、getSimpleMaps、getSimpleVehicles、getVehicleGroups、pageOrderTemplates、updateOrderTemplate |
| P21 | MissionCluster/MissionFlow | /mission-cluster/mission-flow | createOrderFlow、getOrderTemplates、orderFlowOperation、pageOrderFlows、subOrderFlowOperation |
| P22 | ObstacleAvoidance | /mission-cluster/obstacle-avoidance | createObstacleAvoidance、deleteObstacleAvoidance、pageObstacleAvoidance、updateObstacleAvoidance |
| P23 | ActionControl/AGVAction | /mission-cluster/action-control/agv-action | addAGVAction、deleteAGVAction、pageAGVActions、updateAGVAction |
| P24 | ActionControl/AGVActionGroup | /mission-cluster/action-control/agv-action-group | addAGVActionGroup、deleteAGVActionGroup、getAgvActions、pageAGVActionGroups、updateAGVActionGroup |
| P25 | SystemInvolve/VersionControl | /system-involve/version-control | UPLOADSYSTEMVERSION_URL、deletePendingJar、downloadSystemVersionJar、getSystemVersions、restartSystem、rollback |
| P26 | SystemInvolve/SystemLog | /system-involve/system-log | downloadSystemLog、getSystemLogTypes、pageSystemLogs |
| P27 | SystemInvolve/SystemSetting | /system-involve/system-setting | fetchSystemImage、uploadSystemImage |
| P28 | SystemInvolve/OperationLog | /system-involve/operation-log | pageSysLogs |
| P29 | SystemInvolve/SoftwareInformation | /system-involve/software-information | getLicense、softwareActivation |
| P30 | SystemInvolve/DatabaseBackupManagement | /system-involve/database-backup | getDataBaseBackupFiles、getDataBases |
| P31 | AccessManagement/UserManagement | /access-management/user-management | addUser、assignRoles、deleteUser、getRoles、pageUsers、resetPassword、updateUserState |
| P32 | AccessManagement/RoleManagement | /access-management/role-management | addRole、assignPermissions、deleteRole、getPermissions、pageRoles、updateRole |
| P33 | AnalyzeVisual/OrderStatistics | /analyze-visual/order-statistics | getSimpleVehicles、orderEfficiencyStatistics、orderQuantityStatistics |
| P34 | AnalyzeVisual/RealtimeDashboard | /analyze-visual/dashboard-realtime | alarmStatistics、dashboardBoard、pageSystemAlarmRecords、taskStatistics |
| P35 | AnalyzeVisual/TaskStatisticsReport | /analyze-visual/dashboard-task | agvExecutingTimeStatistics、agvStateStatistics、alarmStatistics、dashboardBoard、getSimpleVehicles、pageSystemAlarmRecords、taskStatistics |
| P36 | AnalyzeVisual/FaultAlert | /analyze-visual/dashboard-fault | alarmStatistics、dashboardBoard、pageSystemAlarmRecords、taskStatistics |
| P37 | AnalyzeVisual/VehicleStatus | /analyze-visual/vehicle-status | agvExecutingTimeStatistics |
| P38 | OrderInfo | /order-info | getOrderRecordDetail |
| P39 | VehicleInfo | /vehicle-info | getVehicleState |
| P40 | AnalyzeVisual/ServerRealtimeResources | /analyze-visual/server-resource-monitor | getServerResourceCurrent |
| P41 | UnAccess | /no-permission | 无 |
| P42 | @/pages/NotFound | /* | 无 |


路由外补充：当前外壳需要迁移logout及updateUserPassword（旧ActionsRender与PasswordModal），用户改密仍保留旧密码确认和MD5转换规则；这不是重新纳入个人中心。数据库备份直接GET下载不经页面的@/api导入，另见附录B。

## 附录B：API方法、地址与目标服务域

共181条映射：页面依赖中177个请求方法和1个上传URL导出项，另补退出登录、当前用户改密、页面直接备份下载。列表为本轮有效引用基线；不要求本轮迁移源243个导出项中的全部历史方法及暂缓模块专用方法，后者保留契约供下一轮实现。

HTTP方法和地址保留；目标服务文件位于src/services，各文件配套*.service.types.ts。服务文件划分属于实施组织方式，不改变接口契约；共享查询只保留一份实现。函数名可按当前项目规范命名，但需保留旧名到新方法的可追溯映射。

| 旧导出项／有效调用 | HTTP | 保留地址 | 目标服务文件（相对src/services） |
| --- | --- | --- | --- |
| UPLOADSYSTEMVERSION_URL | POST multipart | /fms/v1/systemVersion/uploadSystemVersion | system-involve/version/version.service.ts |
| addAGVAction | POST | /fms/v1/action/agvAction/addAGVAction | action-control/agv-action/agv-action.service.ts |
| addAGVActionGroup | POST | /fms/v1/action/agvActionGroup/addAGVActionGroup | action-control/action-group/action-group.service.ts |
| addAirShowerDoor | POST | /fms/v1/device/airShowerDoor/addAirShowerDoor | tri-device/air-shower-door/air-shower-door.service.ts |
| addAutoDoor | POST | /fms/v1/device/autoDoor/addAutoDoor | tri-device/auto-door/auto-door.service.ts |
| addChargePile | POST | /fms/v1/device/chargePile/addChargePile | tri-device/charge-pile/charge-pile.service.ts |
| addElevator | POST | /fms/v1/device/elevator/addElevator | tri-device/elevator/elevator.service.ts |
| addRole | POST | /fms/v1/auth/role/addRole | system/role/role.service.ts |
| addTrafficLight | POST | /fms/v1/device/trafficLight/addTrafficLight | tri-device/traffic-light/traffic-light.service.ts |
| addTripartiteTraffic | POST | /fms/v1/dispatcher/tripartiteTraffic/addTripartiteTraffic | tri-resource/traffic/traffic.service.ts |
| addUser | POST | /fms/v1/auth/user/addUser | system/user/user.service.ts |
| addVehicle | POST | /fms/v1/dispatcher/vehicle/addVehicle | vehicle-deploy/vehicle/vehicle.service.ts |
| addVehicleAlarmCode | POST | /fms/v1/dispatcher/vehicleAlarmCode/addVehicleAlarmCode | vehicle-deploy/alarm-code/alarm-code.service.ts |
| addVehicleGroup | POST | /fms/v1/dispatcher/vehicleGroup/addVehicleGroup | vehicle-deploy/vehicle-group/vehicle-group.service.ts |
| agvExecutingTimeStatistics | POST | /fms/v1/report/vehicleStatisticsReport/agvExecutingTimeStatistics | analyze-visual/vehicle-statistics/vehicle-statistics.service.ts |
| agvStateStatistics | POST | /fms/v1/report/vehicleStatisticsReport/agvStateStatistics | analyze-visual/vehicle-statistics/vehicle-statistics.service.ts |
| airDoorClose | POST | /fms/v1/device/airShowerDoor/closeDoor | tri-device/air-shower-door/air-shower-door.service.ts |
| airDoorOpen | POST | /fms/v1/device/airShowerDoor/openDoor | tri-device/air-shower-door/air-shower-door.service.ts |
| alarmStatistics | POST | /fms/v1/report/systemAlarmRecord/alarmStatistics | analyze-visual/alarm/alarm.service.ts |
| allVehicleOperate | POST | /fms/v1/dispatcher/vehicle/allVehicleOperate | vehicle-deploy/vehicle/vehicle.service.ts |
| assignPermissions | POST | /fms/v1/auth/role/assignPermissions | system/role/role.service.ts |
| assignRoles | POST | /fms/v1/auth/user/assignRoles | system/user/user.service.ts |
| autoDoorClose | POST | /fms/v1/device/autoDoor/closeDoor | tri-device/auto-door/auto-door.service.ts |
| autoDoorOpen | POST | /fms/v1/device/autoDoor/openDoor | tri-device/auto-door/auto-door.service.ts |
| batchEditConfigs | POST | /fms/v1/dispatcher/taskConfig/batchEditConfigs | dispatch-hub/config/config.service.ts |
| cancelPushMap | POST | /fms/v1/dispatcher/mapPushRecord/cancelPushMap | map-through/map-push-record/map-push-record.service.ts |
| clearAirShowerDoorOccupy | POST | /fms/v1/device/airShowerDoor/clearAirShowerDoorOccupy | tri-device/air-shower-door/air-shower-door.service.ts |
| clearAutoDoorOccupy | POST | /fms/v1/device/autoDoor/clearAutoDoorOccupy | tri-device/auto-door/auto-door.service.ts |
| clearElevatorOccupy | POST | /fms/v1/device/elevator/clearElevatorOccupy | tri-device/elevator/elevator.service.ts |
| closeDoor | POST | /fms/v1/device/elevator/closeDoor | tri-device/elevator/elevator.service.ts |
| createCarrier | POST | /fms/v1/dispatcher/carrier/createCarrier | vehicle-deploy/carrier/carrier.service.ts |
| createCrossMap | POST | /fms/v1/dispatcher/crossMap/createCrossMap | map-through/cross-map/cross-map.service.ts |
| createMap | POST | /fms/v1/dispatcher/map/createMap | map-through/map/map.service.ts |
| createObstacleAvoidance | POST | /fms/v1/dispatcher/obstacleAvoidance/createObstacleAvoidance | mission-cluster/obstacle-avoidance/obstacle-avoidance.service.ts |
| createOrderFlow | POST | /fms/v1/dispatcher/orderFlow/createOrderFlow | mission-cluster/flow/flow.service.ts |
| createOrderRecord | POST | /fms/v1/dispatcher/orderRecord/createOrderRecord | order-record/order.service.ts |
| createOrderTemplate | POST | /fms/v1/dispatcher/orderTemplate/createOrderTemplate | mission-cluster/template/template.service.ts |
| createSystemNodeEdgeGroup | POST | /fms/v1/dispatcher/systemNodeEdgeGroup/createSystemNodeEdgeGroup | map-through/point-edge-combination/point-edge-combination.service.ts |
| dashboardBoard | POST | /fms/v1/dispatcher/dashboard/board | analyze-visual/dashboard/dashboard.service.ts |
| deleteAGVAction | POST | /fms/v1/action/agvAction/deleteAGVAction | action-control/agv-action/agv-action.service.ts |
| deleteAGVActionGroup | POST | /fms/v1/action/agvActionGroup/deleteAGVActionGroup | action-control/action-group/action-group.service.ts |
| deleteAGVNodeMapping | POST | /fms/v1/dispatcher/agvNodeMapping/deleteAGVNodeMapping | vehicle-deploy/node-mapping/node-mapping.service.ts |
| deleteAirShowerDoor | POST | /fms/v1/device/airShowerDoor/deleteAirShowerDoor | tri-device/air-shower-door/air-shower-door.service.ts |
| deleteAutoDoor | POST | /fms/v1/device/autoDoor/deleteAutoDoor | tri-device/auto-door/auto-door.service.ts |
| deleteCarrier | POST | /fms/v1/dispatcher/carrier/deleteCarrier | vehicle-deploy/carrier/carrier.service.ts |
| deleteChargePile | POST | /fms/v1/device/chargePile/deleteChargePile | tri-device/charge-pile/charge-pile.service.ts |
| deleteCrossMap | POST | /fms/v1/dispatcher/crossMap/deleteCrossMap | map-through/cross-map/cross-map.service.ts |
| deleteElevator | POST | /fms/v1/device/elevator/deleteElevator | tri-device/elevator/elevator.service.ts |
| deleteMap | POST | /fms/v1/dispatcher/map/deleteMap | map-through/map/map.service.ts |
| deleteObstacleAvoidance | POST | /fms/v1/dispatcher/obstacleAvoidance/deleteObstacleAvoidance | mission-cluster/obstacle-avoidance/obstacle-avoidance.service.ts |
| deleteOrderTemplate | POST | /fms/v1/dispatcher/orderTemplate/deleteOrderTemplate | mission-cluster/template/template.service.ts |
| deletePendingJar | POST | /fms/v1/systemVersion/deletePendingJar | system-involve/version/version.service.ts |
| deleteRole | POST | /fms/v1/auth/role/delete?id={id} | system/role/role.service.ts |
| deleteSystemNodeEdgeGroup | POST | /fms/v1/dispatcher/systemNodeEdgeGroup/deleteSystemNodeEdgeGroup | map-through/point-edge-combination/point-edge-combination.service.ts |
| deleteTrafficLight | POST | /fms/v1/device/trafficLight/deleteTrafficLight | tri-device/traffic-light/traffic-light.service.ts |
| deleteTripartiteTraffic | POST | /fms/v1/dispatcher/tripartiteTraffic/deleteTripartiteTraffic | tri-resource/traffic/traffic.service.ts |
| deleteUser | POST | /fms/v1/auth/user/deleteUser | system/user/user.service.ts |
| deleteVehicle | POST | /fms/v1/dispatcher/vehicle/deleteVehicle | vehicle-deploy/vehicle/vehicle.service.ts |
| deleteVehicleAlarmCode | POST | /fms/v1/dispatcher/vehicleAlarmCode/deleteVehicleAlarmCode | vehicle-deploy/alarm-code/alarm-code.service.ts |
| deleteVehicleGroup | POST | /fms/v1/dispatcher/vehicleGroup/deleteVehicleGroup | vehicle-deploy/vehicle-group/vehicle-group.service.ts |
| detail | GET | /fms/v1/auth/authorize/detail | auth/auth.service.ts |
| downVehicleAlarmCodeFile | POST | /fms/v1/dispatcher/vehicleAlarmCode/downVehicleAlarmCodeFile | vehicle-deploy/alarm-code/alarm-code.service.ts |
| downloadMap | POST | /fms/v1/dispatcher/map/downloadMap | map-through/map/map.service.ts |
| downloadMapInfo | POST | /fms/v1/dispatcher/map/downloadMapInfo | map-through/map/map.service.ts |
| downloadSystemLog | POST | /fms/v1/systemLog/downloadSystemLog | system-involve/system-log/system-log.service.ts |
| downloadSystemVersionJar | POST | /fms/v1/systemVersion/downloadSystemVersionJar | system-involve/version/version.service.ts |
| exportOrderRecords | GET | /fms/v1/dispatcher/orderRecord/exportOrderRecords | order-record/order.service.ts |
| fetchSystemImage | GET | /fms/v1/systemLogos/{encodedPlacementKey}/file | system-involve/system-setting/system-setting.service.ts |
| getAGVActionGroups | GET | /fms/v1/action/agvActionGroup/getAGVActionGroups | action-control/action-group/action-group.service.ts |
| getAgvActions | GET | /fms/v1/action/agvAction/getAGVActions | action-control/agv-action/agv-action.service.ts |
| getAirShowerDoorDrivers | GET | /fms/v1/device/airShowerDoor/getAirShowerDoorDrivers | tri-device/air-shower-door/air-shower-door.service.ts |
| getAirShowerDoorState | GET | /fms/v1/device/airShowerDoor/getAirShowerDoorState | tri-device/air-shower-door/air-shower-door.service.ts |
| getAllSimpleNodeEdgeGroups | GET | /fms/v1/dispatcher/systemNodeEdgeGroup/getAllSimpleNodeEdgeGroups | map-through/point-edge-combination/point-edge-combination.service.ts |
| getAutoDoorDrivers | GET | /fms/v1/device/autoDoor/getAutoDoorDrivers | tri-device/auto-door/auto-door.service.ts |
| getAutoDoorState | GET | /fms/v1/device/autoDoor/getAutoDoorState | tri-device/auto-door/auto-door.service.ts |
| getChargePileDrivers | GET | /fms/v1/device/chargePile/getChargePileDrivers | tri-device/charge-pile/charge-pile.service.ts |
| getCrossMapStations | GET | /fms/v1/dispatcher/map/getSites | map-through/map/map.service.ts |
| getDataBaseBackupFiles | GET | /fms/v1/dataBase/getDataBaseBackupFiles | system-involve/database-backup/database-backup.service.ts |
| getDataBases | GET | /fms/v1/dataBase/getDataBases | system-involve/database-backup/database-backup.service.ts |
| getElevatorDrivers | GET | /fms/v1/device/elevator/getElevatorDrivers | tri-device/elevator/elevator.service.ts |
| getElevatorState | GET | /fms/v1/device/elevator/getElevatorState | tri-device/elevator/elevator.service.ts |
| getElevators | GET | /fms/v1/device/elevator/getElevators | tri-device/elevator/elevator.service.ts |
| getHardwareInfo | GET | /fms/v1/auth/license/getHardwareInfo | system-involve/software-information/software-information.service.ts |
| getLicense | POST | /fms/v1/auth/license/getLicense | system-involve/software-information/software-information.service.ts |
| getMapInfo | GET | /fms/v1/dispatcher/map/getMapInfo | map-through/map/map.service.ts |
| getOrderRecordDetail | POST | /fms/v1/dispatcher/orderRecord/getOrderRecordDetail | order-record/order.service.ts |
| getOrderTemplates | GET | /fms/v1/dispatcher/orderTemplate/getOrderTemplates | mission-cluster/template/template.service.ts |
| getPermissions | GET | /fms/v1/auth/permission/getPermissions | system/permission/permission.service.ts |
| getRoles | GET | /fms/v1/auth/role/getRoles | system/role/role.service.ts |
| getServerResourceCurrent | GET | /fms/v1/serverResource/current | analyze-visual/server-resource/server-resource.service.ts |
| getSimpleMaps | GET | /fms/v1/dispatcher/map/getSimpleMaps | map-through/map/map.service.ts |
| getSimpleTripartiteTrafficEdgeGroups | GET | /fms/v1/dispatcher/map/getSimpleTripartiteTrafficEdgeGroups | map-through/map/map.service.ts |
| getSimpleVehicles | GET | /fms/v1/dispatcher/vehicle/getSimpleVehicles | vehicle-deploy/vehicle/vehicle.service.ts |
| getSuggestionsForCollectionNodes | GET | /fms/v1/dispatcher/agvNodeMapping/getSuggestionsForCollectionNodes | vehicle-deploy/node-mapping/node-mapping.service.ts |
| getSystemLogTypes | GET | /fms/v1/systemLog/getSystemLogTypes | system-involve/system-log/system-log.service.ts |
| getSystemVersions | GET | /fms/v1/systemVersion/getSystemVersions | system-involve/version/version.service.ts |
| getTaskConfigs | GET | /fms/v1/dispatcher/taskConfig/getTaskConfigs | dispatch-hub/config/config.service.ts |
| getTrafficLightDrivers | GET | /fms/v1/device/trafficLight/getDrivers | tri-device/traffic-light/traffic-light.service.ts |
| getUnRelationSimpleVehicles | GET | /fms/v1/dispatcher/vehicle/getUnRelationSimpleVehicles | vehicle-deploy/vehicle/vehicle.service.ts |
| getVehicleGroups | GET | /fms/v1/dispatcher/vehicleGroup/getVehicleGroups | vehicle-deploy/vehicle-group/vehicle-group.service.ts |
| getVehicleState | GET | /fms/v1/dispatcher/vehicle/getVehicleState | vehicle-deploy/vehicle/vehicle.service.ts |
| innerCall | POST | /fms/v1/device/elevator/innerCall | tri-device/elevator/elevator.service.ts |
| login | POST | /fms/v1/auth/authorize/login | auth/auth.service.ts |
| mockDispatch | POST | /fms/v1/dispatcher/orderTask/mockDispatch | order-record/order.service.ts |
| openDoor | POST | /fms/v1/device/elevator/openDoor | tri-device/elevator/elevator.service.ts |
| orderEfficiencyStatistics | POST | /fms/v1/report/orderStatisticsReport/orderEfficiencyStatistics | analyze-visual/order-statistics/order-statistics.service.ts |
| orderFlowOperation | POST | /fms/v1/dispatcher/orderFlow/orderFlowOperation | mission-cluster/flow/flow.service.ts |
| orderQuantityStatistics | POST | /fms/v1/report/orderStatisticsReport/orderQuantityStatistics | analyze-visual/order-statistics/order-statistics.service.ts |
| orderRecordStateStatistic | GET | /fms/v1/dispatcher/orderRecord/orderRecordStateStatistic | order-record/order.service.ts |
| orderTaskOperate | POST | /fms/v1/dispatcher/orderTask/orderTaskOperate | order-record/order.service.ts |
| outerCall | POST | /fms/v1/device/elevator/outerCall | tri-device/elevator/elevator.service.ts |
| pageAGVActionGroups | GET | /fms/v1/action/agvActionGroup/pageAGVActionGroups | action-control/action-group/action-group.service.ts |
| pageAGVActions | GET | /fms/v1/action/agvAction/pageAGVActions | action-control/agv-action/agv-action.service.ts |
| pageAGVNodeMappings | GET | /fms/v1/dispatcher/agvNodeMapping/pageAGVNodeMapping | vehicle-deploy/node-mapping/node-mapping.service.ts |
| pageAirShowerDoors | GET | /fms/v1/device/airShowerDoor/pageAirShowerDoors | tri-device/air-shower-door/air-shower-door.service.ts |
| pageAutoDoors | GET | /fms/v1/device/autoDoor/pageAutoDoors | tri-device/auto-door/auto-door.service.ts |
| pageCarriers | POST | /fms/v1/dispatcher/carrier/pageCarriers | vehicle-deploy/carrier/carrier.service.ts |
| pageChargePiles | GET | /fms/v1/device/chargePile/pageChargePiles | tri-device/charge-pile/charge-pile.service.ts |
| pageCrossMaps | GET | /fms/v1/dispatcher/crossMap/pageCrossMaps | map-through/cross-map/cross-map.service.ts |
| pageElevators | GET | /fms/v1/device/elevator/pageElevators | tri-device/elevator/elevator.service.ts |
| pageMapInfoVersions | GET | /fms/v1/dispatcher/mapVersion/pageMapInfoVersions | map-through/map-version/map-version.service.ts |
| pageMapInfos | GET | /fms/v1/dispatcher/map/pageMapInfos | map-through/map/map.service.ts |
| pageMapPushRecords | GET | /fms/v1/dispatcher/mapPushRecord/pageMapPushRecords | map-through/map-push-record/map-push-record.service.ts |
| pageObstacleAvoidance | GET | /fms/v1/dispatcher/obstacleAvoidance/pageObstacleAvoidance | mission-cluster/obstacle-avoidance/obstacle-avoidance.service.ts |
| pageOrderFlows | GET | /fms/v1/dispatcher/orderFlow/pageOrderFlows | mission-cluster/flow/flow.service.ts |
| pageOrderRecords | GET | /fms/v1/dispatcher/orderRecord/pageOrderRecords | order-record/order.service.ts |
| pageOrderTemplates | GET | /fms/v1/dispatcher/orderTemplate/pageOrderTemplates | mission-cluster/template/template.service.ts |
| pageRoles | GET | /fms/v1/auth/role/pageRoles | system/role/role.service.ts |
| pageSysLogs | POST | /fms/v1/common/sysLog/pageSysLogs | system-involve/operation-log/operation-log.service.ts |
| pageSystemAlarmRecords | POST | /fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords | analyze-visual/alarm/alarm.service.ts |
| pageSystemLogs | GET | /fms/v1/systemLog/pageSystemLogs | system-involve/system-log/system-log.service.ts |
| pageSystemNodeEdgeGroups | GET | /fms/v1/dispatcher/systemNodeEdgeGroup/pageSystemNodeEdgeGroups | map-through/point-edge-combination/point-edge-combination.service.ts |
| pageTrafficLights | GET | /fms/v1/device/trafficLight/pageTrafficLights | tri-device/traffic-light/traffic-light.service.ts |
| pageTripartiteTraffics | GET | /fms/v1/dispatcher/tripartiteTraffic/pageTripartiteTraffics | tri-resource/traffic/traffic.service.ts |
| pageUsers | GET | /fms/v1/auth/user/pageUsers | system/user/user.service.ts |
| pageVehicleAlarmCodes | GET | /fms/v1/dispatcher/vehicleAlarmCode/pageVehicleAlarmCodes | vehicle-deploy/alarm-code/alarm-code.service.ts |
| pageVehicleGroups | GET | /fms/v1/dispatcher/vehicleGroup/pageVehicleGroups | vehicle-deploy/vehicle-group/vehicle-group.service.ts |
| pageVehicles | GET | /fms/v1/dispatcher/vehicle/pageVehicles | vehicle-deploy/vehicle/vehicle.service.ts |
| publishMapInfoVersion | POST | /fms/v1/dispatcher/mapVersion/publishMapInfoVersion | map-through/map-version/map-version.service.ts |
| pushMapInfoVersion | POST | /fms/v1/dispatcher/mapVersion/pushMapInfoVersion | map-through/map-version/map-version.service.ts |
| rePushMap | POST | /fms/v1/dispatcher/mapPushRecord/rePushMap | map-through/map-push-record/map-push-record.service.ts |
| resetPassword | POST | /fms/v1/auth/user/resetPassword | system/user/user.service.ts |
| restartSystem | POST | /fms/v1/systemVersion/restartSystem | system-involve/version/version.service.ts |
| rollback | POST | /fms/v1/systemVersion/rollback | system-involve/version/version.service.ts |
| saveAGVNodeMapping | POST | /fms/v1/dispatcher/agvNodeMapping/saveAGVNodeMapping | vehicle-deploy/node-mapping/node-mapping.service.ts |
| shower | POST | /fms/v1/device/airShowerDoor/shower | tri-device/air-shower-door/air-shower-door.service.ts |
| softwareActivation | POST | /fms/v1/auth/license/softwareActivation | system-involve/software-information/software-information.service.ts |
| startCharge | POST | /fms/v1/device/chargePile/startCharge | tri-device/charge-pile/charge-pile.service.ts |
| stopCharge | POST | /fms/v1/device/chargePile/stopCharge | tri-device/charge-pile/charge-pile.service.ts |
| subOrderFlowOperation | POST | /fms/v1/dispatcher/orderFlow/subOrderFlowOperation | mission-cluster/flow/flow.service.ts |
| taskStatistics | POST | /fms/v1/report/orderStatisticsReport/taskStatistics | analyze-visual/order-statistics/order-statistics.service.ts |
| testCommunication | POST | /fms/v1/dispatcher/tripartiteTraffic/testCommunication | tri-resource/traffic/traffic.service.ts |
| testTrafficLight | POST | /fms/v1/device/trafficLight/testTrafficLight | tri-device/traffic-light/traffic-light.service.ts |
| updateAGVAction | POST | /fms/v1/action/agvAction/updateAGVAction | action-control/agv-action/agv-action.service.ts |
| updateAGVActionGroup | POST | /fms/v1/action/agvActionGroup/updateAGVActionGroup | action-control/action-group/action-group.service.ts |
| updateAGVNodeMapping | POST | /fms/v1/dispatcher/agvNodeMapping/updateAGVNodeMapping | vehicle-deploy/node-mapping/node-mapping.service.ts |
| updateAirShowerDoor | POST | /fms/v1/device/airShowerDoor/updateAirShowerDoor | tri-device/air-shower-door/air-shower-door.service.ts |
| updateAutoDoor | POST | /fms/v1/device/autoDoor/updateAutoDoor | tri-device/auto-door/auto-door.service.ts |
| updateCarrier | POST | /fms/v1/dispatcher/carrier/updateCarrier | vehicle-deploy/carrier/carrier.service.ts |
| updateChargePile | POST | /fms/v1/device/chargePile/updateChargePile | tri-device/charge-pile/charge-pile.service.ts |
| updateCrossMap | POST | /fms/v1/dispatcher/crossMap/updateCrossMap | map-through/cross-map/cross-map.service.ts |
| updateElevator | POST | /fms/v1/device/elevator/updateElevator | tri-device/elevator/elevator.service.ts |
| updateMap | POST | /fms/v1/dispatcher/map/updateMap | map-through/map/map.service.ts |
| updateObstacleAvoidance | POST | /fms/v1/dispatcher/obstacleAvoidance/updateObstacleAvoidance | mission-cluster/obstacle-avoidance/obstacle-avoidance.service.ts |
| updateOrderTemplate | POST | /fms/v1/dispatcher/orderTemplate/updateOrderTemplate | mission-cluster/template/template.service.ts |
| updateRole | POST | /fms/v1/auth/role/updateRole | system/role/role.service.ts |
| updateSystemNodeEdgeGroup | POST | /fms/v1/dispatcher/systemNodeEdgeGroup/updateSystemNodeEdgeGroup | map-through/point-edge-combination/point-edge-combination.service.ts |
| updateTrafficLight | POST | /fms/v1/device/trafficLight/updateTrafficLight | tri-device/traffic-light/traffic-light.service.ts |
| updateTripartiteTraffic | POST | /fms/v1/dispatcher/tripartiteTraffic/updateTripartiteTraffic | tri-resource/traffic/traffic.service.ts |
| updateUserState | POST | /fms/v1/auth/user/updateState | system/user/user.service.ts |
| updateVehicle | POST | /fms/v1/dispatcher/vehicle/updateVehicle | vehicle-deploy/vehicle/vehicle.service.ts |
| updateVehicleAlarmCode | POST | /fms/v1/dispatcher/vehicleAlarmCode/updateVehicleAlarmCode | vehicle-deploy/alarm-code/alarm-code.service.ts |
| updateVehicleGroup | POST | /fms/v1/dispatcher/vehicleGroup/updateVehicleGroup | vehicle-deploy/vehicle-group/vehicle-group.service.ts |
| uploadMapFile | POST | /fms/v1/dispatcher/map/uploadMap | map-through/map/map.service.ts |
| uploadSystemImage | PUT | /fms/v1/systemLogos/{placementKey} | system-involve/system-setting/system-setting.service.ts |
| uploadVehicleAlarmCodeFile | POST | /fms/v1/dispatcher/vehicleAlarmCode/uploadVehicleAlarmCodeFile | vehicle-deploy/alarm-code/alarm-code.service.ts |
| uploadVehicleMap | POST | /fms/v1/dispatcher/map/uploadVehicleMap | map-through/map/map.service.ts |
| vehicleOperate | POST | /fms/v1/dispatcher/vehicle/vehicleOperate | vehicle-deploy/vehicle/vehicle.service.ts |
| logout（外壳） | POST | /fms/v1/auth/authorize/logout | auth/auth.service.ts |
| updateUserPassword（外壳） | POST | /fms/v1/auth/user/updatePassword | system/user/user.service.ts |
| 数据库备份页面直接下载 | GET | /fms/v1/dataBase/downloadDataBaseBackupFile?database={database}&backupFileName={fileName} | system-involve/database-backup/database-backup.service.ts |


### B.1 特殊契约核验

- UPLOADSYSTEMVERSION_URL是源上传URL常量，不是普通JSON请求方法；目标提供typed上传方法并使用独立控制器。
- deleteRole为POST，但id在query，不能无意移入body。
- fetchSystemImage返回Blob，必须处理图片类型、默认图和Object URL释放；placementKey路径按约定编码。
- uploadSystemImage使用PUT，沿用原multipart字段和位置，不将其改成普通JSON。
- downloadMap、downloadSystemVersionJar、downloadSystemLog、exportOrderRecords等响应可能需读取二进制及header，统一JSON“只返回body”不足以覆盖。
- downloadMapInfo为业务上的地图拉取请求，不能因名字有download就一律使用浏览器文件下载。
- pageOrderRecords与getOrderRecordDetail分别使用订单分页和missionPage分页，不能复用一个错误的响应结构。
- getCrossMapStations实际端点为map/getSites；pageAGVNodeMappings实际端点为pageAGVNodeMapping。保留后端拼写。
- 源类型文件中的MapNestModify／OverLook名称不意味着共享DTO一律排除；保留页面使用的类型需迁入合适领域。
- 表中未出现/rcsFlow有效请求，不为预留代理而搬运该前缀下未使用的历史页面；若实际依赖核查发现有效调用，则保留其协议并补清单。
- 公共请求与文件路径需在真实环境核实鉴权、CORS／同源Cookie、响应header、最大文件和业务错误；这些属于联调核查，不是允许改后端的授权。

## 附录C：逐项交付记录格式

按§3.2在页面实施前，为每个P编号拆分动作／子功能并关联API条目，冻结以下记录；无独立API的交互也必须列项。实现及联调时补齐实际结果和证据，可以另存实施验收文档，不将本规格的“要求”勾选成“已通过”：

| 字段 | 内容要求 |
| --- | --- |
| 页面／动作／API编号 | 对应P编号、独立动作编号及旧API名称；同一API被新增／复制等多个动作复用时分别记录 |
| 来源与目标 | 冻结源文件、目标页面／feature／service路径 |
| 子功能 | 字段、查询、动态表单、展开层级、弹窗、复制、启停、排序、控制及文件操作；包含范围确认和空选择分支 |
| 权限 | 菜单码、按钮码、root特例、直访约束 |
| 契约 | 方法、地址、query／body／multipart、DTO、响应与错误；时间参数记录默认／快捷／手动输入来源、时区、精度及边界 |
| 行为差异 | 已确认的改动、前端缺陷修正、未改动的旧业务定义 |
| 验证 | 浏览器及其时区、分辨率、语言主题、账号权限、测试数据、操作步骤与实际结果；覆盖隐藏／跨布局、关闭／刷新、回执丢失和权限变化 |
| 证据 | 截图／日志／请求记录位置，不包含密码、token或敏感凭据 |
| 状态 | 未开始／实施中／待外部条件／已验证；待外部条件写明具体依赖 |

本规格已完成需求访谈。后续仅当发现新的业务定义冲突、用户改变范围或必须新增后端能力时再就具体差异确认；不重复询问本文已经确定的选项。
