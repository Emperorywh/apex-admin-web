# 共享契约台账

> T00.1 初始化框架（2026-09-17）；T00.3–T00.8 逐节填充，T00.9 冻结。
> 本表登记跨页面消费的共享契约：请求协议、DTO 约定、权限、实体导航、表格、草稿、轮询、传输、地图、i18n、时区。页面任务消费前先查本表；新增/变更契约由 owner 登记并评估全部消费者。

## 1. 请求协议契约（owner：T00，T00.3 已落地）

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 基础路径 | `/fms/v1/...`，严格按 OpenAPI operation，不改写路径；`DEFAULT_API_BASE_URL='/fms/v1'`；dev 代理 `/fms` 原样转发（默认目标 `http://10.11.2.67:8888`，`APEX_DEV_PROXY_TARGET` 可覆盖）；经代理的端到端请求已实证（错误凭据登录返回业务码） | 已落地并实证（T00.2/T00.3） |
| 成功判定 | HTTP 成功且业务 `code=200`；不依赖 `message === 'success'` | 已落地并实证（GET /systemLogos 返回 `{code:200,...}`） |
| 响应包装 | `code/message/timestamp/data` 统一解包（`unwrapResult`）；文件/流（非 JSON content-type）原样透传不解包；非 Result 形状的 JSON 按 `CLIENT.MALFORMED_RESPONSE` 报错，不猜数据 | 已落地（T00.3） |
| 业务码 | `200` 成功；`1000000` 会话失效（真实实证：无凭据访问 pageUsers 返回该码，HTTP 200）→ 单飞清会话+一次性提示+外壳跳登录；`1000010` 用户名或密码错误（真实实证）；`1001000` 未激活（2026-09-18 真实环境实证，带令牌业务接口返回）→ 单飞一次性提示 + 事件引导 SPA 跳授权页（P02 已接入；授权页自身请求抑制；真实触发随未激活环境+首个业务页复核） | 已落地（含 1001000 引导） |
| 错误 | 统一 ApiError：`businessCode` 携带业务码，业务拒绝不判离线（health 不记失败）；文案经 i18next 翻译 | 已落地（T00.3） |
| 分页 | `BackendPageQuery`（pageNo/pageSize）→ `BackendPageResult`（records/current/size/total/pages）为常见形状基准，service 层规范化暴露；逐 endpoint 核实（G04） | 类型已定义；逐 endpoint 待联调 |
| 查询序列化 | GET 对象 DTO 逐 endpoint 核实 | 待联调（G04） |
| 认证 | `Authorization: Bearer <token>`（请求层单点）+ 密码 MD5（auth.service 单点，spark-md5）；均为旧代码证据，完整确认待登录凭据（G03）；`Accept-Language` 头统一发送（真实实证：后端按头返回对应语言 message，含错误文案） | 已落地（Bearer/MD5 待真实登录确认；Accept-Language 已实证） |
| 时间 | date-time/日期/统计天数按 endpoint；部署时区优先，缺省 Asia/Shanghai。已实证响应内时间为 `yyyy-MM-dd HH:mm:ss` 字符串（systemLogos createTime） | 已确认（规格 11.3、D23）；展示工具 T00.7 接入 |
| int64 | 实体层字符串承载；DTO 层保持 JSON number；联调抽样核实（G10） | 待联调（G10） |
| 取消/重试 | 主动取消（AbortSignal）静默：不报错、不判离线、不计健康；任何请求不自动重放（无刷新令牌协议，过期即重新登录） | 已落地（T00.3） |
| 健康反馈 | 有真实后端响应（含业务拒绝）= ok；无响应/HTML/网关错误 = error；取消不参与统计 | 已落地（T00.3） |

## 2. 会话与权限契约（owner：T00；T00.3 会话、T00.4 权限与路由已落地）

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 登录 | `POST /auth/authorize/login`（OpenAPI 已核实）：请求 `{username, password(MD5)}`，响应 `data: UserAuth{token, activated, user, roles, permissions, permissionsTree}` 一次性构建会话 | 已落地（登录成功路径待真实凭据联验，G03） |
| 持久化 | token/activated/user/roles/permissions/permissionsTree 经 redux-persist 全量持久化（auth schema v2），刷新/重启恢复前端上下文；不存密码；模板时代旧会话（v1）迁移为未登录态。T00.4 联调修复：自定义 migrate 此前无条件重置会话，现按存储版本分流（<v2 重置、v2 原样恢复）；存储键含 redux-persist 默认前缀（`persist:apex-admin:auth`） | 已落地并经真实浏览器恢复实证（T00.4） |
| 会话失效收敛 | 业务码 1000000 → 请求层单飞处理：清令牌、一次性提示、派发 `sessionExpired`，BasicLayout 统一跳登录并携带回跳；无重定向风暴 | 已落地（T00.3） |
| 多窗口退出 | `storage` 事件监听持久化键（`persist:apex-admin:auth`，T00.4 修正键名缺前缀缺陷），其他窗口清空会话时本窗口同步清空；登录不做跨窗口同步 | 已落地（键名已实证修正，跨窗口行为待真实双窗口复验） |
| 无刷新接口 | 不实现静默刷新；过期重新登录（D05/G01/G02，模板 refresh/me 调用已删除） | 已落地（T00.3） |
| 权限码契约 | `PERM`（菜单码）/ `PERM_BUTTON`（按钮码）/ `ROOT_ONLY_CODES`（auth:manage、auth:user:view、auth:role:view）定义于 `src/constants/auth/permission.constants.ts`，码值与旧系统逐一核实对齐；历史码值交叉保留：任务工艺页挂 `mission-flow:view`、工艺管理页挂 `mission-template:view`；载具类型旧路由未写 access 已由 P06 核对收敛：后端权限树真实下发 `carrier:view`（MENU，旧 permission 数据 id=23，path 为空；旧前端 MENU_TREE 兜底映射 /vehicle-deploy/vehicle-type），PERM 已登记该已有码并挂路由（不公开访问、不凭空造码）；数据库备份路由维持登录即可达，待 P30 核对后再定 | 已落地（T00.4；P06 收敛载具类型行） |
| 权限判定 | 纯函数 `@/utils/auth/permission`（isRootUser/flattenMenuCodes/hasButtonCode）+ 路由访问核心 `@/router/routeAccess`（buildAccessContext/hasMenuAccess/isLeafAvailable/resolveLandingPath/resolveDirectoryLandingPath/resolveSafeRedirectPath）；超管（root/administrator）短路全放行；菜单码扁平化 + 基于定义树的祖先填充（有子菜单则父分组可见）− root 专属码；按钮码 hook `usePermission()`（超管短路） | 已落地（T00.4） |
| 路由守卫 | 定义树 meta.perm 挂码；认证+权限守卫覆盖全部非 public 入口（含布局外独立页 order-info/vehicle-info/server-resource-monitor/authorize-ingress/no-permission，不因 layout:false 公开）；目录 index 与受保护根 index 按会话动态解析落点（目录索引不指向无权限/未迁移页）；迁移过渡页（meta.migrationPending）渲染统一占位、不加载页面代码（无请求）、不作落点候选；页面任务完成后由统筹移除标记 | 已落地并经 17 项真实浏览器场景实证（T00.4） |
| 登录落点 | activated=false → `/authorize-ingress`（D29）；首页（/dashboard，P34 合并后同码 dashboard-realtime:view）可用优先；否则菜单顺序首个「有权限且已完成迁移」业务页；全部不可用 → `/no-permission`；登录回跳仅接受站内、存在且可用的目标（resolveSafeRedirectPath） | 已落地并实证（T00.4） |
| 权限拒绝 | 阻止操作 + 提示重新登录；不伪造刷新 | 已确认（规格 5.9）；页面接入随各页任务 |

