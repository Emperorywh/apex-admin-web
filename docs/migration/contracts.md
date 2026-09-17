# 共享契约台账

> T00.1 初始化框架（2026-09-17）；T00.3–T00.8 逐节填充，T00.9 冻结。
> 本表登记跨页面消费的共享契约：请求协议、DTO 约定、权限、实体导航、表格、草稿、轮询、传输、地图、i18n、时区。页面任务消费前先查本表；新增/变更契约由 owner 登记并评估全部消费者。

## 1. 请求协议契约（owner：T00，T00.3 已落地）

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 基础路径 | `/fms/v1/...`，严格按 OpenAPI operation，不改写路径；`DEFAULT_API_BASE_URL='/fms/v1'`；dev 代理 `/fms` 原样转发（默认目标 `http://10.11.2.67:8888`，`APEX_DEV_PROXY_TARGET` 可覆盖）；经代理的端到端请求已实证（错误凭据登录返回业务码） | 已落地并实证（T00.2/T00.3） |
| 成功判定 | HTTP 成功且业务 `code=200`；不依赖 `message === 'success'` | 已落地并实证（GET /systemLogos 返回 `{code:200,...}`） |
| 响应包装 | `code/message/timestamp/data` 统一解包（`unwrapResult`）；文件/流（非 JSON content-type）原样透传不解包；非 Result 形状的 JSON 按 `CLIENT.MALFORMED_RESPONSE` 报错，不猜数据 | 已落地（T00.3） |
| 业务码 | `200` 成功；`1000000` 会话失效（真实实证：无凭据访问 pageUsers 返回该码，HTTP 200）→ 单飞清会话+一次性提示+外壳跳登录；`1000010` 用户名或密码错误（真实实证）；`1001000` 未授权（旧代码证据，真实行为待复核，跳转授权页归 P02） | 已落地（1001000 待复核） |
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
| 权限码契约 | `PERM`（菜单码）/ `PERM_BUTTON`（按钮码）/ `ROOT_ONLY_CODES`（auth:manage、auth:user:view、auth:role:view）定义于 `src/constants/auth/permission.constants.ts`，码值与旧系统逐一核实对齐；历史码值交叉保留：任务工艺页挂 `mission-flow:view`、工艺管理页挂 `mission-template:view`；载具类型/数据库备份旧路由未写 access（登录即可达，P06/P30 核对后再定，不凭空造码） | 已落地（T00.4） |
| 权限判定 | 纯函数 `@/utils/auth/permission`（isRootUser/flattenMenuCodes/hasButtonCode）+ 路由访问核心 `@/router/routeAccess`（buildAccessContext/hasMenuAccess/isLeafAvailable/resolveLandingPath/resolveDirectoryLandingPath/resolveSafeRedirectPath）；超管（root/administrator）短路全放行；菜单码扁平化 + 基于定义树的祖先填充（有子菜单则父分组可见）− root 专属码；按钮码 hook `usePermission()`（超管短路） | 已落地（T00.4） |
| 路由守卫 | 定义树 meta.perm 挂码；认证+权限守卫覆盖全部非 public 入口（含布局外独立页 order-info/vehicle-info/server-resource-monitor/authorize-ingress/no-permission，不因 layout:false 公开）；目录 index 与受保护根 index 按会话动态解析落点（目录索引不指向无权限/未迁移页）；迁移过渡页（meta.migrationPending）渲染统一占位、不加载页面代码（无请求）、不作落点候选；页面任务完成后由统筹移除标记 | 已落地并经 17 项真实浏览器场景实证（T00.4） |
| 登录落点 | activated=false → `/authorize-ingress`（D29）；首页（/dashboard，P34 合并后同码 dashboard-realtime:view）可用优先；否则菜单顺序首个「有权限且已完成迁移」业务页；全部不可用 → `/no-permission`；登录回跳仅接受站内、存在且可用的目标（resolveSafeRedirectPath） | 已落地并实证（T00.4） |
| 权限拒绝 | 阻止操作 + 提示重新登录；不伪造刷新 | 已确认（规格 5.9）；页面接入随各页任务 |
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
| 列偏好 | 官方适配器 `apex-table-react/adapters/local-column-preferences` 接入约定：`createTableColumnPreferences({tableId, userId})`（`src/utils/table/columnPreferences.ts`，namespace='apex-admin'、tenantId='default'、schemaVersion 默认 '1'，列结构变更须提升）+ `useColumnPreferences(tableId)` hook（会话取 userId、卸载 flush+dispose）；存储 key 四段隔离满足 DoD 5；页面接线四步见文件头 JSDoc | 已落地（T00.5）；localStorage 持久化行为待联验 |
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
| 实体页签 | tab.key = pathname + 规范化 search（参数名稳定排序）：实体详情以 `?id=<实体ID>` 等定位参数打开时，不同实体自动获得独立页签、独立 Activity 缓存实例与独立请求 scope，互不串缓存；同参数复用同一页签。默认工作区页签形态要求实体路由位于受保护根内（P38/P39/P40 接入时由统筹应用 definitions.tsx 差异） | 机制已落地并经浏览器验证（同路由不同 id → 两独立页签）；参数形状待 P38/P39 按旧调用点核对 |
| 独立窗口 | `openStandaloneWindow(path, params?, options?)`（`src/utils/window/standaloneWindow.ts`）：仅接受站内绝对路径；按「路由+排序参数」命名窗口（同实体复用窗口、异实体独立）；居中 1280×800 popup；打开成功后切断 opener。布局外路由（order-info/vehicle-info/server-resource-monitor）即独立窗口形态，受同一认证+权限守卫，会话/语言/主题来自持久化；多窗口退出同步复用 authBridge（T00.3） | 已落地并经浏览器验证（独立窗口加载 /order-info?id=88，守卫通过，T00.6） |

