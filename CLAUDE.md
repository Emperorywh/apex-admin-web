# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

Apex Admin Web — 基于 React 19.2 + TypeScript + Vite 8 + antd v6 + react-router v8 的通用后台管理系统前端模板（RBAC、多页签保活、i18n、明暗主题、可剔除的演示模式）。

**`docs/SPEC.md` 是唯一需求依据**（v1.9，状态：已确认）。实现不得与规格长期分叉：变更行为必须先改 SPEC 及修订记录，再改代码。规格条文在 README、代码注释中以 `§x.y` 引用；动手修改认证、路由、页签缓存等核心机制前必须先读对应章节。README.md 面向模板接入方（安全边界、部署、demo 移除步骤等），不重复于此。

## 环境与常用命令

Node `>=22.22.0`，pnpm `11.21.0`（`packageManager` 锁定，建议 `corepack enable`）。

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | Vite 开发服务器（`/api` 代理到 `PROXY_TARGET`） |
| `pnpm build` | `tsc -b && vite build` |
| `pnpm lint` / `pnpm typecheck` | oxlint / `tsc -b --noEmit` 全项目引用检查 |
| `pnpm check:structure` | 目录/命名/导入方向/大小写结构门禁（`scripts/check-structure.mjs`） |
| `pnpm check:demo-off` | 强制 `VITE_DEMO_MODE=off` 构建并扫描产物，确认 demo 模块被整体剔除（按需执行，不进 CI） |
| `pnpm check` | 完整质量链：structure → lint → typecheck → build（CI 强制执行） |

提交钩子（Husky + lint-staged，全部只读、不 `--fix`）：pre-commit 对暂存 TS/TSX 跑 oxlint + 全量 check:structure；pre-push 跑 typecheck。**Commit message 必须使用简体中文。**

## 架构核心（需跨多个文件才能看懂的部分）

### 路由：单一定义 → 三投影 + Activity 页面保活（§4、§9）

- `src/router/definitions.tsx` 的 `AppRouteDefinition[]` 是唯一来源，`projections.tsx` 在模块初始化时一次性生成三份引用稳定的只读投影：
  - **accessRoutes**：注册给 `createBrowserRouter`，loader 只做认证/权限/重定向，**不承载业务数据**；业务叶子只返回空锚点。
  - **renderRoutes**：无 loader 的纯渲染路由。`CachedRouteView` 以页签的 location 快照调用 `useRoutes(renderRoutes, snapshot)`，使每个缓存页签拥有独立的 location/params/searchParams 上下文。
  - **menuRoutes**：按权限与 `hideInMenu` 过滤，侧边/顶部布局共用。
- 页面保活基于 React 19.2 `<Activity mode="visible|hidden">`（`PageCacheHost` 按页签 key 维持）：隐藏页保留 React state 与 DOM，但 **React 会清理其全部 Effect，重显时重建**。因此业务页面必须遵守：每个 `useEffect` 返回完整清理函数；视频/Portal/ECharts/焦点等 DOM 型副作用经 `usePageActive()` 感知暂停/恢复；页面请求经 `usePageRequest()` 绑定页签 scope，隐藏/关闭/LRU 淘汰即 abort。
- 页面**禁止**使用 `useLoaderData`/`useRouteLoaderData`/`useFetcher`/`useRevalidator`/route action（oxlint `no-restricted-imports` 强制）；业务数据一律走 `src/services/`。
- 缓存上限 `PAGE_CACHE_MAX_ENTRIES = 10`（非 affix 实例，定义于 `src/constants/app.constants.ts`）；当前页与 affix（仅 Dashboard）不淘汰。

### 认证与请求状态机（§6、§7 —— 改动前必读原文）

- user slice 是认证单一数据源；redux-persist 只持久化 `accessToken`/`refreshToken`/`sessionSource`（key 前缀 `apex_`），profile/角色/权限码每次整页启动经 `ensureProfile()`（single-flight）重新拉取，不复用旧快照。
- 所有 auth loader 第一行必须 `await rehydratedPromise`（`src/store/persist.ts`），消除持久化恢复竞态；父子 loader 可能并行，各自调用同一个 `ensureProfile()`。
- API 协议：成功 envelope 固定 `code === 0` 且 `data` 存在；失败 envelope 的 `errorCode` 是唯一的程序分支依据（`ApiErrorCode` 稳定枚举）。仅 HTTP 401 + `AUTH_ACCESS_EXPIRED` 触发 single-flight refresh，原请求以 `_authRetried` 标识最多重放一次；`sessionEpoch` 阻止旧会话异步回写新会话。
- 反馈桥：禁止 antd message/Modal/notification 静态调用；`FeedbackBridge`（antd `App` 子组件）把 `App.useApp()` 实例注册到 `src/services/feedback/uiFeedback.ts`，axios 拦截器只能调用 `uiFeedback`。guard/profile 等早期请求固定 `silent: true`，错误由路由错误页展示。