## 3. 表格契约（owner：T00，T00.5 已落地）

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 组件 | 官方 npm `apex-table-react@0.1.0`（T00.2 已安装并提交锁文件）；无 antd Table/自绘 table；**页面直接使用包公开 API，禁止二次封装**（用户决策 2026-09-17，规格 6.1 修订） | 已安装（A07）；公共资源与约定 T00.5 落地 |
| 五语言 locale 包 | 包内置仅 zhCN；en-US/zh-TW/ja-JP/ko-KR 完整 ApexLocale 交付于 `src/i18n/locales/apexTable/`（简中不复制第二份，直接引用包内 zhCN）；`resolveApexLocale(lang)` 纯函数（前缀匹配、未知语言回退简中）+ `useApexLocale()` hook（随 i18next 语言联动重渲染）；ApexLocale 类型强制全 key 覆盖（探针曾捕获缺 key，类型即护栏） | 已落地（T00.5）；实际渲染效果随 P03/P05 首个真实表格联验 |
| 主题变量映射 | globals.css `:root .apex-table` 把 `--apex-table-*` 全量接到 `--app-*` 令牌（bg/表头/文本/强调/hover/选中/边框/圆角/字体/字号/内边距，亮暗随 data-theme 同帧切换；暗色另有 pinned-shadow 深色投影）；特异性高于包默认值，防懒加载包 CSS 反超；单表微调走组件 style prop，不改映射 | 已落地（T00.5）；亮暗视觉待 P03/P05 联验 |
| request 模式 | 零基 pageIndex → 后端 pageNo：`toBackendPage(pageIndex, pageSize)`（`src/utils/table/tablePaging.ts`，非法入参抛错）；返回 `{data, rowCount}`；未知总数不填 0（DoD 5）；组件内建取消（request 回调 signal）/错误重试/防乱序 | 换算函数已落地（T00.5）；真实接口分页联验随 P03/P05 |
| data 模式 | 仅真实完整小集合与草稿行（规格 6.2）；`editable`/`onDataChange` 仅 data 模式可用（包类型约束） | 已确认（T00.5 核验） |
| 行 ID | `stringFieldRowId(field)`（`src/utils/table/rowId.ts`）：字段空值抛错、不安全整数（int64 精度丢失，G10）抛错提示改 DTO；禁止位置性 ID | 已落地（T00.5） |
| 列偏好 | 官方适配器 `apex-table-react/adapters/local-column-preferences` 接入约定：`createTableColumnPreferences({tableId, userId})`（`src/utils/table/columnPreferences.ts`，namespace='apex-admin'、tenantId='default'、schemaVersion 默认 '1'，列结构变更须提升）+ `useColumnPreferences(tableId)` hook（会话取 userId、卸载 flush+dispose）；存储 key 四段隔离满足 DoD 5；页面接线四步见文件头 JSDoc（setState 与 save 都不可省，save 传合并后的完整四切片）。交互约定（用户决策 2026-09-18）：开启 `columnSettingsEnabled` 的表格**序号列默认放出**，齿轮入口随序号列表头（不单独占表头上方工具条行）；序号列是辅助轨道，不进偏好切片 | 已落地（T00.5）；localStorage 持久化与交互闭环已验证（P03 带令牌联验 2026-09-18） |
| 公开 API 核验 | 虚拟化 `virtualization: 'auto'\|boolean\|{overscan}`（分页 >200 行自动开启）；行展开 `expandable`（expandedRowRender/受控 keys/兼容虚拟滚动）；单元格编辑 `meta.apex.editor`（10 种 antd 控件）+ `editorConfig`；双 ref：`ref`=ApexTableRef（focus/scrollToRow/reload）、`tableRef`=ApexTableInstance（TanStack 实例方法）；弹层默认渲染在表格 DOM 内（主题变量继承安全），可用 getPopupContainer 重定向 | 已核验（T00.5，类型探针全量组装通过后删除） |
| 统一状态块 | `src/components/StateBlock/StateBlock.tsx`：`noPermission`（无权限）/`gap`（缺口禁用+原因）/`offline`（失败清区+显式重试）三语义，与「真实空数据」区分；独立组件不包裹表格；文案走 common 命名空间（zh/en 已交付，zh-TW/ja/ko 回退简中已登记 i18n-missing.md） | 已落地（T00.5） |
| 选择 | 当前页选择；翻页/筛选/失权清理（包内建当前页语义，跨页保留由业务决定——本项目按 DoD 5 不跨页保留） | 已确认（规格 6.2；页面任务消费） |
| 排序 | 仅真实支持的能力（G09）：不发虚构 sort | 已确认（G09） |

