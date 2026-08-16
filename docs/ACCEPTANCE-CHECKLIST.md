# §19 验收清单自查记录（TASK-019 收尾核验）

> 自查日期：2026-08-16 · 分支：`apex-coding-agent/RUN-eafabfa8-4110-4670-b00b-1ebaef6fe40b`
> 方法：对照 docs/SPEC.md §19.1（功能验收 19 项）/§19.2（工程验收 15 项）逐项核对，证据分三类——
> **自动化**（本任务或前置任务实际运行过的命令与用例）、**评审**（代码落盘形态与既有任务验证记录）、
> **manual**（按 verificationPlan 约定由用户执行的步骤，未由 Agent 代跑，如实标注）。
> 单元/E2E 用例与规格条目的完整映射另见 [e2e/README.md](../e2e/README.md)。

## 0. 最终验证命令与结果（本任务运行）

| 命令 | 结果 | 关键输出 |
| --- | --- | --- |
| `pnpm check`（check:structure → oxlint → `tsc -b --noEmit` → `vitest run --coverage` → build） | ✅ 退出码 0 | 覆盖率汇总：语句 97.86%（1054/1077）、分支 93.37%（606/649）、函数 99.33%（297/299）、行 97.96%（1009/1030）；`vite.config.ts` 对 `src/router/**`、`src/services/**`、`src/store/**`、`src/utils/**`、`src/features/**/hooks/**` 五个 glob 分别强制 80/80/80/80 阈值，退出码 0 即五项目标目录四项维度全部 ≥80 |
| `pnpm test:e2e`（chromium 全量 + firefox/webkit smoke 冒烟） | ✅ 退出码 0 | chromium 38/38、firefox 4/4、webkit 4/4 通过（详见下表后注） |
| `pnpm run check:demo-off` | ✅ 退出码 0 | 强制 `VITE_DEMO_MODE=off` 构建产物扫描：`APEX_DEMO_SENTINEL`、`apex_demo_data`、demo 双 token/种子 ID 前缀、演示账号显示名全部 0 命中，临时产物目录已自动清理 |

## 1. §19.1 功能验收逐项自查

