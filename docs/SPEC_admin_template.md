# Apex Admin Web — 通用后台管理系统模板规格说明

> 版本：v1.0 · 日期：2026-08-14 · 状态：已确认（经访谈敲定）
>
> 本文档是实现的唯一依据。所有标注「已定」的条目来自访谈结论；标注「默认」的条目为访谈未覆盖、按行业惯例选定的合理默认，实现时如有异议以本文档为准修改。

---

## 1. 项目概述

一个**通用后台管理系统前端模板**，开箱包含：明暗主题、界面设置面板、导航与多级菜单、多语言、路由体系、RBAC 权限、全局状态管理、axios 封装、多页签（带页面缓存）。模板**不绑定特定后端**：通过静态路由 + 权限码过滤实现 RBAC，并内置可一键剔除的「演示模式」兜底数据。

设计原则：

- **约定大于配置**：路由 meta、权限码、i18n key 命名均有统一约定。
- **模板即文档**：示例页面（RBAC 管理三连）直接演示全部核心能力。
- **可裁剪**：演示模式、示例页面、图表均可低成本移除。

---

## 2. 技术栈与版本基线

| 类别 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | React 19.2 + TypeScript ~6.0 | 已有 |
| 构建 | Vite 8 + @vitejs/plugin-react | 已有 |
| 包管理 | pnpm | 已有 lock 文件 |
| UI | antd v5（最新稳定） | CSS-in-JS + theme algorithm |
| React19 兼容 | @ant-design/v5-patch-for-react-19 | **默认**：message/Modal/notification 一律用 `App.useApp()`，patch 仅兜底 |
| 路由 | react-router v7 | **已定：Data Router 模式**（`createBrowserRouter` + `RouteObject[]`） |
| 状态 | @reduxjs/toolkit + react-redux + redux-persist | **已定：白名单持久化** |
| HTTP | axios | 封装见 §7 |
| 国际化 | react-i18next + i18next | **已定：语言包按模块拆分、按需加载** |
| 图标 | lucide-react | 菜单/按钮图标；antd 内部图标不混用 |
| 样式 | CSS Modules + antd token | **已定**；禁止引入 Tailwind/Less |
| 图表 | ECharts（按需引入） | 自研 `useECharts` hook |
| 页签拖拽 | dnd-kit（core + sortable） | **已定：支持拖拽排序** |
| 测试 | Vitest + @testing-library/react | **已定** |
| 提交钩子 | Husky + lint-staged | **已定**：提交前跑 oxlint + tsc |
| Lint | oxlint（已有） + tsc --noEmit | 不引入 ESLint/Prettier，格式化交给编辑器 |

日期处理使用 antd 自带的 dayjs，不重复引入日期库。

---

## 3. 目录结构

```
src/
├── main.tsx                  # 入口：挂载 RootProvider
├── App.tsx                   # RootProvider：Redux + PersistGate + I18n + AntdApp + RouterProvider
├── api/                      # API 模块（按资源分文件，只导出入参/出参已标注类型的函数）
│   ├── request.ts            # axios 封装（§7）
│   ├── auth.ts  user.ts  role.ts  menu.ts  ...
├── assets/                   # 静态资源
├── components/               # 通用组件
│   ├── Auth.tsx              # 按钮级权限组件
│   ├── KeepAliveOutlet.tsx   # display:none 缓存容器（§9）
│   ├── PageLoading.tsx       # 路由级 Suspense fallback
│   ├── GlobalProgress.tsx    # 全局请求进度条
│   └── ...
├── config/
│   ├── constants.ts          # 权限码常量、Storage key、页签上限等
│   └── theme.ts              # 预设主题色板、字体族预设、字号档位
├── hooks/                    # useAuth、useECharts、useFullscreen、usePageActive ...
├── i18n/
│   ├── index.ts              # i18next 初始化 + 按需加载
│   └── locales/zh-CN/*.ts    # 按模块拆分：common.ts menu.ts system.ts ...
│   └── locales/en-US/*.ts
├── layouts/
│   ├── BasicLayout/          # 主布局（侧边/顶部两种模式在此切换）
│   ├── components/           # SideMenu / TopMenu / Header / TabsBar / Breadcrumb / SettingDrawer ...
│   └── BlankLayout.tsx       # 登录页等无框架页
├── pages/
│   ├── login/  dashboard/  profile/
│   ├── system/{user,role,menu}/   # RBAC 管理三连
│   ├── demo/nested/               # 多级菜单演示
│   └── error/{403,404,500}.tsx
├── router/
│   ├── routes.tsx            # 静态路由表（唯一数据源）
│   ├── index.tsx             # createBrowserRouter + 过滤后注册
│   └── guard.ts              # loader 守卫（登录态 + 权限码）
├── store/
│   ├── index.ts              # configureStore + redux-persist
│   └── slices/               # user / settings / tabs / keepAlive / app
├── demo/                     # 【演示模式】兜底数据与降级逻辑，可整目录剔除（§13）
├── types/                    # 全局类型（RouteMeta、API 响应、RBAC 实体）
└── utils/                    # storage、token、tree 转换、下载等
```