## 4. 页签/草稿/轮询/传输契约（owner：T00，T00.6 已落地）

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 草稿登记 | 页面经 `useTabDirtyGuard(isDirty, label?)`（`src/hooks/useTabDirtyGuard.ts`）把「是否存在未保存修改」同步到所属页签（`tabsSlice.tabDirtyMarked`）；草稿数据本身留在页面组件内存，标记只是元数据；组件卸载（关页/淘汰/刷新重建）自动清标记 | 已落地（T00.6）；页面任务自 P03 起消费 |
| LRU 豁免 | `tabsSlice.tabSynced` 的 LRU 淘汰跳过 dirty 页签：草稿不静默丢弃，宁可临时超出 `PAGE_CACHE_MAX_ENTRIES=10`；登出/会话失效整体重置 | 已落地并经浏览器程序化验证（T00.6） |
| 统一动作确认 | 关闭/刷新/关闭其他/左侧/右侧/全部、退出登录一律经 `useTabActionGuard`（`src/hooks/useTabActionGuard.tsx`）：列出受影响脏页签（路由标题+脏对象说明），确认后才派发 reducer；无任何旁路。传输提示三策略：`none`（刷新不影响传输）/`continue-after-close`（关页传输继续+完成消息提示）/`terminate`（登出本机终止，不保证服务端已停止） | 已落地并经真实浏览器验证（脏行/脏+传输/仅传输三形态，T00.6） |
| 浏览器离开提示 | BasicLayout：存在脏页签时挂 `beforeunload`（preventDefault + returnValue），无脏页签不挂监听；浏览器终止等非正常退出不承诺恢复草稿 | 已落地并经对照实验验证（脏→刷新被拦、无脏→正常重载） |
| 实时轮询 | `useVisiblePolling({refresh, enabled?})`（`src/hooks/useVisiblePolling.ts`）为实时页面唯一刷新调度入口：页签激活+文档可见才刷新；串行（完成后约 5 秒发起下一次，间隔自完成时刻起算）；重新可见/激活立即刷新；失败按倍率退避至上限；成功复位；主动取消（scope 信号中止）静默停止不算失败；后台保留快照。间隔与退避集中定义于 `src/constants/polling.constants.ts`（5s / ×2 / 60s），页面不得私设定时器；refresh 必须是只读查询并把收到的 signal 传给请求层 | 已落地；运行时行为随首个实时页（P34/P05/P39/P40）联验 |
| 传输生命周期 | `src/services/transfer/transferManager.ts` 模块级单例：AbortController 由管理器持有，不挂页面 scope——切页（Activity 隐藏/effect 清理）、关页、LRU 淘汰不误杀传输；普通查询取消（RequestScopeProvider）与传输互不影响。页面 `beginTransfer({tabKey, kind, name})` 取句柄：`signal` 传给请求层、`setProgress(loaded,total)` 回报真实进度（total 未知=null 不确定进度）、`markProcessing()`（字节 100% 后服务端处理中）、`succeed()/fail(reason)` 依业务结果判定；仅真实可取消的传输暴露 cancel | 已落地并经浏览器验证（关页后传输继续、完成后提示）；真实文件通道随页面任务（P08/P09/P25 等）接入 |
| 取消语义 | 本地 cancel/abort 仅代表客户端终止：阶段标 `aborted`，文案注明「仅本机终止，服务端处理不保证已撤销」（结果待确认，规格 10.4）；禁止把 Abort 当服务端回滚 | 已落地（T00.6） |
| 传输状态追踪 | `useTransfers(tabKey?)` 订阅任务列表（页面进度 UI 用）；`findActiveTransfersIn(tabKeys)` 供关闭确认一次性查询；承载页签已关闭的孤儿传输终态由 `TransferWatcher`（BasicLayout 内）以一次性 antd message 提示结果——**本期不新增用户可见全局任务中心**；终态记录保留 15 秒后自动清理 | 已落地并经浏览器验证（孤儿完成 toast，T00.6） |
| 会话结束清理 | 登出/会话失效/多窗口同步退出（isAuthenticated=false）：TransferWatcher 终止全部进行中传输并清空全部记录（含终态残留）；登出确认框提示未保存修改与传输终止影响 | 已落地并经浏览器验证（T00.6） |
| 实体页签 | tab.key = pathname + 规范化 search（参数名稳定排序）：实体详情以 `?orderKey=<实体ID>` 等定位参数打开时，不同实体自动获得独立页签、独立 Activity 缓存实例与独立请求 scope，互不串缓存；同参数复用同一页签。默认工作区页签形态要求实体路由位于受保护根内——P38 落地首个消费者（order-info 移入受保护根），P39 第二个消费者同构落地（vehicle-info 移入受保护根，完整路径 /vehicle-info 不变，hideInMenu 不进菜单/落点候选）；P40 接入时同构迁移 | 已落地并经 P38/P39 真实浏览器验证（P38 两 orderKey 三页签；P39 两 vehicleKey 两页签并存互不串） |
| 独立窗口 | `openStandaloneWindow(path, params?, options?)`（`src/utils/window/standaloneWindow.ts`）：仅接受站内绝对路径；按「路由+排序参数」命名窗口（同实体复用窗口、异实体独立）；居中 1280×800 popup；打开成功后切断 opener。独立窗口 = 打开同一路径（P38 起实体详情路由位于受保护根，窗口内为完整外壳形态），受同一认证+权限守卫，会话/语言/主题来自持久化；多窗口退出同步复用 authBridge（T00.3）。打开失败（弹窗拦截）返回 false，调用方给可读提示 | 已落地并经 P38 真实浏览器验证（新窗口渲染完整外壳+主体+守卫） |

## 5. 共享只读选项与地图能力契约（owner：T00；T00.7 已核对登记）

跨页只读选项由 T00 登记唯一 operation；查选项不等管理页完成，复用底层服务，页面不得各自复制请求。加载行为统一消费 `useStaticOptions`（`src/hooks/useStaticOptions.ts`：scope 取消、防乱序、失败清空 + error）；失效值经 `matchOptionById`/`missingOptionLabel`（`src/utils/options/optionFallback.ts`）保留原值并禁用保存，禁止静默选第一项。operation 逐项核对自 OpenAPI（2026-09-17）：