### 演示模式（三态枚举，非布尔，§13）

`VITE_DEMO_MODE = off | force | fallback`，在 `vite.config.ts` 配置加载期校验（dev 与 build 均生效）。`off` 通过静态条件 + 动态 import 让 Rollup 整体剔除 `src/demo/`，`pnpm check:demo-off` 扫描产物哨兵 `APEX_DEMO_SENTINEL` 与 demo 账号数据。演示账号 admin/viewer（**密码任意**），权限差异严格符合 §5.3 矩阵；demo 账号/假数据只允许存在于 `src/demo/`。

### 状态、持久化与主题（§8、§10）

- 五个应用级 slice（`src/store/slices/`）：user / settings / tabs / pageCache / app；持久化走字段级白名单 + `version` + `migrate`，禁止把整个 slice 加进根白名单；结构变化必须升版本并测旧数据迁移。
- 主题启动镜像：settings 变化同步写 `apex_boot_theme` localStorage，`index.html` 内联脚本据此预置 `data-theme` 避免刷新反色闪烁；Redux 仍是运行时单一数据源。
- **色值字面量只允许出现在 `src/config/theme.ts`**；组件颜色只能来自 `theme.useToken()` 或 `var(--ant-*)`。

### i18n（§12）

中文文案即 key（`keySeparator: false`、`nsSeparator: false`），zh-CN 不维护资源文件（缺 key 返回 key 本身），只维护 `src/i18n/locales/en-US/`；路由经 `meta.i18nNamespaces` 声明额外命名空间，切换语言前预加载所有已打开页签命名空间的并集。

## 结构硬约束（`pnpm check:structure` 强制，违反即 CI 失败，§3）

- 页面入口只在 `src/pages/`；业务组件/Hook 只在 `src/features/<domain>/components|hooks/`（feature 叶子目录只允许这两类）；HTTP 基础设施、业务请求与 DTO 只在 `src/services/`；跨域共享组件/Hook 提升到 `src/components/`、`src/hooks/`。
- **全项目禁止 `index.tsx`**；页面/组件必须 `<Name>/<Name>.tsx` 同名文件夹 + 同名实现文件；`index.ts` 仅允许作纯 barrel。
- 唯一路径别名 `@/* → src/*`；禁止 `../../` 及更深父级导入（跨目录一律 `@/`）；导入路径大小写必须与磁盘完全一致（Windows 本地不报错不代表 Linux CI 能过）。
- 依赖方向固定：`router → layouts/pages → features → components/hooks/services/store/types/constants`；service 不得导入 React UI；`components/`、`hooks/` 不得反向导入 `pages/`、`features/`；不同业务域的 feature 不得互相穿透导入。
- `pages/`、`features/`、`services/`、`types/`、`constants/` 使用一致的业务域路径片段（如 `system/user`）。
- 权限码集中在 `src/constants/permission.constants.ts`，页面禁止权限魔法字符串；按钮级权限用 `<Auth code={PERMISSIONS.…}>`（默认无权限隐藏）。
- 魔法值（超时、容量、分页默认、Storage key、sortBy 白名单等）必须收敛为具名常量，归属规则见 §3.6；API endpoint 例外——接口路径由各 service 在请求调用点直接内联（§14.3 v1.8）。

## 质量门禁（§16.3）

- 模板**不内置单元测试与 E2E 体系**（v1.9 移除）；质量保障依赖 `pnpm check` 四道静态门禁：结构检查、oxlint、`tsc -b --noEmit` 全项目引用类型检查、生产构建，CI 强制执行。
- `check:demo-off` 为按需执行的构建产物完整性检查（off 构建剔除 demo 模块），不进 CI。
- 接入方自建测试时，路径别名等配置须与 §3.5 保持一致。

## 技术栈红线（§2、§18）

不引入 ESLint/Prettier（仅 oxlint，且任何钩子/脚本不得 `--fix`）、Tailwind/Less（样式用 CSS Modules + antd token）、`react-router-dom`（直接用 react-router v8）、MSW 等 mock 插件、Data Router loader/action 承载业务数据。ECharts 只从 `echarts/core` 按需注册，禁止 `import * as echarts`。新增环境变量必须同步 `src/vite-env.d.ts` 严格类型与 `vite.config.ts` 的 `assertEnv` 校验；`PROXY_TARGET` 故意不带 `VITE_` 前缀（不暴露给客户端），不得改名。