路径别名：`@` → `src`（vite + tsconfig 同步配置）。**默认**。

---

## 4. 路由体系

### 4.1 组织方式（已定）

**静态路由表 + 权限过滤**。前端在 `router/routes.tsx` 定义完整 `AppRouteObject[]` 树，登录后后端只返回角色标识与权限码列表，前端递归过滤路由树生成：① 注册给 `createBrowserRouter` 的路由；② 菜单数据。路由表是两者的唯一数据源。

### 4.2 路由 meta 约定

```ts
interface RouteMeta {
  title: string          // i18n key，如 'menu.system.user'，非硬编码文案
  icon?: LucideIcon      // 直接存 lucide 组件引用（静态路由天然支持，默认）
  permCode?: string      // 访问该路由所需权限码，如 'system:user:list'
  hideInMenu?: boolean   // 菜单不显示但路由可访问（如详情页）
  affixTab?: boolean     // 固定页签（如首页）
  noCache?: boolean      // 该页不参与 display:none 缓存
  breadcrumb?: boolean   // 默认 true，可关
}
```

约定：
- 目录级路由（有 children 无组件）只参与菜单与面包屑。
- 叶子路由组件一律 `React.lazy` + `<Suspense fallback={<PageLoading/>}>`。
- 通配 `*` → 404；未匹配权限的已存在路由 → 403。

### 4.3 守卫（已定：loader 方案）

- `authLoader`：检查 store 中 token；无 → `redirect('/login?redirect=<fullPath>')`。
- 有 token 但无用户信息（如刷新后）→ 在守卫内 `await` 拉取用户信息 + 权限码，再过滤路由。
- 权限不足 → `redirect('/403')`。
- `/login` 已登录访问 → `redirect('/')`。

### 4.4 页签 key（默认）

页签以 **fullPath（path + search）** 为 key：`/system/user?id=1` 与 `/system/user?id=2` 是两个页签。同 fullPath 复用同一缓存实例。

---

## 5. 权限体系（RBAC）

### 5.1 模型

```
User ──n:n── Role ──n:n── Permission(权限码)
```

- 权限码字符串约定：`<模块>:<资源>:<动作>`，如 `system:user:create` / `system:role:delete`。
- 超级管理员角色约定标识 `admin`，前端视为拥有全部权限码（通配 `*`），后端仍须逐一校验。
- 权限码常量在 `config/constants.ts` 统一定义，禁止魔法字符串散落页面。

### 5.2 控制粒度（已定：页面 + 按钮级）

- **页面级**：§4.3 守卫 + 菜单过滤。无权限码的路由不出现在菜单，直接访问 URL 被重定向 403。
- **按钮级**，两种 API 等价：
  - `<Auth code="system:user:create"><Button/></Auth>` — 无权限时**隐藏**（默认）。
  - `useAuth()` → `hasAuth(code)` — 用于禁用态、表格操作列条件渲染等命令式场景。
  - 无权限时的策略（隐藏 / 禁用）为 `<Auth>` 的 `mode` 属性，默认隐藏。

### 5.3 权限变更策略（默认）