| 选项 | operation（GET /fms/v1 相对路径，method 已核对） | 参数 | 消费者 | 状态 |
| --- | --- | --- | --- | --- |
| 地图图形（节点/路径） | `GET /dispatcher/map/getMapInfo` | `mapId`(必填) | P07/P10/P11/P19/P20 等；服务已落地 `src/services/map/map.service.ts` | operation 已核对；带令牌联验随 P07（响应 schema 未在文档定义，按旧可达实现解析，联调后登记差异） |
| 地图下拉选项 | `GET /dispatcher/map/getSimpleMaps` | 无（全量） | P07/P09/P10/P11；服务已落地 `fetchSimpleMaps` | operation 已核对；联验随首个消费页 |
| 地图站点/站点(非节点) | `GET /dispatcher/map/getStations`；`GET /dispatcher/map/getSites` | `mapId`(必填)、`type`(可选) | P10 | operation 已核对，服务随 P10 |
| 车辆 | `GET /dispatcher/vehicle/getSimpleVehicles` | `mapId`(可选) | P04（GroupFormModal 已消费）等；服务已落地 `fetchSimpleVehicles` | operation 已核对；P04 带令牌联验 56 项真实加载（int64 key 字符串无损） |
| 分组 | `GET /dispatcher/vehicleGroup/getVehicleGroups` | 无（全量） | P03（已消费）/P20；P04 起服务 owner=P04（选项 fetchVehicleGroups 保持不变） | operation 已核对；P03 联验已消费 |
| 载具 | `POST /dispatcher/carrier/pageCarriers` | 分页查询（body 平铺） | P06 载具类型页（消费中）；其他关联载具的页面任务 | operation 已核对；服务已落地 `services/vehicle/carrier.service`（owner=P06，含 create/update/delete 三写操作），P06 带令牌联验通过 |
| 动作 | `GET /action/agvAction/getAGVActions` | 无（全量） | P24/P20 | operation 已核对，服务随 P24 |
| 工艺模板 | `GET /dispatcher/orderTemplate/getOrderTemplates` | 无（全量） | P03/P21 | operation 已核对，服务随 P03 |
| 驱动（电梯/充电桩/自动门/风淋门/交通灯） | `GET /device/elevator/getElevatorDrivers`；`GET /device/chargePile/getChargePileDrivers`；`GET /device/autoDoor/getAutoDoorDrivers`；`GET /device/airShowerDoor/getAirShowerDoorDrivers`；`GET /device/trafficLight/getDrivers` | 无（全量） | P14–P18 | operation 已核对，服务随各设备页 |
| 电梯 | `GET /device/elevator/getElevators` | 无（全量） | P10 | operation 已核对，服务随 P10 |
| 角色 | `GET /auth/role/getRoles` | `userId`(可选) | P31/P32 | operation 已核对，服务随 P31 |
| 品牌 Logo | `GET /systemLogos`（listMeta）；二进制 `GET /systemLogos/{placementKey}/file` | — | P01/P27 | operation 已核对（T00.3 已实证 systemLogos 无令牌返回 code=200）；服务随 P01/P27 |

### 5.1 只读地图共享组件（T00.7 已落地）

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 组件 | `src/components/ReadOnlyMap/ReadOnlyMap.tsx`（默认导出供 React.lazy 按需加载，konva 随组件进异步 chunk）；能力=只读渲染/平移缩放/节点与路径选点/定位高亮/回填回调；不引入地图编辑、监控、回放、车辆图层（H01/H02 范围） | 已落地（T00.7） |
| 数据供给 | `mapId`（内部 `fetchMapGraph`：加载/失败/空态闭环，失败渲染 StateBlock offline + 显式重试）或 `graph` 外部直供（跳过请求） | 已落地；getMapInfo 真实联验随 P07（G03 凭据） |
| 选中与回填 | `onChange(MapSelectedItem[])` 携带完整节点/路径 DTO；`initialSelectedIds` 回显（失效 ID 静默忽略，上层以原值标注不可用）；`ref` 暴露 fitView/zoom/clearSelection/setSelectedIds/focusNode/focusEdge/reload | 机制已实证（浏览器：回显回调携带完整 DTO、点击命中回填）；fitView/闪烁动画随 P07 真实浏览器联验 |
| 依赖 | `react@19.3.0`（minor 升级，满足 react-konva peer）+ `react-konva@19.3.0` + `konva@^9.3.20`（与旧系统实装版本一致；react-konva peer 支持 ^9；konva@10 未经本轮等价验证故不采用）；`vite.config.ts` optimizeDeps.include 预声明 react-konva（避免动态发现优化导致的二次 reload 与陈旧产物双 React 实例） | 已安装并锁定（T00.7）；组件在本轮浏览器机制验证中真实渲染（三层 canvas + 选中环像素级确认） |
| 命名空间 | 地图组件文案走共享 `map` 命名空间（en-US 分片已交付；zh-TW/ja/ko 回退简中已登记）；消费页面需在路由 meta.i18nNamespaces 声明 `'map'` | 已落地（en-US 6 键） |

## 6. 实体导航契约（owner：T00，页面任务接入）

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 任务详情 | `/order-info?orderKey=<任务编号>`（命名参数，裸值 `?KEY`/`?KEY=` 历史兼容；构造/解析单一真相 `features/order-detail/orderDetailNavigation.ts`）；默认工作区页签（路由在受保护根内）+「独立窗口」按钮；快速预览弹窗复用 OrderDetailPanel 详情业务组件；参数名 orderKey 已按旧调用点核对（旧源码无导航调用点，直访裸值形态） | 已验证（P38 带令牌联验 2026-09-18） |
| 车辆详情 | `/vehicle-info?vehicleKey=<车辆唯一标识>`（命名参数，裸值 `?KEY`/`?KEY=` 历史兼容；构造/解析单一真相 `features/vehicle-detail/vehicleDetailNavigation.ts`）；默认工作区页签（路由在受保护根内）+「独立窗口」按钮；可见轮询 useVisiblePolling（实时状态页）；列表抽屉快速预览不替代完整详情路由（footer「完整详情」入口由宿主页 VehicleDisplay 组装跨域导航，features 域间禁导入）；参数名 vehicleKey 已按旧调用点核对（旧源码无导航调用点，直访裸值形态） | 已验证（P39 带令牌联验 2026-09-18；P05 往返的抽屉点击链路受 IAB rAF 冻结阻塞，两端点已分别实证，登记 P39.md） |
| 首页落点 | 登录后优先 `/dashboard`（P34 合并首页）；无权限进首个有权限且可用业务页；无可用页明确反馈 | 已确认（D29） |
| 暂缓页 | 统一「本期暂未迁移」说明组件，保留合法上下文与原权限 | 已确认（D07） |

