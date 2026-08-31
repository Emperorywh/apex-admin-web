# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

Apex Admin Web — 基于 React 19.2 + TypeScript + Vite 8 + antd v6 + react-router v8 的通用后台管理系统前端模板（RBAC、多页签保活、i18n、明暗主题）。

> **纯前端模式（2026-08-31 重构）**：本仓库已移除全部 API 请求能力（axios 封装、`/auth`、`/users`、`/roles`、`/menus`、`/dashboard` 系列 service、请求作用域与 401 刷新状态机）。登录为本地状态机：`src/services/auth/auth.session.ts` 接受任意账号密码，写入固定 accessToken 与 admin 权限快照（`roleCodes: ['admin']` + `permCodes: ['*']` + `menuPaths: null`，全部菜单/权限放行）；系统管理三页（用户/角色/菜单）基于 `src/constants/system/*/*.demoData.ts` 的确定性演示数据，在页面内存状态上完成筛选/分页/CRUD/角色与权限分配（无请求层、无随机数，刷新重置，接入后端时以同名 service 替换数据落地层）；个人中心为空白占位页；Dashboard 使用 `src/constants/dashboard/dashboard.demoData.ts` 的确定性演示数据渲染 AGV 调度概览（无请求层、无随机数，接入后端时以同名 `AgvDashboardSnapshot` 结构替换）。不要再引入请求层、mock 服务或假数据分支。

**`docs/SPEC.md` 是历史需求依据**（其 §6/§7 请求协议与后端集成章节已不适用于纯前端模式；其余路由/页签缓存/i18n 章节仍有效）。规格条文在 README、代码注释中以 `§x.y` 引用；动手修改认证、路由、页签缓存等核心机制前必须先读对应章节。**视觉与壳层呈现以子规格 `docs/SPEC_UI2.md` 为准**（取代 `docs/SPEC_UI.md`，后者仅历史留存），改布局/导航/页签样式前先读它。README.md 面向模板接入方（安全边界、部署等），不重复于此。

## 环境与常用命令

Node `>=22.22.0`，pnpm `11.21.0`（`packageManager` 锁定，建议 `corepack enable`）。

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | Vite 开发服务器（纯前端模式，无 /api 代理） |
| `pnpm build` | `tsc -b && vite build` |
| `pnpm preview` | 托管 `dist/` 预览生产产物（自带 SPA fallback，可直刷深层路由验证部署行为） |
| `pnpm lint` / `pnpm typecheck` | oxlint / `tsc -b --noEmit` 全项目引用检查 |
| `pnpm check:structure` | 目录/命名/导入方向/大小写结构门禁（`scripts/check-structure.mjs`） |
| `pnpm check` | 完整质量链：structure → lint → typecheck → build（CI 强制执行） |

提交钩子（Husky + lint-staged，全部只读、不 `--fix`）：pre-commit 对暂存 TS/TSX 跑 oxlint + 全量 check:structure；pre-push 跑 typecheck。**Commit message 必须使用简体中文。**

## 架构核心（需跨多个文件才能看懂的部分）

### 路由：单一定义 → 三投影 + Activity 页面保活（§4、§9）

- `src/router/definitions.tsx` 的 `AppRouteDefinition[]` 是唯一来源，`projections.tsx` 在模块初始化时一次性生成三份引用稳定的只读投影：
  - **accessRoutes**：注册给 `createBrowserRouter`，loader 只做认证/权限/重定向，**不承载业务数据**；业务叶子只返回空锚点。
  - **renderRoutes**：无 loader 的纯渲染路由。`CachedRouteView` 以页签的 location 快照调用 `useRoutes(renderRoutes, snapshot)`，使每个缓存页签拥有独立的 location/params/searchParams 上下文。
  - **menuRoutes**：按权限与 `hideInMenu` 过滤，侧边/顶部布局共用。
- 页面保活基于 React 19.2 `<Activity mode="visible|hidden">`（`PageCacheHost` 按页签 key 维持）：隐藏页保留 React state 与 DOM，但 **React 会清理其全部 Effect，重显时重建**。因此业务页面必须遵守：每个 `useEffect` 返回完整清理函数；视频/Portal/ECharts/焦点等 DOM 型副作用经 `usePageActive()` 感知暂停/恢复。
- 页面**禁止**使用 `useLoaderData`/`useRouteLoaderData`/`useFetcher`/`useRevalidator`/route action（oxlint `no-restricted-imports` 强制）。
- 缓存上限 `PAGE_CACHE_MAX_ENTRIES = 10`（非 affix 实例，定义于 `src/constants/app.constants.ts`）；当前页与 affix（仅 Dashboard）不淘汰。

### 认证会话（纯前端模式，§6 语义保留、网络环节移除）