- 前端权限码仅为 UX 层过滤，**后端接口必须做最终校验**（规格中写进 README 警告）。
- 会话期间权限被后端收窄：接口返回 403 → 全局提示「权限已变更」并重新拉取用户信息刷新权限码；被收窄的已打开页签在下次激活时重新校验。
- 提供「刷新权限」的隐式机制：每次路由守卫发现权限码为空才拉取；403 响应是唯一的会话内刷新触发点。

---

## 6. 认证与 Token（已定：双 Token 静默刷新）

- **存储**：accessToken + refreshToken 存 localStorage（模板默认；README 注明 XSS 风险与 httpOnly Cookie 替代方案）。
- **登录**：`POST /auth/login` → 双 token + 用户基本信息 → 拉取权限码 → 过滤路由 → 跳回 `redirect` 参数或 `/`。
- **静默刷新**：accessToken 过期 → 接口 401 → axios 拦截器触发刷新：
  - **single-flight**：并发 401 共享同一个刷新 Promise，期间到达的请求进入等待队列，刷新成功后用新 token 统一重放，失败则全部拒绝。
  - refreshToken 也失效 → 清空会话 → 跳登录页（带 redirect）。
- **登出 / 切换账号**（默认）：清空 user、tabs、keepAlive 缓存及 demo 态；**settings 保留**（界面设置视为设备级偏好，不随账号走）。

### 接口契约（核心）

```
POST /auth/login        { username, password }        → { accessToken, refreshToken, user }
POST /auth/refresh      { refreshToken }              → { accessToken, refreshToken }
POST /auth/logout       { refreshToken }              → void
GET  /auth/profile      -                             → { user, roles, permCodes }
```

---

## 7. Axios 封装（`api/request.ts`）

统一响应格式约定：`{ code: number, message: string, data: T }`，`code === 0` 为成功（兼容 200，常量可配）。

已选能力（已定）：

1. **自动解包**：拦截器校验 code，成功返回 `data`（泛型），业务错误 reject 出统一 `ApiError { code, message }`。
2. **统一错误提示**：业务错误自动 `message.error`（经 `App.useApp()`），单个请求可通过 `config.silent = true` 关闭。
3. **401 刷新重放**：见 §6。
4. **重复请求取消**：pending Map（key = method + url + 序列化参数），同 key 的 GET 重复发起时 abort 前一个；写操作（POST/PUT/DELETE）不参与自动取消。
5. **路由切换中断**：请求挂 `AbortSignal`，路由变化时统一 abort 上一页未完成请求（被 abort 的请求静默处理，不弹错误）。
6. **全局 loading 计数**：在途请求计数入 store（app 切片），驱动顶部 `GlobalProgress` 细进度条；计数归零延迟 200ms 收起，防闪烁。

明确**不做**（已定）：自动重试。

实例配置：`baseURL = import.meta.env.VITE_API_BASE_URL`，`timeout = 15000`。

---

## 8. 全局状态管理

### 8.1 切片划分

| 切片 | 内容 | 持久化 |
| --- | --- | --- |
| user | token 对、用户信息、角色、permCodes | ✅ |
| settings | 主题模式、主题色、布局模式、字号、字体族、面包屑开关、语言 | ✅ |
| tabs | 页签列表（fullPath、title key、affix、排序） | ❌（已定：不持久化） |
| keepAlive | 缓存 key 列表、LRU 顺序 | ❌ |
| app | 全局 loading 计数、侧边栏折叠态、全屏态、演示模式开关 | 折叠态 ✅，其余 ❌ |

### 8.2 持久化（已定：redux-persist 白名单）

- 白名单：`user`、`settings`、`app.sidebarCollapsed`。
- `version: 1`，提供 `migrate` 函数骨架；后续结构变更必须升版本号写迁移。
- RTK 集成：对 `persist/PERSIST` 等 action 关闭 `serializableCheck` 对应路径。
- storage key 统一前缀 `apex_`，集中在 `config/constants.ts`。

---

## 9. 多页签（TabsBar）

### 9.1 页面缓存（已定：自研 display:none）