## 7. i18n / 时区契约（owner：T00，T00.8 已落地、T00.9 冻结）

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 语言 | 五语言 `SUPPORTED_LANGUAGES = ['zh-CN','zh-TW','en-US','ja-JP','ko-KR']`（`src/i18n/i18n.ts`）；中文 key 即文案（keySeparator/nsSeparator=false）；命名空间按「语言 × 命名空间」懒加载，查无 loader 返回空资源经 fallbackLng 回退简中 | 已落地并经真实浏览器五语言全链路实证（T00.8） |
| 归一化 | `normalizeLanguage(raw)`：en*→en-US、ja*→ja-JP、ko*→ko-KR；繁中变体（zh-tw/zh-hk/zh-mo/zh-hant*）精确保留 zh-TW 不并入简中；zh-cn/zh/zh-hans/未知回退 zh-CN。全部语言读取路径（存储/迁移/回滚）统一经此收敛 | 已落地（繁/日/韩不误映射经注入值实证，T00.8） |
| 语言偏好 | 单一真相源 localStorage `apex-admin:lang`，唯一读取入口 `readStoredLanguage()`；同源旧 key `umi_locale` 一次迁移（写新删旧不留双源）；settings 持久化恢复以独立语言 key 为准（持久化镜像不反向覆盖）；退出登录保留语言偏好 | 已落地并实证（含 fr-FR 非法残留归一化不挂起，T00.8） |
| 切换 | 统一走 `changeAppLanguage(lang)`：预加载 base+已开页签命名空间 → i18next/antd ConfigProvider/dayjs/`document.documentElement.lang`/请求层 `Accept-Language`（含上传通道）同帧切换；预加载失败抛错不改状态，App catch 回滚到实际语言（失败保留原语言） | 已落地（真实网络失败场景随页面任务联调） |
| 第三方 locale | antd `ANTD_LOCALES` 五语言映射（App.tsx，typecheck 强制全key）；ApexTableReact 五语言 locale 包（第 3 节）；dayjs 五 locale 静态注册；控件弹窗按钮文案随首个消费者页面联验 | 已落地；控件文案联验随 P03 等 |
| 页面命名空间 | 各页归属终版见 `i18n-map.md`「各页命名空间/文件归属终版（T00.9 冻结）」；页面在路由 meta.i18nNamespaces 声明，分片四语言随页面任务交付 | 已冻结（T00.9） |
| 时区 | 部署时区优先，缺省 Asia/Shanghai，环境配置提供；`DEPLOY_TIMEZONE` 常量唯一定义点 `src/constants/datetime.ts`，页面不得各自硬编码；dayjs utc/timezone 插件单点装配于 `src/utils/datetime/deployDayjs.ts`；解析/展示纯函数 `parseBackendDateTime`/`formatInDeployTimezone`/`displayDateTime`（`src/utils/datetime/datetimeDisplay.ts`）：墙钟字符串按部署时区、带偏移换算、纯日期=部署时区零点、无法识别返回 null 不猜 | 已落地（D23/T00.7）；带偏移时间真实样本联调随报表页 |

## 8. 契约变更日志

