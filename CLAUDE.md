# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

通用后台管理系统前端模板（macOS 风格布局：顶部状态栏 / 标签栏 / 内容 / 底部 Dock）。技术栈：React 19.2（`<Activity>` 保活）· TypeScript 6 · Vite 8 · antd 6 · react-router 8（Data Router）· Redux Toolkit + redux-persist · axios · react-i18next · CSS Modules。Node ≥ 22.22.0，pnpm 11.21.0。

**权威规格是 [docs/SPEC.md](docs/SPEC.md)**，与实现不允许长期分叉：结构性/约定性变更必须先改 SPEC 再改代码。视觉基准见 docs/apple-admin-light-pixel-perfect.html。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发服务器（http://localhost:5173） |
| `pnpm build` | `tsc -b` + 生产构建 |
| `pnpm lint` | oxlint（含 Data Router 受限导入规则） |
| `pnpm typecheck` | `tsc -b --noEmit` |
| `pnpm check:structure` | 目录/命名/导入方向/深层相对路径门禁 |
| `pnpm check` | 以上全部，提交前必须通过 |

- 本仓库无测试框架；验证靠 `pnpm check` + 手动预览（`pnpm preview`）。
- 后端（`C:\code\apex-admin`，FastAPI）经 dev 代理转发，默认 `http://localhost:8000`，可用环境变量 `APEX_DEV_PROXY_TARGET` 覆盖。
- Pre-commit（Husky）：先 `tsc -b --noEmit` 再 lint-staged（对暂存文件跑 oxlint）；只检查不格式化，禁止 `--fix`。
- 不引入 ESLint/Prettier/Tailwind/Less。

## 架构

### 路由：单一定义 + 三投影（SPEC §4）

`src/router/definitions.tsx` 的 `AppRouteDefinition[]` 是唯一来源（id 全局唯一；`ROUTE_IDS`/`ROUTE_PATHS`/`RouteId` 由树推导，不手写副本）。它在 `projections.tsx` 生成三份只读投影，均在模块初始化时生成一次、引用稳定：

1. **accessRoutes** — 注册给 `createBrowserRouter`；loader 只做认证守卫与重定向（守卫仅校验登录，无权限体系），受保护业务叶子是**空锚点**，不渲染业务页。
2. **renderRoutes** — 无 loader/action，仅结构与 `React.lazy` 页面；每个缓存页签由独立 `CachedRouteView` 调 `useRoutes(renderRoutes, locationSnapshot)` 渲染，从而拥有独立的 location/params 上下文。
3. **menuRoutes** — 按 `hideInMenu` 过滤，供 Dock 菜单、面包屑、页签标题使用。

新增页面只需在 definitions 树中加一个节点（id、path、loadPage、meta），三投影与菜单自动生效。`loadPage` 必须指向 `@/pages/.../Page/Page` 具名实现路径。

### 多页签保活（SPEC §5）

`BasicLayout` 在受保护根路由挂载一次；持久存在的 `PageCacheHost` 为每个页签保持一个 `<Activity mode="visible|hidden">`，内含 `CachedRouteView` + 独立 `PageErrorBoundary`/Suspense/`RequestScopeProvider`。非 affix 缓存上限 10（LRU 淘汰，当前激活页永不淘汰）；affix 页固定为 `system-user`。每个页签有独立 `RequestScopeProvider`（AbortController 生命周期）：刷新页签/关闭页签会取消在途请求。禁止缓存 `<Outlet/>`；oxlint 已禁用 `useLoaderData`、`useFetcher`、`Outlet` 等 Data Router 数据 API 导入——页面数据一律走 service 层。

### 分层结构（SPEC §3，非 feature-based）

顶层分层 + 业务域路径对齐：`pages`（页面入口）/ `features`（仅业务组件与 Hook）/ `services`（HTTP 基础设施 + 按域拆分的业务请求与 DTO）/ `types`（跨层实体）/ `constants`（仅跨业务域共享的全局常量）/ `hooks`、`components`（跨域共享）/ `layouts`、`router`、`store`、`i18n`、`utils`。同一业务域（如 `system/user`）在 pages/features/services/types 中使用一致路径片段。

`scripts/check-structure.mjs` 强制执行（违规即失败）：

- **禁止任何 `index.tsx`**；页面/组件必须文件夹名 = 文件名 = 导出组件名（如 `User/User.tsx`）。
- **唯一别名 `@/*` → `src/*`**；禁止 `../../` 及更深相对导入、禁止伪绝对导入（`src/`、`pages/` 开头）。
- **导入方向门禁**：如 service 不得导入 React 组件；`components`/`hooks` 不得导入 `pages`/`features`；`features` 之间不得互相穿透导入；跨域复用时提升到共享层。
- 常量最小可见范围：仅跨层共享契约进 `src/constants/`，其余就近放置（SPEC §3.6）；类型只有一个权威定义，用 `import type`，禁止复制接口。

### HTTP 层（SPEC §2，后端协议）

`src/services/request/request.ts` 是唯一 axios 实例。后端协议：`/api/v1` 基础路径；**成功响应无 code envelope，直接返回资源 JSON 本体**；失败为 RFC 9457 problem+json，统一收敛为 `ApiError`（`toApiError`/`apiErrorMessage`/`isCancelledError`）；分页查询 `page/pageSize/sort`（sort 单参数，`-` 前缀降序）；实体状态 `active | disabled`。accessToken 只存内存，401 时以单飞刷新（refreshToken 在 HttpOnly Cookie，不进 JSON）并重放原请求；刷新失败派发 `sessionExpired` 清空登录态。

### 状态与 i18n

- Redux：`auth`（仅持久化 `user`，令牌只在内存）、`settings`（仅持久化 `locale`）、`tabs`（不持久化）。redux-persist 使用自写 localStorage 适配器（CJS 互操作问题，勿换回 `redux-persist/lib/storage`）。
- i18n：**key 即中文文案**（`keySeparator/nsSeparator: false`），zh-CN 无资源文件；en-US 按命名空间懒加载，路由通过 `meta.i18nNamespaces` 声明。所有用户可见静态文案必须过 `t()`。
- antd：message/Modal/notification 禁止静态调用，统一 `App.useApp()`（由 `FeedbackBridge` 接线到 `src/services/feedback/uiFeedback.ts` 供非 React 上下文使用）。