- `KeepAliveOutlet`：以 fullPath 为 key 缓存 `<Outlet/>` 渲染结果；切走的页面**隐藏不卸载**，表单、滚动位置、组件状态完整保留。
- **LRU 上限 10**（常量可配）：超过后淘汰最久未激活的非 affix 缓存；被关闭页签的缓存立即销毁。
- 隐藏页面副作用规范（写入 README + 页面模板注释）：
  - 定时器 / 轮询必须挂在 `usePageActive()` 上（页面失焦自动暂停）；
  - 普通 `useEffect` 清理函数照常编写（卸载时才触发，隐藏不触发——这是与 Vue keep-alive 的语义差异，必须显式文档化）。
- 路由 meta `noCache: true` 的页面不进缓存（如编辑页）。

### 9.2 页签交互（已定）

- **右键菜单**：刷新当前页（销毁并重建该 key 的缓存）、关闭其他、关闭右侧、关闭全部（affix 除外）。
- **固定页签**：meta `affixTab: true`（首页默认固定），不可关闭、不被批量关闭误伤、排在最前。
- **拖拽排序**：dnd-kit 实现横向拖拽，affix 页签不可拖入普通区。
- **不持久化**（已定）：浏览器刷新后页签重置为「首页 + 当前页」两个。
- 溢出策略：超出宽度横向滚动 + 左右箭头，激活页签自动滚动到可视区。
- 关闭最后一个普通页签 → 回到首页。

---

## 10. 主题与界面设置面板

### 10.1 设置项

| 设置项 | 取值 | 实现 |
| --- | --- | --- |
| 主题模式 | 亮 / 暗 / **跟随系统**（已定三档，默认跟随系统） | antd `theme.darkAlgorithm` / `defaultAlgorithm` 切换；跟随系统监听 `prefers-color-scheme` change |
| 主题色 | 预设色板（≥6 色）+ 自定义取色器 | `colorPrimary` 动态注入 ConfigProvider |
| 布局模式 | 侧边布局 / 顶部布局（已定两种） | BasicLayout 内切换，菜单数据源相同 |
| 字体族 | 3~5 组预设（系统默认 / 无衬线 / 衬线 / 等宽） | antd token `fontFamily` + `body` CSS 变量双写 |
| 字号 | 小 / 中 / 大 三档（已定预设档位） | 根 `font-size`（14/16/18 基准）+ antd token `fontSize` 联动 |
| 面包屑 | 开 / 关 | 布局内条件渲染 |
| 全屏 | 开关 | 浏览器 Fullscreen API（整页，默认语义），监听 `fullscreenchange` 同步退出 |

### 10.2 实现要点

- 所有设置项收敛在 settings 切片，`App.tsx` 中按 settings 动态组装 `ConfigProvider theme`，**实时生效**（无「应用」按钮）。
- 暗色适配规则：自定义组件颜色一律走 `theme.useToken()` 或 `var(--ant-color-*)` CSS 变量（CSS Modules 内），**禁止硬编码色值**——写进 lint 之外的 README 强约定。
- 设置面板形态：右侧 Drawer（antd `Drawer`），分组：主题 / 布局 / 字体 / 界面元素；头部齿轮按钮唤起。
- 持久化：随 settings 切片走 redux-persist（§8.2）。

---

## 11. 布局与导航

### 11.1 布局模式（已定：侧边 + 顶部，不含混合布局）

- **侧边布局**：左侧 Logo + 垂直菜单（antd `Menu` inline），可折叠为图标模式（折叠态持久化）；右侧 Header + TabsBar + 内容。
- **顶部布局**：顶部一行 Logo + 水平菜单 + 用户区；菜单超过 2 级时子级以下拉菜单呈现。
- 切换布局不需刷新，菜单数据由同一份过滤后路由树派生。
- 内容区通栏铺满（已定：不做定宽开关）。

### 11.2 导航元素

- **菜单**：支持任意层级（演示 3 级）；图标取 meta.icon；当前路由自动高亮并展开祖先链。
- **面包屑**：由当前路由匹配链自动生成（meta.title 经 i18n），可开关；目录级无组件节点不可点击。
- **Header**：折叠按钮、面包屑、全局进度条、全屏按钮、语言切换、主题快捷切换、用户下拉（个人中心 / 退出登录）、设置齿轮。
- **响应式**（默认）：桌面优先；视口 < 768px 时侧边菜单退化为 Drawer 抽屉，其余不专门适配。

