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

## 3. 表格契约（owner：T00，T00.5 落地）

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 组件 | 官方 npm `apex-table-react@0.1.0`（T00.2 已安装并提交锁文件；类型探针验证 React 19/TS 6 兼容）；无 antd Table/自绘 table；**页面直接使用包公开 API，禁止二次封装**（用户决策 2026-09-17，规格 6.1 修订） | 已安装（A07）；公共资源与约定 T00.5 |
| request 模式 | 零基 pageIndex → 后端 pageNo；返回 `data/rowCount` | 已确认（规格 6.2） |
| data 模式 | 仅真实完整小集合与草稿行 | 已确认（规格 6.2） |
| 行 ID | 稳定业务标识；嵌套行区分作用域 | 已确认 |
| 选择 | 当前页选择；翻页/筛选/失权清理 | 已确认 |
| 列偏好 | 按服务实例/用户/tableId/版本隔离，可重置 | 已确认 |
| 排序 | 仅真实支持的能力 | 已确认（G09） |

## 4. 页签/草稿/轮询/传输契约（owner：T00，T00.6 落地）

| 项 | 契约 | 状态 |
| --- | --- | --- |
| 草稿 | 切页保留内存草稿；脏页签不被 LRU 淘汰；关闭/刷新/批量关闭统一检查 | 已确认（D12） |
| 实时轮询 | 页签激活且文档可见时约 5 秒串行；恢复即查；失败有上限退避；隐藏保留快照 | 已确认（D14） |
| 传输 | 独立传输生命周期，不依赖页面 effect；关页提示；仅真实可取消才提供取消 | 已确认（D26） |
| 实体页签 | 详情按实体 ID 隔离页签缓存与请求 | 已确认（D08） |

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
| 任务详情 | `/order-info?...`（参数在 P03 旧调用点核对后定）；工作区页签默认 + 独立窗口/全屏 | 待 P38 定参数 |
| 车辆详情 | `/vehicle-info?...`（参数在 P05 旧调用点核对后定） | 待 P39 定参数 |
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
