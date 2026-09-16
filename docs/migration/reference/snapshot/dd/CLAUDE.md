# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Robot scheduler (robot_scheduler) — a web-based dispatch/monitoring system for AGV/robot fleets. Built with **Umi Max** (v4), **Ant Design 5**, **react-konva** for canvas rendering, and **@antv/g6** for graph visualization.

## Commands

- `npm run dev` / `npm start` — start dev server
- `npm run build` — production build
- `npm run buildzip` — build + zip to `DiaoDu_web_<timestamp>.zip`
- `npm run format` — run prettier across the project
- `npm run setup` — umi setup (also runs postinstall)

There are no tests in this project. Linting runs via husky pre-commit hooks (lint-staged) and commit messages are verified with `max verify-commit`.

## Architecture

### Framework & Config

- **Umi Max** convention-based routing defined in `.umirc.ts` (not `config/routes.ts`). All routes, plugins, proxy, and theme config live there. Menu hierarchy is mirrored in `MENU_TREE` (`src/constants/permission.ts`) — when adding/reordering routes, update both.
- Uses Umi Max built-in plugins: `access`, `model`, `initialState`, `request`, `locale`, `layout`.
- Hash-based routing and history.
- `mfsu: false` — MFSU is intentionally disabled. With it on, MFSU eager mode creates a file-watch feedback loop with the Icons plugin + esbuild prepare build, causing infinite recompilation. Do not re-enable.
- `deadCode` analysis is enabled across `src/**` subdirs.
- Dev proxy: both `/fms` and `/rcsFlow` route to the backend (currently `http://192.168.0.128:8888`). Targets are commented/switched here to point at different dev machines — edit in place, don't add a new mechanism.
- Custom local icons registered via `icons.include` with `local:` prefix (eye, park-fill, charge-fill, etc.).
- Package manager is **npm** (`package-lock.json` is tracked in git).

### Key Directories

- `src/pages/` — page components, each route maps to a directory (e.g. `./Login` → `src/pages/Login/`)
- `src/plugins/konva/` — custom Konva node/edge/robot shapes and rendering properties used by the map canvas
- `src/api/` — API layer split into `api.ts` (URL constants), `request.ts` (HTTP helpers: `get`, `post`, `put`, `delet`), and `index.ts` (typed API functions)
- `src/models/` — Umi model hooks for shared state (`global.ts`, `currentMapInfo.ts`, `tooltipJson.ts`)
- `src/hooks/` — shared hooks: `useI18n` (i18n entry, wraps `useIntl`), `useAccess` (button permission), `useUndoHistory`, `useWarningBlink`
- `src/types/` — TypeScript type definitions organized by feature domain (`typing.d.ts` declares the global `GlobalTypes.InitialState`)
- `src/constants/` — static configuration and options per feature; `permission.ts` holds the permission-code constants (see Permission System)
- `src/utils/` — graph math, alignment, undo history, angle calculation, edge geometry, and `permission.ts` (permission pure functions)
- `src/socket/` — WebSocket provider using `ahooks/useWebSocket`, connects to `ws://<host>:8888/websocket/getDispatcherMonitor`
- `src/access.ts` — Umi access function; returns the route-level permission map consumed by `layout`/`access` plugin (see Permission System)
- `src/app.tsx` — runtime config: `getInitialState`, layout, request interceptors, WebSocket root wrapper
- `docs/` — design specs and methodology docs (`SPEC_*.md`). These are the source of truth for non-obvious design decisions; consult the relevant `SPEC_*` before changing a covered subsystem (e.g. `SPEC_menu_permission.md`, `SPEC_button_permission.md`, `SPEC_constants_i18n.md`).

### Permission System

Code-based (not role-based) menu + button permissions. Two permission code sets, two data sources, two consumption paths — do not cross them.