| 日期 | 契约 | 变更 | 操作者 | 消费者影响 |
| --- | --- | --- | --- | --- |
| 2026-09-17 | 全部 | 初始化框架 | T00 run-20260917-121624-7468 | — |
| 2026-09-17 | 请求基础路径/代理/时区/表格组件 | `DEFAULT_API_BASE_URL` `/api/v1`→`/fms/v1`；dev 代理默认目标 `10.11.2.67:8888`、`/fms` 不改写；新增 `DEPLOY_TIMEZONE`（`VITE_DEPLOY_TIMEZONE`）；安装 `apex-table-react@0.1.0` | T00（T00.2 run） | 现有模板 service 的相对请求路径随之指向 `/fms/v1`；模板旧协议（envelope/错误形状）仍待 T00.3 重写，期间模板页面联调不可用属预期 |
| 2026-09-17 | 请求协议/认证/会话 | T00.3 落地：Result 解包（code=200）、业务码常量（1000000/1001000/1000010）、ApiError 带 businessCode、文件通道透传、Bearer + Accept-Language 头、移除 refresh/me/logout(旧路径) 假定、会话持久化（auth schema v1→v2）、authBridge 令牌同步与多窗口退出、profile 虚构接口删除；`DEFAULT_PAGE_SIZE` 保留为通用默认；安装 spark-md5@3.0.2 | T00（本轮 run） | `api` 调用方语义变化：返回值为 Result.data（非原始 body）、code≠200 抛 `ApiRequestError`；auth 会话消费方（Header/Profile/useLogin/guard）已同步适配；删除 `userPatched`/`loadSession`/`MeResponseDto`/`API_ERROR_CODES` 等模板导出；`EntityStatus`/`PageQuery`/`PageResult` 保留为模板遗留类型（已标注不得在新代码引用，随 P03/P31/P32/P34 替换后删除） |
| 2026-09-17 | 权限与路由 | T00.4 落地：权限码常量（PERM/PERM_BUTTON/ROOT_ONLY_CODES，码值与旧系统逐一核实对齐）、权限纯函数与路由访问核心（超管短路/祖先填充/落点解析/回跳校验）、定义树 meta.perm 挂码 + migrationPending/public 标记、认证+权限守卫覆盖独立页、目录与首页动态落点、迁移过渡占位（MigrationPending，pending 页不加载页面代码）、DockMenu 权限剪枝、affix 播种按权限过滤、usePermission 按钮码 hook、LoginForm 落点接入；连带修复 T00.3 缺陷：store migrate 无条件重置（持久化恢复失效）与 authBridge 监听键名缺 persist: 前缀（多窗口退出同步失效） | T00（本轮 run） | 全部路由 meta 增加 perm 字段（页面任务按钮权限经 usePermission 消费 PERM_BUTTON）；页面任务完成后由统筹移除本页 migrationPending 标记（definitions.tsx 单点）；菜单消费者必须传访问上下文（buildMenuRoutes 签名变更，DockMenu 已适配） |
| 2026-09-17 | 表格接入形态 | 用户决策：**禁止对 apex-table-react 二次封装**（撤销 T00.5 首轮薄适配组件方案，相关代码已全部撤回）；页面直接使用 ApexTableReact 公开 API（组件/locale/官方列偏好适配器/插槽/ref）；公共设施仅限五语言 locale 包（包内仅内置 zhCN）、主题 `--apex-table-*`→`--app-*` 变量映射、pageIndex→pageNo 换算与行 ID 纯函数、不包裹表格的独立状态块；规格 6.1 与 TASKS DoD#4/T00.5/§2.2 已同步修订 | 用户（本轮 run） | 全部表格页面任务直接 import apex-table-react 并自行组装 props；公共资源的具体文件位置与形状在 T00.5 交付时登记 |
| 2026-09-17 | 表格公共资源落地 | T00.5 交付：五语言 ApexLocale 包（`src/i18n/locales/apexTable/` + `resolveApexLocale`/`useApexLocale`）、主题映射（globals.css `:root .apex-table`，亮暗成对）、分页换算 `toBackendPage`、行 ID `stringFieldRowId`、列偏好约定 `createTableColumnPreferences`/`useColumnPreferences`、统一状态块 `StateBlock`（noPermission/gap/offline）；公开 API 核验（虚拟化/展开/编辑/双 ref）经类型探针全量组装验证后删除探针 | T00（本轮 run） | P03/P05 起全部表格页按 contracts.md 第 3 节约定组装：`useApexLocale()` 供 locale、`toBackendPage` 供 request 分页、`stringFieldRowId` 供 getRowId、`useColumnPreferences` 供列偏好、StateBlock 供失败/无权限/缺口区域；zh-TW/ja/ko 的 StateBlock 文案回退简中已登记 i18n-missing.md，T00.8 补齐 |
| 2026-09-17 | 共享业务能力落地（T00.7） | ① 时间/时区：`deployDayjs`（utc/timezone 单点装配）+ `datetimeDisplay`（parseBackendDateTime/formatInDeployTimezone/displayDateTime，缺失/不可解析→'—' 不猜）；② 统计空值/单位：`src/utils/stats/metricFormat.ts`（0 与缺失严格区分、safeRatio 除零→null、formatPercent/formatWithUnit/secondsToHours，公式归页面 owner）；③ 控制确认/未知/批量反馈：`src/utils/command/`（CommandOutcome 三态、confirmCommand 列对象+影响+提交≠完成附注、summarizeBatchOutcomes/summarizeWholeBatch/formatBatchSummaryText，缺项计入未知、整批不编造逐项）；④ 选项失效：`src/utils/options/optionFallback.ts` + `src/hooks/useStaticOptions.ts`（scope 取消/防乱序/失败清空）；⑤ 只读地图：`src/services/map/`（getMapInfo/getSimpleMaps）+ `src/components/ReadOnlyMap/`（11 文件，能力见 5.1 节）；⑥ 依赖：react 19.2.8→19.3.0、@types/react 19.3.0、konva@^9.3.20、react-konva@^19.3.0、vite optimizeDeps 预声明 react-konva | T00（本轮 run） | 消费者：实时页/详情页轮询不变；P07 起地图页消费 ReadOnlyMap+useMapGraph+map 命名空间；选项页自 P03 起消费 useStaticOptions；写操作页消费 confirmCommand/批量归纳；报表页消费 metricFormat 与 datetimeDisplay；common 新增 8 键、新增共享 map 命名空间（消费页面 meta.i18nNamespaces 声明） |
| 2026-09-17 | 页签/草稿/轮询/传输契约落地 | T00.6 交付：`tabsSlice` 增加 dirty 标记（LRU 豁免脏页签）、`useTabDirtyGuard`（页面草稿登记）、`useTabActionGuard`（关闭/刷新/批量关闭/退出登录统一确认，三档传输提示策略）、`beforeunload` 脏页签离开提示、`useVisiblePolling` + `polling.constants`（可见串行轮询/退避集中配置）、`transferManager` + `useTransfers` + `TransferWatcher`（独立传输生命周期/关页提示/孤儿完成消息/会话结束清理）、`openStandaloneWindow`（独立窗口工具）；`RequestScopeValue` 增加 `scopeKey` 字段 | T00（本轮 run） | 实时页面（P34/P05/P39/P40）轮询一律消费 `useVisiblePolling`，禁止私设定时器；文件传输页面（P08/P09/P25/P26/P30 等）一律经 `beginTransfer` 登记并把句柄 signal 传给请求层；全部写草稿页面自 P03 起消费 `useTabDirtyGuard`；消费者注意：`RequestScopeValue` 新增 scopeKey（现有 usePageActive/usePageRequest 消费不受影响） |
| 2026-09-17 | 五语言基座落地 | T00.8 交付：`SUPPORTED_LANGUAGES` 扩五语言、`normalizeLanguage` 精确归一化（zh-TW/ja-JP/ko-KR 不误映射）、语言×命名空间懒加载表（zh-TW/ja-JP/ko-KR 基座五分片 common/menu/auth/error/map 全量，key 集合与 en-US 一致）、`readStoredLanguage` 单一读取入口 + umi_locale 一次迁移（写新删旧）、settings 持久化 migrate 以独立语言 key 为单一真相源（修复镜像覆盖迁移）、`ANTD_LOCALES` 五语言映射 + 切换失败回滚、dayjs 五 locale、html lang 同步、Header 语言菜单五项 | T00（本轮 run） | 页面任务不得绕过 `changeAppLanguage`/`normalizeLanguage` 直调 i18next.changeLanguage；页面私有分片放 `src/i18n/locales/<语言>/<命名空间>.ts` 并在懒加载表登记（命名空间归属见 i18n-map.md T00.9 冻结表）；请求层语言头已含上传通道，页面不得单独读 umi_locale |
| 2026-09-17 | 全表冻结 | T00.9 冻结交接：contracts.md 各节与实际公共导出核对一致（清点见 tasks/T00.md T00.9 节）；第 7 节 i18n 契约更新为落地实况；各页 namespace/文件归属终版冻结于 i18n-map.md；过渡期 mock 退出运行路径复核成立（pending 页不触发 lazy，order.mock/dashboard.mock 不可达，文件本体归 P03/P34 移除）。此后契约变更须在变更日志登记 owner 与全部消费者影响 | T00（本轮 run） | B1（P01）与 B2 样板（P03/P05/P38/P39）所需机制已就绪；真实登录成功路径/带令牌只读联验受阻 G03（测试凭据），B1 放行前必须补验，不以未验机制宣称放行 |
| 2026-09-18 | 业务码 1001000 引导 / 会话激活状态 / 新增 license-activation 域 | P02 交付：① request.ts 新增 1001000 单飞收敛（提示+`apex:activation-required` 事件，`activationGuidanceHandled` 随新令牌复位；授权页自身路径抑制）；② authSlice 新增 `activationConfirmed`（激活成功更新 activated，供落点解析）；③ 新增 `services/license-activation`（getHardwareInfo/softwareActivation，P29 共用）与 `features/license-activation`（ActivationForm/ActivationRedirectListener/useHardwareInfo/copyText，App 根挂载监听）；④ definitions.tsx standaloneMeta 签名扩展 i18nNamespaces，/authorize-ingress 摘除 migrationPending；⑤ i18n 新增 license-activation 命名空间（四语言分片）+ common 四语言各增 1 键 | P02（本轮 run） | 消费者影响：standaloneMeta 其余调用兼容（typecheck 证实）；请求层新增分支不影响既有业务码路径；未激活环境的业务请求（自 P03/P05 起）将触发引导跳授权页；P29 消费 ActivationForm 时路由 meta 须声明 `license-activation` |