---

## 12. 多语言（已定：react-i18next 按需加载）

- 语言：zh-CN（默认）/ en-US；`navigator.language` 探测仅作首访默认，用户选择持久化后优先。
- 语言包**按模块拆分**（common / menu / system / validation…），首屏只动态 import 当前语言全部模块；切换语言时按需加载缺失模块，加载中显示轻量过渡。
- **联动**（默认）：切换语言同时切换 antd `ConfigProvider locale`（zhCN/enUS）与 dayjs locale。
- key 命名：`<模块>.<页面>.<语义>`，如 `system.user.deleteConfirm`；菜单标题固定 `menu.*` 命名空间。
- 富文本/插值用 i18next 插值与 `<Trans>`；复数规则按 i18next 标准。

---

## 13. 演示模式（已定：内置兜底，不做 Mock 库）

背景：不引入 MSW / vite-plugin-mock；示例页面需开箱可演示。

- `src/demo/` 内置演示数据：两个账号 `admin / viewer`（密码任意，演示模式提示中写明），角色、权限码、用户/角色/菜单的假数据集按 §6/§14 契约形状组织。
- **触发条件**（默认）：`VITE_DEMO_MODE=true` 显式开启，或登录请求网络级失败（非业务错误）时提示「后端不可用，已进入演示模式」。
- 实现位置：axios **适配器层之前的独立分支**（demo adapter），业务 api 模块无感知；不污染 `request.ts` 主流程。
- 演示模式下 CRUD 仅改内存数据 + 同步 localStorage 快照，刷新不丢；页面顶部显示「演示模式」常驻 Badge。
- **可一键剔除**：删除 `src/demo/` + 移除 demo adapter 分支 + 关环境变量即完全移除（README 提供三步剔除指南）。

---

## 14. 示例页面（已定全选）

| 页面 | 路由 | 要点 |
| --- | --- | --- |
| 登录页 | `/login` | 独立 BlankLayout；账密表单校验；登录后回跳 redirect；演示模式入口提示 |
| Dashboard | `/dashboard`（affix 首页） | 统计卡（Statistic）、ECharts 折线/柱状/饼图、快捷入口；暗色/主题色联动展示 |
| 用户管理 | `/system/user` | 查询表单 + 表格 + 新增/编辑 Drawer + 删除确认 + 分配角色；演示按钮级权限 |
| 角色管理 | `/system/role` | 角色 CRUD + 权限码勾选树（Tree checkable） |
| 菜单管理 | `/system/menu` | 树形表格维护菜单（与静态路由的对应关系在文档说明：此处演示数据管理 UI，实际路由仍前端静态） |
| 多级菜单演示 | `/demo/nested/level1/level2/level3` | 验证三级菜单渲染、面包屑、页签缓存 |
| 个人中心 | `/profile` | 资料展示/编辑 + 修改密码（旧密码校验） |
| 异常页 | `/403` `/404` `/500` | 无权限 / 路由不存在 / 路由级 ErrorBoundary 兜底（渲染错误 → 500 页） |

CRUD 接口契约（用户管理为例，角色/菜单同理）：

```
GET    /users?page=&size=&keyword=     → { list: User[], total }
POST   /users                          → User
PUT    /users/:id                      → User
DELETE /users/:id                      → void
```

---

## 15. 图表（已定：ECharts 按需引入）

- `echarts/core` + 按需注册 Chart/Component/Renderer，禁止全量 `import * as echarts`。
- 封装 `useECharts(ref, option)` hook：自动 init/dispose、`ResizeObserver` 自适应、**暗色与主题色联动**（读 antd token 注入 option，主题切换时重建实例）。
- Dashboard 图表数据走 demo/真实接口同一通路。

---

## 16. 工程化