## 5. 共享只读选项契约（owner：T00）

跨页只读选项由 T00 登记唯一 operation（地图/节点、车辆、分组、载具、动作、工艺模板、驱动、电梯、角色、品牌）；查选项不等管理页完成，复用底层服务。逐项登记：

| 选项 | operation（待逐项核对 OpenAPI 后填） | 消费者 | 状态 |
| --- | --- | --- | --- |
| 地图/节点 | 待登记 | P07/P09/P10/P11/P19/P20 等 | 待 T00.7 |
| 车辆 | 待登记（`vehicle/getSimpleVehicles` 候选） | P04 等 | 待 T00.7 |
| 分组 | 待登记 | P04/P20 等 | 待 T00.7 |
| 载具 | 待登记 | 待定 | 待 T00.7 |
| 动作 | 待登记（`agvAction/getAGVActions` 候选） | P24/P20 | 待 T00.7 |
| 工艺模板 | 待登记 | P03/P21 | 待 T00.7 |
| 驱动 | 待登记（device/*/get*Drivers 候选） | P14–P18 | 待 T00.7 |
| 电梯 | 待登记 | P10 | 待 T00.7 |
| 角色 | 待登记（`auth/role/getRoles` 候选） | P31 | 待 T00.7 |
| 品牌 | 待登记（systemLogos 候选） | P01/P27 | 待 T00.7 |

## 6. 实体导航契约（owner：T00，页面任务接入）

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 任务详情 | `/order-info?...`（参数在 P03 旧调用点核对后定）；工作区页签默认 + 独立窗口/全屏；独立窗口经 `openStandaloneWindow`（contracts 第 4 节）；实体隔离靠页签 key 含实体参数 | 待 P38 定参数 |
| 车辆详情 | `/vehicle-info?...`（参数在 P05 旧调用点核对后定）；同上 | 待 P39 定参数 |
| 首页落点 | 登录后优先 `/dashboard`（P34 合并首页）；无权限进首个有权限且可用业务页；无可用页明确反馈 | 已确认（D29） |
| 暂缓页 | 统一「本期暂未迁移」说明组件，保留合法上下文与原权限 | 已确认（D07） |

## 7. i18n / 时区契约

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 语言 | 五语言 `zh-CN/en-US/zh-TW/ja-JP/ko-KR`；中文 key 即文案；命名空间懒加载 | 已确认（D34） |
| 语言存储 | 当前持久化设置为唯一来源；同源 `umi_locale` 一次迁移 | 已确认（18.4） |
| 时区 | 部署时区优先，缺省 Asia/Shanghai，环境配置提供；`DEPLOY_TIMEZONE` 常量已落地（`VITE_DEPLOY_TIMEZONE` 注入，唯一定义点 `src/constants/datetime.ts`），页面不得各自硬编码 | 已落地（D23）；展示工具 T00.7 接入 |

## 8. 契约变更日志

| 日期 | 契约 | 变更 | 操作者 | 消费者影响 |
| --- | --- | --- | --- | --- |
| 2026-09-17 | 全部 | 初始化框架 | T00 run-20260917-121624-7468 | — |
| 2026-09-17 | 请求基础路径/代理/时区/表格组件 | `DEFAULT_API_BASE_URL` `/api/v1`→`/fms/v1`；dev 代理默认目标 `10.11.2.67:8888`、`/fms` 不改写；新增 `DEPLOY_TIMEZONE`（`VITE_DEPLOY_TIMEZONE`）；安装 `apex-table-react@0.1.0` | T00（T00.2 run） | 现有模板 service 的相对请求路径随之指向 `/fms/v1`；模板旧协议（envelope/错误形状）仍待 T00.3 重写，期间模板页面联调不可用属预期 |
| 2026-09-17 | 请求协议/认证/会话 | T00.3 落地：Result 解包（code=200）、业务码常量（1000000/1001000/1000010）、ApiError 带 businessCode、文件通道透传、Bearer + Accept-Language 头、移除 refresh/me/logout(旧路径) 假定、会话持久化（auth schema v1→v2）、authBridge 令牌同步与多窗口退出、profile 虚构接口删除；`DEFAULT_PAGE_SIZE` 保留为通用默认；安装 spark-md5@3.0.2 | T00（本轮 run） | `api` 调用方语义变化：返回值为 Result.data（非原始 body）、code≠200 抛 `ApiRequestError`；auth 会话消费方（Header/Profile/useLogin/guard）已同步适配；删除 `userPatched`/`loadSession`/`MeResponseDto`/`API_ERROR_CODES` 等模板导出；`EntityStatus`/`PageQuery`/`PageResult` 保留为模板遗留类型（已标注不得在新代码引用，随 P03/P31/P32/P34 替换后删除） |
| 2026-09-17 | 权限与路由 | T00.4 落地：权限码常量（PERM/PERM_BUTTON/ROOT_ONLY_CODES，码值与旧系统逐一核实对齐）、权限纯函数与路由访问核心（超管短路/祖先填充/落点解析/回跳校验）、定义树 meta.perm 挂码 + migrationPending/public 标记、认证+权限守卫覆盖独立页、目录与首页动态落点、迁移过渡占位（MigrationPending，pending 页不加载页面代码）、DockMenu 权限剪枝、affix 播种按权限过滤、usePermission 按钮码 hook、LoginForm 落点接入；连带修复 T00.3 缺陷：store migrate 无条件重置（持久化恢复失效）与 authBridge 监听键名缺 persist: 前缀（多窗口退出同步失效） | T00（本轮 run） | 全部路由 meta 增加 perm 字段（页面任务按钮权限经 usePermission 消费 PERM_BUTTON）；页面任务完成后由统筹移除本页 migrationPending 标记（definitions.tsx 单点）；菜单消费者必须传访问上下文（buildMenuRoutes 签名变更，DockMenu 已适配） |
| 2026-09-17 | 表格接入形态 | 用户决策：**禁止对 apex-table-react 二次封装**（撤销 T00.5 首轮薄适配组件方案，相关代码已全部撤回）；页面直接使用 ApexTableReact 公开 API（组件/locale/官方列偏好适配器/插槽/ref）；公共设施仅限五语言 locale 包（包内仅内置 zhCN）、主题 `--apex-table-*`→`--app-*` 变量映射、pageIndex→pageNo 换算与行 ID 纯函数、不包裹表格的独立状态块；规格 6.1 与 TASKS DoD#4/T00.5/§2.2 已同步修订 | 用户（本轮 run） | 全部表格页面任务直接 import apex-table-react 并自行组装 props；公共资源的具体文件位置与形状在 T00.5 交付时登记 |
| 2026-09-17 | 表格公共资源落地 | T00.5 交付：五语言 ApexLocale 包（`src/i18n/locales/apexTable/` + `resolveApexLocale`/`useApexLocale`）、主题映射（globals.css `:root .apex-table`，亮暗成对）、分页换算 `toBackendPage`、行 ID `stringFieldRowId`、列偏好约定 `createTableColumnPreferences`/`useColumnPreferences`、统一状态块 `StateBlock`（noPermission/gap/offline）；公开 API 核验（虚拟化/展开/编辑/双 ref）经类型探针全量组装验证后删除探针 | T00（本轮 run） | P03/P05 起全部表格页按 contracts.md 第 3 节约定组装：`useApexLocale()` 供 locale、`toBackendPage` 供 request 分页、`stringFieldRowId` 供 getRowId、`useColumnPreferences` 供列偏好、StateBlock 供失败/无权限/缺口区域；zh-TW/ja/ko 的 StateBlock 文案回退简中已登记 i18n-missing.md，T00.8 补齐 |
| 2026-09-17 | 页签/草稿/轮询/传输契约落地 | T00.6 交付：`tabsSlice` 增加 dirty 标记（LRU 豁免脏页签）、`useTabDirtyGuard`（页面草稿登记）、`useTabActionGuard`（关闭/刷新/批量关闭/退出登录统一确认，三档传输提示策略）、`beforeunload` 脏页签离开提示、`useVisiblePolling` + `polling.constants`（可见串行轮询/退避集中配置）、`transferManager` + `useTransfers` + `TransferWatcher`（独立传输生命周期/关页提示/孤儿完成消息/会话结束清理）、`openStandaloneWindow`（独立窗口工具）；`RequestScopeValue` 增加 `scopeKey` 字段 | T00（本轮 run） | 实时页面（P34/P05/P39/P40）轮询一律消费 `useVisiblePolling`，禁止私设定时器；文件传输页面（P08/P09/P25/P26/P30 等）一律经 `beginTransfer` 登记并把句柄 signal 传给请求层；全部写草稿页面自 P03 起消费 `useTabDirtyGuard`；消费者注意：`RequestScopeValue` 新增 scopeKey（现有 usePageActive/usePageRequest 消费不受影响） |