| # | 条目（摘要） | 结论 | 证据 |
| --- | --- | --- | --- |
| 1 | `VITE_DEMO_MODE=force` + admin/viewer 任意密码登录，权限差异符合 §5.3 | ✅ | E2E 全程运行于 force 生产构建 + `vite preview`（`playwright.config.ts` webServer）：permissions.spec 5 用例（菜单隐藏/按钮隐藏/直达 403/个人中心/admin 齐全）+ demo.adapter 单测锁定 §5.3 矩阵与 viewer 最小权限码。注：自动化以 preview 形态执行，`pnpm dev` 走同一 `setupDemoMode` 入口与 demo 运行时 |
| 2 | 登录 → 合法回跳 → 菜单过滤 → 用户 CRUD/角色分配 → 登出完整走通 | ✅ | auth.spec（登录默认落点/未登录携 redirect 回跳/demo 登出）、permissions.spec（菜单过滤）、user-crud.spec（CRUD 与角色分配完整走通）、guard/menuRoutes 单测 |
| 3 | `/` 固定 replace 到 `/dashboard`；深链刷新不先闪登录页 | ✅ | auth.spec「登录成功默认落点为 /dashboard」；error-pages.spec「刷新深层路由经 SPA fallback 返回应用并正确路由」；guard 单测：loader 第一行 `await rehydratedPromise`，persist 未恢复前不跳登录 |
| 4 | viewer 隐藏新增/编辑/删除/分配角色按钮；直达角色/菜单 403 | ✅ | permissions.spec「viewer：用户列表可查询，四个写按钮全部隐藏」「viewer：直达角色/菜单管理被守卫重定向到 403」；User 页单测断言 viewer 下写按钮不渲染 |
| 5 | 亮/暗/跟随系统实时生效；刷新不出现相反底色 | ✅ | layout-theme-language.spec「主题切换实时生效」「深色主题刷新不出现相反底色：首帧即深色背景」；ThemeProvider/useFullscreen 单测覆盖跟随系统监听与手动停止跟随 |
| 6 | 设置实时生效并按 §8 白名单持久化；Fullscreen 不持久化 | ✅ | store/persist 单测：user 仅双 token+sessionSource、settings 全量、app 仅 sidebarCollapsed、tabs/pageCache 不持久化；Fullscreen 归属 app 且不入白名单（TASK-004/009 测试） |
| 7 | 布局热切换；三级菜单、面包屑、页签选中链一致 | ✅ | layout-theme-language.spec「侧边 ↔ 顶部布局热切换不整页刷新」；smoke.spec 多级页签用例；navTree/BasicLayout 单测（选中链由 Data Router match 派生、面包屑 useMatches） |
| 8 | `/system/user?id=1` 与 `?id=2` 同开独立状态、各读各的 search | ✅ | tabs.spec「同路由不同 query 页签并存，缓存与 search params 相互独立」；gate-01（独立路由上下文）与 PageCacheHost 单测 |
| 9 | Activity 隐藏页 Effect 清理、显示恢复；视频/Portal/ECharts 不残留 | ✅ | gate-02（隐藏清理/显示重建/关闭真卸载）、gate-03（Portal 无残留、图表隐藏暂停+激活 resize）、usePageActive/useECharts/PageCacheHost 单测。注：模板不含视频/iframe 示例，DOM 型副作用的暂停契约由 `usePageActive` API 与 Portal/ECharts 用例验证 |
| 10 | 第 11 个普通缓存触发 LRU；页签仍在再激活重置；affix/当前页不淘汰 | ✅ | tabs.spec「第 11 个普通缓存触发 LRU」；tabsModel 单测（容量统计含当前页、淘汰排除当前页与 affix） |
| 11 | 右键四项、固定页签、键盘/鼠标拖拽、关闭后继顺序 | ✅ | tabs.spec（右键刷新当前/关闭其他、鼠标拖拽重排、关闭后继右→左）；TabsBar 单测覆盖 Shift+F10 键盘等价、dnd-kit 键盘拖拽、批量关闭不影响 affix |
| 12 | 刷新后重建 Dashboard + 当前页签，无重复 Dashboard | ✅ | tabs.spec「刷新浏览器后重建『Dashboard + 当前页签』且无重复」；PageCacheHost 启动重建 affix 单测 |
| 13 | 中英切换前加载全部已打开页签命名空间；全站文案经 i18n；antd/dayjs/lang/title 同步 | ✅ | layout-theme-language.spec「中英切换一次性生效」；i18n 单测（并集预加载、dayjs locale、html lang、document.title 重译、zh 缺 key 回退） |
| 14 | access 过期并发只刷新一次并成功重放；refresh 失效只跳登录一次 | ✅ | request-behavior.spec 两用例（`window.__APEX_DEMO_E2E__` 令 token 失效观测调用记录）；request 单测（single-flight、`_authRetried` 一次重放） |
| 15 | refresh 期间切换账号不把旧 token 写回 | ✅ | request/auth.session 单测：epoch 不匹配丢弃结果、等待期间 abort 不重放（TASK-006/007 用例） |
| 16 | 普通 403 不刷新 profile；权限变更 403 只刷新一次并立即清失权页签 | ✅ | request 单测（三类 403 语义、profileRefresh 单飞+30 秒同版本冷却+防递归）；auth.session 单测（失权页签关闭、当前页 replace /403） |
| 17 | 重复 GET/页面隐藏/路由切换取消请求；进度条最终归零 | ✅ | request-behavior.spec「路由切换取消在途请求」；request 单测（cancel-previous 稳定 key、scope abort、loading 计数含 401 等待只计一次/归零不悬挂）；GlobalProgress 单测 |
| 18 | `/403`、未知路径 404、`/500`、注入渲染错误结果正确 | ✅ | error-pages.spec 5 用例（403 直达/* 兜底 404/显式 /404//500 直达/SPA fallback）；RouterErrorBoundary 与 PageErrorBoundary 单测覆盖注入渲染错误路径 |
| 19 | 三类恶意外站 redirect 与 `/\evil.example` 不离开 origin | ✅ | auth.spec 参数化 5 例（https/http/协议相对/反斜杠/控制字符）全部回 `/dashboard`；redirect 单测四类恶意样例 |

## 2. §19.2 工程验收逐项自查

| # | 条目（摘要） | 结论 | 证据 |
| --- | --- | --- | --- |
| 1 | 六个命令全部通过 | ✅ | 本任务 §0 表：`pnpm check` 覆盖 check:structure/lint/typecheck/test/build，`pnpm test:e2e` 全项目通过 |
| 2 | 页面/组件同名文件夹与实现文件；无 `index.tsx` | ✅ | `pnpm check:structure` 通过 + check-structure.test.mjs fixture（每类规则含应通过/应失败样例） |
| 3 | `src/features/` 叶子域只含 `components/`、`hooks/`（+同目录辅助文件） | ✅ | check:structure feature 内容白名单规则与 fixture；`features/demo` 为 §13.3 约定的可整体剔除域豁免嵌套 demo 禁令（fixture 显式覆盖） |
| 4 | 页面入口全在 `src/pages/`，HTTP/业务请求与 DTO 全在 `src/services/`，五目录业务域路径对齐 | ✅ | check:structure（loadPage 目标归属、业务请求逃逸、业务域对齐规则）每次提交与 CI 执行 |
| 5 | 跨域复用提升到共享层；共享层不反向依赖 pages/features；service 不导入 React UI | ✅ | check:structure 依赖方向规则（`src/components`、`src/hooks` 反向导入、service 导入 React UI 均非零退出） |
| 6 | 无 `../../` 及更深导入；`@/*` 四环境解析一致；路径大小写匹配 | ✅ | check:structure 深层相对导入与大小写规则；tsconfig.app.json/vite.config.ts/Vitest 同源 alias；本机 Windows 大小写不敏感场景由 CI（ubuntu，本任务 `.github/workflows/ci.yml`）复核 |
| 7 | 类型就近且唯一权威；无全局类型桶/复制接口 | ✅ | 评审：`src/types/` 按业务域分目录、无 `types.ts`/`common.ts`/`model.ts`/barrel（TASK-003 交付并静态核验）；DTO 权威定义唯一（§14.3，demo adapter `import type` 引用） |
| 8 | 魔法数字/字符串收敛为最小作用域具名常量；无单体 constants 桶 | ✅ | 评审：§3.6 所有权五文件 + 六业务域常量（TASK-003 交付）；权限码/endpoint/sortBy 白名单单一来源，页面无权限魔法字符串（TASK-014 静态检索核验） |
| 9 | 核心目录覆盖率达 §16.3 阈值 | ✅ | `vite.config.ts` 五 glob 各自 80/80/80/80 阈值；本任务 `pnpm check` 退出码 0，全局汇总语句 97.86%/分支 93.37%/函数 99.33%/行 97.96%（见 §0） |
| 10 | engines/packageManager 声明；CI 使用 frozen lockfile | ✅ | package.json：`engines.node >=22.22.0`、`packageManager: pnpm@11.21.0`；`.github/workflows/ci.yml` 固定 `pnpm install --frozen-lockfile`，Node 22.23.1（满足 engines、与本地一致）、pnpm 由 action 读取 packageManager |
| 11 | Husky/lint-staged 只读检查（oxlint + 全量结构检查），不格式化不改代码 | ✅ | `.husky/pre-commit`（lint-staged oxlint + `pnpm check:structure`）、`.husky/pre-push`（`pnpm typecheck`），均无 `--fix`；历次提交实际触发通过 |
| 12 | `VITE_DEMO_MODE=off` 产物不含哨兵/demo 账号/demo chunk | ✅ | 本任务 `pnpm run check:demo-off`：产物扫描 0 命中、退出码 0（§0） |
| 13 | 按 README 生产服务器配置直接刷新 `/system/user` 仍返回应用并正确路由 | ✅* | 自动等价证据：error-pages.spec「刷新深层路由经 SPA fallback 返回应用并正确路由」（`vite preview` 即 README 所述 fallback 形态）。README「Nginx/Apache/通用静态托管」三段配置的手动核验（VERIFY-005，kind=manual）**未由 Agent 执行**，留给用户：`pnpm build` 后按 README 任一配置托管 dist，浏览器直开并刷新 `/system/user`，应进入用户管理页而非 404/白屏 |
| 14 | Chromium 全量 E2E、Firefox/WebKit 关键冒烟通过 | ✅ | 本任务 `pnpm test:e2e` 全项目通过：chromium 38/38、firefox smoke 4/4、webkit smoke 4/4（Playwright 1.62.1，二进制 chromium 151.0.7922.34 / firefox 153.0 / webkit 26.5，版本记录于 README） |
| 15 | README 含后端最终鉴权、token XSS 风险、Activity 约束、环境变量、demo 模式及 SPA fallback 说明 | ✅ | README.md 已全量重写：安全边界声明（页首+专节）、token localStorage XSS 与 CSP/httpOnly Cookie 替代、Activity 页面约束、§16.1 环境变量表、demo 模式与源码移除步骤、Nginx/Apache/通用 SPA fallback 示例、实测浏览器版本、本地开发与构建命令 |

## 3. 自查发现并处理的缺口

1. **README 为脚手架占位文本**（§19.2 第 15 项不满足）→ 本任务整体重写为中文全量文档，覆盖验收标准要求的全部章节。
2. **CI workflow 缺失**（§16.2「CI 固定执行 frozen install + check + e2e」、§19.2 第 10 项无据可查）→ 新增 `.github/workflows/ci.yml`：`pnpm install --frozen-lockfile` → `pnpm check` → `playwright install --with-deps` → `pnpm test:e2e` → `pnpm run check:demo-off`，Node/pnpm 与 engines/packageManager 一致。
3. **§19 逐项自查无留痕工作产物** → 本文档落盘并随仓库提交。
4. 未发现其他功能缺口：§19.1 全部条目均能指认既有自动化或单测证据（见 §1），无需代码修复；依赖升级与线上部署按 nonGoals 排除。

## 4. 环境限制与用户手动验证项

| 项 | 说明 | 当前状态 |
| --- | --- | --- |
| VERIFY-005（manual）：按 README 静态服务器配置刷新 `/system/user` | 用户操作路径：`pnpm build` → 按 README「构建与部署」任一配置（Nginx `try_files … /index.html` / Apache mod_rewrite / `npx serve --single dist`）托管 `dist/` → 浏览器直接访问并刷新 `/system/user`，预期返回应用并路由到用户管理页 | 未由 Agent 执行（kind=manual 禁止代跑）；自动等价证据为 E2E 深链刷新用例（vite preview 自带 fallback） |
| CI 首次线上运行 | `.github/workflows/ci.yml` 已落盘并固定全部步骤；实际 GitHub Actions 运行结果需推送后由平台产生（本分支按边界未执行 remote push） | 本地已逐命令验证同套命令通过；CI 平台执行留待编排层推送后观察 |

---

*本记录为 TASK-019 收尾自查留痕；后续模板发布请随版本更新 §0 命令结果与 README「实测浏览器版本」表。*