- **环境变量**（默认）：`.env.development` / `.env.production` / `.env.example`；键：`VITE_API_BASE_URL`、`VITE_DEMO_MODE`。
- **dev 代理**（默认）：`/api` → `VITE_PROXY_TARGET`，`changeOrigin`。
- **路径别名**：`@` → `src`。
- **提交钩子**（已定）：Husky + lint-staged → `oxlint --fix` + `tsc --noEmit`（仅暂存文件范围可行则限范围，否则全量）。
- **commit message**：简体中文（遵循用户全局规范）。
- **测试**（已定）：Vitest + Testing Library + jsdom；覆盖：权限过滤函数、`useAuth`、axios 拦截器（刷新重放/重复取消）、工具函数；组件冒烟测试若干。`test` 脚本入 CI 友好模式。
- **scripts**：`dev / build / preview / lint / test / prepare(husky)`。
- **构建**（默认）：`base: '/'`，`outDir: dist`；manualChunks 拆分 echarts / antd 大依赖。
- **浏览器目标**（默认）：现代浏览器（Vite 默认 baseline），不支持 IE。

---

## 17. 边界情况清单（实现时必须处理）

1. 刷新页面：token 在但权限码被持久化 → 直接可用；权限码缺失 → 守卫内拉取（§4.3）。
2. 并发 401：single-flight 队列，禁止多次刷新（§6）。
3. refreshToken 失效：清空会话跳登录，携带 redirect。
4. 会话内权限被收窄：403 响应触发权限码重拉（§5.3）。
5. 页签 LRU 淘汰：仅淘汰非 affix；激活页永不淘汰（§9.1）。
6. 关闭当前激活页签：跳转到最后一个剩余页签（无则首页）。
7. 隐藏页面的轮询/定时器：`usePageActive` 暂停约定（§9.1）。
8. 同 fullPath 重复点击菜单：复用页签与缓存，仅激活。
9. 快速连点查询/切页：重复请求取消 + 路由中断防脏数据（§7）。
10. 语言切换瞬间：模块语言包未加载完 → 保持旧语言渲染，加载完成一次性切换，不出现 key 裸奔。
11. 主题「跟随系统」下系统主题变化：监听并即时切换，不与用户手动锁定冲突（用户选过亮/暗后不再跟随）。
12. Fullscreen API 不可用（iframe/权限）：降级为 toast 提示。
13. 路由组件抛错：路由级 `ErrorBoundary` → 500 页，提供「重载」按钮。
14. 登出后浏览器后退：守卫重新拦截回登录页。

---

## 18. 非目标（Out of Scope）

- 混合布局、内容定宽开关、页签跨会话持久化、请求自动重试、数据级（行/字段）权限、MSW/vite-plugin-mock、Tailwind、移动端专门适配、微前端、服务端渲染、WebSocket 通知中心。

---

## 19. 验收标准

- [ ] `pnpm dev` 启动后：演示模式可登录（admin/viewer 权限差异可见），完整走通登录 → 菜单过滤 → CRUD → 登出。
- [ ] 亮/暗/跟随系统三档切换无闪烁，自定义组件随主题联动（无硬编码色值）。
- [ ] 设置面板全部设置项实时生效且刷新后保留。
- [ ] 侧边/顶部布局热切换；三级菜单、面包屑、页签联动正确。
- [ ] 多页签：display:none 缓存表单不丢；LRU 10 生效；右键菜单四项、affix、拖拽排序可用；刷新浏览器重置为首页+当前页。
- [ ] 中英切换全站无硬编码文案、无 key 裸奔，antd 组件与日期同步切换。
- [ ] 按钮级权限：viewer 账号在用户管理页看不到「新增/删除」（或按配置禁用）。
- [ ] 双 token：access 过期后无感刷新（并发请求只刷新一次）；refresh 失效回登录。
- [ ] 重复 GET 被取消、路由切换中断在途请求、全局进度条随请求显隐。
- [ ] 403/404/500 三页可达；ErrorBoundary 可兜底渲染错误。
- [ ] `pnpm lint`、`pnpm test`、`pnpm build` 全绿；Husky 钩子生效。
- [ ] 按 README 三步剔除演示模式后，构建产物不含 demo 代码。