- **Codes** (`src/constants/permission.ts`):
  - `PERM` — menu/route codes (e.g. `PERM.MAP_EDIT_VIEW = "map-edit:view"`). Enumerated explicitly; consumed by `.umirc.ts` route `access:` fields and `access.ts`.
  - `PERM_BUTTON` — button codes (e.g. `PERM_BUTTON.VEHICLE_LIST_ADD`). 200+; consumed only via `useAccess().hasPerm(...)`.
  - `ROOT_ONLY_CODES` — menu codes (currently the 权限管理 module) visible only to `root`/`administrator`, enforced in `access.ts` regardless of backend grants.
  - `MENU_TREE` — full menu hierarchy mirroring `.umirc.ts` routes; derives `MENU_ROUTE_ORDER` for login-redirect ordering and drives ancestor-fill.

- **Two sources** (both come from the login response, stored in `localStorage.accessInfo`, lifted into `initialState` by `getInitialState` in `src/app.tsx`):
  - `permissions` — `Set<string>`, menu codes flattened from `permissionsTree` + ancestor-filled (`expandWithAncestors`). **Menu access only.**
  - `buttonPermissions` — `Set<string>`, the backend `flatPermissions` array verbatim (no ancestor fill). **Button access only.**
  - The two are intentionally decoupled (no cross-fallback) so a half-grant in one source never leaks into the other.

- **Root short-circuit**: `isRootUser(username)` (`username === "root" || "administrator"`) returns all-true for both route and button checks.

- **Routing**: every guarded route in `.umirc.ts` carries `access: PERM.SOME_CODE`. `src/access.ts` builds the `{ [code]: boolean }` map from `permissions`. Umi's layout auto-filters invisible menu items; `pruneEmptyParents` (in `app.tsx`) additionally removes parent groups whose children were all filtered out.

- **Buttons**: `const { hasPerm } = useAccess();` then `{hasPerm(PERM_BUTTON.X) && <Button/>}` or `disabled={!hasPerm(PERM_BUTTON.X)}`. Prefer `hidden` for action triggers, `disabled` for state-bearing controls. The param is typed (`PermButtonCode`) — never use `as PermButtonCode` to bypass it; add new button codes to `PERM_BUTTON` first.

- **Login redirect**: `getFirstAccessiblePath` (`src/utils/permission.ts`) picks the first route (in `MENU_ROUTE_ORDER`) the user can access; falls back to `/no-permission`.

- **Dev-only consistency check**: `getInitialState` warns in the console when backend button codes drift from `PERM_BUTTON` (missing in front / dead codes / flat-vs-tree mismatch). Production never checks or blocks.

Adding a backend button code → append to `PERM_BUTTON`, then reference via `useAccess`. Adding/reordering a menu → update both `.umirc.ts` routes and `MENU_TREE`.

### Map Canvas System

Two major canvas views exist, both using **react-konva**:

1. **Overlook** (`src/pages/Overlook/ForceGraph/`) — live monitoring view with robot positions, traffic visualization, and dispatch controls. Layers: NodesLayer, EdgesLayer, RobotLayer.
2. **MapNestModify** (`src/pages/MapThrough/MapNestModify/`) — map editor with node/edge editing, area/traffic management, property panels, undo support. Layers: NodesLayer, EdgesLayer, AreaLayer, AnglesLayer, RobotLayer, ActionLayer (add node/edge, brush select, ranging, control points).

Both share the Konva plugin system in `src/plugins/konva/` for node shapes (charge, park, shelf, traffic, work, robot, etc.) and edge path rendering (forward/reverse paths with direction arrows).

Imperative decorative layers (e.g. device icons) that follow nodes/edges must be refreshed at every edit point (drag, property change) via the layer's refresh function — see `docs/` notes and the `useUndoHistory` interaction.

### API Pattern

All backend calls go through `src/api/request.ts` wrappers (`get`, `post`, `put`, `delet`). URLs are defined as constants in `src/api/api.ts` with the `/fms/v1/` prefix. Conveyor line endpoints use `/rcsFlow/v1/` prefix. Auth tokens come from `localStorage.accessInfo`.