| 2026-09-18 | 文件下载通道 + 共享选项服务 + orderRecord 五语言 | P03 交付：① request.ts 新增 `api.downloadGet`（GET+Blob+完整响应，`apexRawResponse` 配置标记；JSON 错误仍走统一解包）与 `resolveDownloadFilename`（RFC 5987），既有消费者行为不变；② P03 代建共享选项服务（contracts 第 5 节唯一 operation）：`services/vehicle`（fetchSimpleVehicles→P04）、`services/vehicle-group`（fetchVehicleGroups→P04）、`services/action`（fetchAGVActions/fetchAGVActionGroups→P24）、`services/order-template`（fetchOrderTemplates，owner=P03 供 P20/P21）、`services/map` 增 fetchMapSites（→P10）；全部经 useStaticOptions 消费，零复制请求；③ orderRecord 四语言分片交付（en-US 旧真译沿用+补译；zh-TW/ja-JP/ko-KR 按 B1 基线补译，「车辆」旧真译迁入）；④ 新增共享 `utils/clipboard`（P02 域内 copyText 未动，后续可收口） | P03（本轮 run） | 消费者影响：请求层扩展向后兼容（typecheck/build 全绿）；选项服务 owner 交接见第 5 节（P04/P10/P24 接手后维护）；order-record 路由 pending 标记移除，本页进入登录落点候选 |
| 2026-09-18 | 表格列设置接入形态（用户决策） | 业务表格开启 `columnSettingsEnabled` 时**序号列默认放出**（不传 `showRowNumber={false}`）：包内把列设置齿轮入口放进序号列表头，行内显示序号；显式关闭序号列会使齿轮退化为表头上方独立工具条行（P03 实测）。序号列是辅助轨道，不进列偏好 columnOrder/columnVisibility 切片。P03 联验同轮修复两处页面接线缺陷：受控切片须随 onChange 更新（否则改动被回弹）；适配器 save 为整体替换语义，必须保存合并后的完整四切片（面板一次确认连发四类回调，单片补丁互相覆盖） | 用户 / P03（联验轮） | 消费者影响：P05 起全部带列设置的表格页照此形态接入（序号列默认放出 + `useColumnPreferences` 四步接线见 columnPreferences.ts 文件头）；第 3 节列偏好行补此交互约定 |
| 2026-09-18 | 车辆管理服务 + 控制交互样板 | P05 交付：① `services/vehicle` 扩展 vehicle-manage 服务（pageVehicles/addVehicle/updateVehicle/deleteVehicle/vehicleOperate/allVehicleOperate/getUnRelationSimpleVehicles，owner=P05；P03 代建 getSimpleVehicles 选项服务不变）；② 控制样板（设备类页面复用）：useVisiblePolling 可见轮询 → confirmCommand 列对象与影响 → verifyVehicleFresh 执行前核验（pageVehicles+query 重查目标，missing/stale 不执行并刷新）→ 发命令；批量整批接受诚实呈现（后端无逐项契约，A15）；③ `vehicleList` 命名空间四语言分片（en 旧真译沿用+补译，繁日韩 B1 基线，「マップ/맵」真译迁入）；④ 路由 vehicle-diplay 解除 pending（历史拼写保留），进入登录落点候选 | P05（本轮 run） | 消费者影响：vehicle-manage 服务可被设备页复用（verifyVehicleFresh 样板工具在 features/vehicle-list/）；本页按钮码消费 PERM_BUTTON.VEHICLE_LIST_*（已登记）；写副作用执行与 P39 独立详情往返登记待验收 |
| 2026-09-18 | 实体页签契约落地 + 任务详情双形态 + 详情参数契约 | P38 交付：① order-info 路由移入受保护根（完整路径 /order-info 不变；hideInMenu 不进菜单/落点候选）——实体页签机制首个消费者，默认工作区页签形态达成，P39/P40 接入时同构迁移；② 详情参数单一真相 `features/order-detail/orderDetailNavigation.ts`：命名参数 `?orderKey=` + 历史裸值 `?KEY` 及页签规范化变体 `?KEY=` 兼容解析；③ 详情业务组件 `features/order-detail/components/OrderDetailPanel`（单请求喂主体+mission 表）由完整页与快速预览弹窗共用——OrderInfoModal/MissionActionsTable 迁入 features/order-detail（跨 feature 禁止导入，弹窗外壳随迁，OrderRecord.tsx 仅改导入路径）；④ 枚举展示常量提升 `src/constants/order/orderDisplayOptions.ts`（orderRecord/orderDetail 两域共同消费，orderRecordOptions 改 re-export）；⑤ 服务层 getOrderRecordDetail 返回类型如实标注可空（任务不存在 code=200+data=null 实证）；⑥ orderInfo 命名空间四语言分片 + order-record 路由 meta 增声明该命名空间（弹窗新按钮文案） | P38（本轮 run） | 消费者影响：实体页签/独立窗口行更新（第 4、6 节）；P39/P40 照此形态迁移路由并核对各自参数；OrderInfoModal 导入路径变化仅 OrderRecord.tsx 一处（已同步）；getOrderRecordDetail 可空语义消费者为 OrderDetailPanel（已判空）；P03 详情弹窗行为经回归联验不变形；i18n 纪律沉淀：nsSeparator=false 下 t() 禁带「ns:」前缀（AGENTS 第 2 节） |
| 2026-09-18 | 实体页签第二消费者 + 车辆详情双形态轮询 + 车辆域常量提升 + 修复两处 i18n 缺陷 | P39 交付：① vehicle-info 路由移入受保护根（完整路径 /vehicle-info 不变；hideInMenu；perm=vehicle-list:view）——实体页签第二消费者同构落地；② 参数单一真相 `features/vehicle-detail/vehicleDetailNavigation.ts`（命名 `?vehicleKey=` + 裸值 `?KEY`/`?KEY=` 兼容；旧源码无导航调用点直访裸值形态实证）；③ 新增 `features/vehicle-detail`（VehicleDetailPanel：getVehicleState 递归展平 Descriptions + useVisiblePolling 可见轮询；失败清空远端区域退避重查、不存在态停轮询）与 `services/vehicle/vehicle-state.service`（fetchVehicleState 返回可空，GET 平铺 query G04）；④ 车辆域枚举映射与 formatComponent 自 vehicleListOptions 提升至 `src/constants/vehicle/vehicleDisplayOptions.ts`（P05/P39 两域共同消费，vehicleListOptions 改 re-export，P05 三处消费者导入路径不变）；⑤ P05 抽屉 footer 新增「完整详情」入口（导航回调由宿主 VehicleDisplay 组装，features 域间禁导入）；⑥ 修复两处 i18n 缺陷：OrderDetailPanel `t('orderInfo:…')` 前缀 key 显示字面量（nsSeparator=false 违反 AGENTS 第 6 节，改 nsMode fallback 无前缀）；P39 自查发现 zh-TW 分片误用繁体 key（key 必须简中文案，全部改回简中 key + 繁体 value）；⑦ vehicleInfo 命名空间四语言分片（en 旧真译沿用，繁日韩 B1 基线补译，67 key 四语言同构） | P39（本轮 run） | 消费者影响：实体页签行更新为 P38/P39 双消费者（P40 照此迁移）；vehicleListOptions re-export 对 P05 三处消费者透明（typecheck/build 实证）；OrderDetailPanel 命名空间数组化对既有 orderRecord key 零影响（P38 缺陷修复复验通过）；VehicleDisplay 新增 useNavigate + onOpenFullDetail 回调（P05 交付行为不变）；抽屉「完整详情」宿主组装模式沉淀：跨域详情入口一律 pages 层组装导航 |