- user slice 是认证单一数据源；redux-persist 只持久化 `accessToken`（key 前缀 `apex_`）。角色/权限码/菜单白名单不持久化，整页刷新后由 `auth.session.ts` 的 `ensureProfile()` 按确定性本地数据重建。
- 所有 auth loader 第一行必须 `await rehydratedPromise`（`src/store/persist.ts`），消除持久化恢复竞态；父子 loader 可能并行，各自调用同一个 `ensureProfile()`。
- 登录/登出走 `src/services/auth/auth.session.ts` 的本地状态机：登录接受任意凭据（`loginWithCredentials`），登出清空认证/页签/页面缓存；导航经 `authNavigation` 意图通道由 `router/bootstrap.ts` 消费。`sessionEpoch` 语义保留（阻止旧会话异步回写）。
- 反馈桥：禁止 antd message/Modal/notification 静态调用；`FeedbackBridge`（antd `App` 子组件）把 `App.useApp()` 实例注册到 `src/services/feedback/uiFeedback.ts`，非组件代码只能调用 `uiFeedback`。

### 演示模式（已于 v1.12 移除）

演示模式（`VITE_DEMO_MODE` 三态、`src/demo/` adapter、演示账号、`check:demo-off` 构建检查）已随规格 v1.12 接入真实后端整体移除，不得再引入 demo adapter 或演示模式开关（纯前端模式下登录状态机内的固定本地管理员快照除外，见「项目定位」）。

### 状态、持久化与主题（§8、§10）

- 五个应用级 slice（`src/store/slices/`）：user / settings / tabs / pageCache / app；持久化走字段级白名单 + `version` + `migrate`，禁止把整个 slice 加进根白名单；结构变化必须升版本并测旧数据迁移。
- 主题启动镜像：settings 变化同步写 `apex_boot_theme` localStorage，`index.html` 内联脚本据此预置 `data-theme` 避免刷新反色闪烁；Redux 仍是运行时单一数据源。
- **色值字面量只允许出现在 `src/config/theme.ts`**；组件颜色只能来自 `theme.useToken()` 或 `var(--ant-*)`。

### i18n（§12）

中文文案即 key（`keySeparator: false`、`nsSeparator: false`），zh-CN 不维护资源文件（缺 key 返回 key 本身），只维护 `src/i18n/locales/en-US/`；路由经 `meta.i18nNamespaces` 声明额外命名空间，切换语言前预加载所有已打开页签命名空间的并集。

## 结构硬约束（`pnpm check:structure` 强制，违反即 CI 失败，§3）

- 页面入口只在 `src/pages/`；业务组件/Hook 只在 `src/features/<domain>/components|hooks/`（feature 叶子目录只允许这两类）；认证会话编排等基础设施在 `src/services/`（纯前端模式下不再含任何 HTTP 请求代码）；跨域共享组件/Hook 提升到 `src/components/`、`src/hooks/`。
- **全项目禁止 `index.tsx`**；页面/组件必须 `<Name>/<Name>.tsx` 同名文件夹 + 同名实现文件；`index.ts` 仅允许作纯 barrel。
- 唯一路径别名 `@/* → src/*`；禁止 `../../` 及更深父级导入（跨目录一律 `@/`）；导入路径大小写必须与磁盘完全一致（Windows 本地不报错不代表 Linux CI 能过）。
- 图标双轨：线性图标 lucide-react，菜单彩色图标用 Iconify 离线 `local:` 资源；`@iconify/react` 只允许在 `src/components/AppIcon/` 导入（check-structure 强制，§16.2）。
- 依赖方向固定：`router → layouts/pages → features → components/hooks/services/store/types/constants`；service 不得导入 React UI；`components/`、`hooks/` 不得反向导入 `pages/`、`features/`；不同业务域的 feature 不得互相穿透导入。
- `pages/`、`features/`、`services/`、`types/`、`constants/` 使用一致的业务域路径片段（如 `system/user`）。
- 权限码集中在 `src/constants/permission.constants.ts`，页面禁止权限魔法字符串；按钮级权限用 `<Auth code={PERMISSIONS.…}>`（默认无权限隐藏）。
- 魔法值（超时、容量、分页默认、Storage key 等）必须收敛为具名常量，归属规则见 §3.6。

## 质量门禁（§16.3）

- 模板**不内置单元测试与 E2E 体系**（v1.9 移除）；质量保障依赖 `pnpm check` 四道静态门禁：结构检查、oxlint、`tsc -b --noEmit` 全项目引用类型检查、生产构建，CI 强制执行。
- 接入方自建测试时，路径别名等配置须与 §3.5 保持一致。

## 技术栈红线（§2、§18）

不引入 ESLint/Prettier（仅 oxlint，且任何钩子/脚本不得 `--fix`）、Tailwind/Less（样式用 CSS Modules + antd token）、`react-router-dom`（直接用 react-router v8）、axios/fetch 等请求库与 MSW 等 mock 插件（纯前端模式红线）、Data Router loader/action 承载业务数据。ECharts 只从 `echarts/core` 按需注册，禁止 `import * as echarts`。如需新增环境变量，必须同步 `src/vite-env.d.ts` 严格类型；纯前端模式当前无任何环境变量，`.env`/`.env.example` 与 Vite 代理已移除。