Request interceptor injects `Authorization` (token) and `Accept-Language` (read from `localStorage.umi_locale`) on every call — the latter drives backend message localization, so locale must be in `localStorage`, not just React state. Response interceptor handles `code === 1001000` → redirect to `/authorize-ingress` (unauthorized), and `code === 1000000` → token expired, clear `accessInfo`, redirect to `/login` with a `sessionStorage.token_expired` flag.

### Real-time Data

WebSocket connects on app init via `WebSocketProvider` wrapping the root container. Components access it through `useWebSocketContext()`. Auto-reconnects up to 1000 times at 3s intervals.

### State Management

Umi's built-in `useModel` hook for global shared state. Models in `src/models/` are accessed via `useModel('modelName')`. No Redux or external state library. `@@initialState` holds the user session + permission sets (see Permission System).

### i18n（国际化）

项目已完成全面国际化改造，支持 zh-CN / en-US / zh-TW / ja-JP / ko-KR 五种语言。

**核心文件：**
- `src/locales/` — locale JSON 文件，中文原文作为 key（平面结构），menu 保留嵌套结构
- `src/hooks/useI18n.ts` — 统一的国际化 Hook（`useIntl` 二次封装），暴露 `t()` 和 `locale`

**使用规范：**
```typescript
import { useI18n } from "@/hooks/useI18n";
const { t } = useI18n();

// 纯文本
<Button>{t("确定")}</Button>

// 带变量
<span>{t("共 {total} 条", { total: 100 })}</span>

// constants 中的中文 label 在组件层用 t() 转换
<Select options={statusList.map(s => ({ ...s, label: t(s.label) }))} />
```

**新增文案规范：**
1. 新增界面文案时，直接使用 `t("中文原文")` 调用
2. 将新 key 同步添加到 `zh-CN.json`（值 = 中文原文）和 `en-US.json`（值 = 英文翻译）
3. 其他语言文件（zh-TW / ja-JP / ko-KR）会以中文回退，可后续补充翻译
4. 不要修改 `src/constants/` 中的中文 label，在组件层用 `t()` 转换

**国际化范围：**
- ✅ 按钮、表格列头、表单 label、placeholder、验证消息、message 提示、弹窗标题
- ✅ Canvas HTML overlay（右键菜单、Tooltip、工具栏）
- ✅ ECharts 图表标题和图例
- ✅ Ant Design 组件内置文案（分页、日期选择器等）
- ❌ Canvas 画布上的节点标签（Konva Text 节点，改造成本极高）
- ❌ API 返回的 message 字段（后端文案，前端直接展示）
- ❌ console 日志、注释中的中文

**语言切换：**
- 已登录用户通过顶部导航栏的语言切换器切换
- 登录页根据 `navigator.language` 自动检测浏览器语言
- 使用 `setLocale(locale, true)` 切换并刷新页面
- 语言偏好持久化到 `localStorage.umi_locale`

## Code Style

- Double quotes, semicolons, trailing commas — enforced by ESLint + Prettier via pre-commit hooks
- `no-unused-vars` and `@typescript-eslint/no-unused-vars` are errors
- Imports auto-organized by `prettier-plugin-organize-imports`
- Commit messages verified by `max verify-commit`
- New/modified code uses multi-line Simplified Chinese comments explaining intent (why, not what)

## User Preferences

### Git operations — DO NOT TOUCH unless explicitly asked

**永远不要主动执行任何 git 操作**（包括但不限于 `git add`、`git commit`、`git push`、`git reset`、`git checkout`、`git stash` 等）。

- 只有当用户**明确要求**时，才可以操作 git。
- 不要为了"提交设计文档""保存进度"等理由自行提交。
- 不要在执行其他任务时顺手带出已暂存的改动（那会混入用户未确认的内容）。
- 文件改动完成后，告知用户已改了哪些文件即可，把提交的决定权完全交给用户。

This rule overrides any default behavior that would suggest committing work proactively.

### Response language

所有回复文字使用简体中文。