| 2026-09-18 | 车辆分组管理页 + vehicle-group 服务 owner 交接 | P04 交付：① `services/vehicle/vehicle-group` 扩展 pageVehicleGroups/addVehicleGroup/updateVehicleGroup/deleteVehicleGroup（owner 自 P04 起持有；P03 代建 fetchVehicleGroups 选项函数签名与行为不变，P03/P20 消费者透明）；② `features/vehicle-group/components/GroupFormModal`（草稿保留/useTabDirtyGuard/Transfer 复用 getSimpleVehicles 共享契约/失效关联合成条目：组内车辆 key 不在选项集合时保留原标识+「已不可用」标注+保存原样提交，不静默替换）；③ `pages/vehicle-deploy/VehicleGroup` 整页重写（Apex request+列偏好 tableId `vehicle-group:main`+expandable 展开行组内车辆 Tag+confirmCommand 破坏性删除确认）；④ 路由 vehicle-group 解除 pending（进入登录落点候选），meta.i18nNamespaces=['vehicleGroup']；⑤ vehicleGroup 四语言分片 33 key 同构（en 旧真译沿用+补译，繁日韩 B1 基线补译） | P04（本轮 run） | 消费者影响：fetchVehicleGroups 消费者（P03 CreateOrderModal/P20）无感（typecheck 实证）；definitions.tsx 仅本页 meta 行变化；i18n.ts 四表各增 1 行；联验发现后端缺陷 P04-G1（updateVehicleGroup groupName 不落库，vehicleKeys 生效；前端行为正确）登记 gaps.md，不阻塞后续任务（P19/P20 仅消费分组选项） |
| 2026-09-19 | 载具类型管理页 + carrier 服务落地 + 载具权限码核对收敛 | P06 交付：① 新增 `services/vehicle/carrier.service`（pageCarriers/createCarrier/updateCarrier/deleteCarrier 四 operation 均为 POST+JSON body，与 vehicleGroup 的 GET+query 分页形态不同，保持旧实现与 OpenAPI 清单原样；owner=P06）；② `features/carrier-type/components/CarrierFormModal`（草稿保留/useTabDirtyGuard/失败留稿；名称/编码 64 字上限；长度宽度 InputNumber min=1，mm 协议原样）；③ `pages/vehicle-deploy/VehicleType` 整页重写（Apex request+列偏好 `carrier-type:main`+名称编码双筛选+confirmCommand 破坏性删除确认；G09 不开放排序；无轮询）；④ 路由 vehicle-type 解除 pending，perm 挂 `PERM.CARRIER_VIEW`（后端权限树真实 MENU 码 id=23，path 为空；旧路由未写 access、旧前端 MENU_TREE 兜底映射本路径——登记已有码非凭空造码），meta.i18nNamespaces=['carrierType']；⑤ carrierType 四语言分片 27 key 同构（en 旧真译沿用，繁日韩 B1 基线补译，「载具」沿用旧译実績词キャリア/캐리어/載具） | P06（本轮 run） | 消费者影响：carrier 服务暂无其他消费者（后续关联载具页面接入时复用）；PERM 新增 CARRIER_VIEW 对既有路由 meta 无影响（typecheck 实证）；definitions.tsx 仅本页 meta 行变化；i18n.ts 四表各增 1 行；联验实证 carrier 的 updateCarrier 名称/尺寸真实落库，无 G18 类缺陷 |

## 9. 冻结登记（T00.9）

1. **冻结范围**：第 1–7 节契约为 B1/B2 页面任务的消费基线；实现文件位置与导出以 tasks/T00.md「文件归属」节为准，两者经 T00.9 核对一致。
2. **变更规则**：冻结后新增/变更契约（含公共导出签名变化）由 owner 在变更日志登记，评估并记录全部消费者；页面任务发现契约缺陷报统筹，由原 owner 或指定接任者修复，不在页面内私有变通。
3. **放行状态**：B1/B2 所需机制（登录/会话/权限/路由守卫/表格公共资源/页签/轮询/传输/地图/五语言）实现与机制级验证齐备；**真实登录成功路径、带令牌授权只读联验受 G03 外部阻塞（需测试账号凭据），B1 放行前必须补验**——放行判定以补验证据为准，本登记不构成放行。
