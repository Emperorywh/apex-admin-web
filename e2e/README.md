# E2E 用例与规格条目映射清单

Playwright E2E（规格 §16.3/§16.4）：chromium 项目执行 `e2e/` 全量用例；firefox/webkit 项目仅执行
`smoke.spec.ts`（关键冒烟，`playwright.config.ts` 以 `testMatch` 收窄）。服务入口由 `webServer`
统一承载：`VITE_DEMO_MODE=force` 生产构建 + `vite preview`（SPA fallback），结束后自动关闭。

## §16.3 Playwright 覆盖列表 → 用例映射

| §16.3 条目 | 规格依据 | 用例（文件 · 标题） |
| --- | --- | --- |
| 登录与回跳 | §4.3/§19.1 | auth.spec.ts · 登录成功默认落点为 /dashboard；受保护地址未登录先到登录页并携带 redirect，登录后合法回跳 |
| admin/viewer 差异（按钮隐藏、菜单隐藏、直达 403） | §5.3/§4.4 | permissions.spec.ts · 全部 5 个用例 |
| CRUD（用户 CRUD 与角色分配） | §14.3/§19.1 | user-crud.spec.ts · 用户 CRUD 与角色分配完整走通 |
| 布局切换（热切换 + 窄视口） | §10.1/§11.1 | layout-theme-language.spec.ts · 侧边 ↔ 顶部布局热切换不整页刷新；窄视口（<768px）侧边菜单折叠为导航 Drawer |
| 语言 | §12/§19.1 | layout-theme-language.spec.ts · 中英切换一次性生效 |
| 主题刷新 | §8.3/§10.2/§17.15/§17.16 | layout-theme-language.spec.ts · 主题切换实时生效；深色主题刷新不出现相反底色 |
| 多页签缓存/LRU | §9.1/§9.3/§17.9/§17.13/§17.14 | tabs.spec.ts · 全部 7 个用例 |
| 并发 401 | §6.2/§17.4 | request-behavior.spec.ts · access 失效后并发 401 只刷新一次，业务请求各重放一次并成功 |
| refresh 失效 | §6.2/§17.4 | request-behavior.spec.ts · refresh 失效只执行一次会话清理并跳登录一次 |
| 路由切换取消 | §17.12/§17.24 | request-behavior.spec.ts · 路由切换取消在途请求 |
| 错误页 | §4.2/§19.1 | error-pages.spec.ts · 全部 5 个用例 |
| 恶意 redirect | §4.3/§17.21 | auth.spec.ts · 恶意 redirect 参数化 5 例（https/http/协议相对/反斜杠/控制字符） |

## 前置任务推迟到浏览器级的核对场景（TASK-009/010/011/012）

| 场景 | 用例 |
| --- | --- |
| 主题切换刷新不闪烁（TASK-009） | layout-theme-language.spec.ts · 深色主题刷新不出现相反底色 |
| 布局热切换与窄视口（TASK-010） | layout-theme-language.spec.ts · 布局热切换、窄视口导航 Drawer |
| 页签 LRU/拖拽/右键/刷新恢复（TASK-011） | tabs.spec.ts · LRU 淘汰、鼠标拖拽重排、右键菜单、刷新恢复 |
| §5.3 admin/viewer 矩阵差异（TASK-012/013） | permissions.spec.ts · 全部用例 |

## §17 边界情况覆盖索引（E2E 部分）

§17.4（并发 401/重放一次）、§17.9（同路由不同 query 页签）、§17.12（隐藏/关闭 abort）、
§17.13（LRU 只统计普通缓存）、§17.14（关闭后继顺序）、§17.15（主题实时切换）、
§17.16（刷新不出现相反底色）、§17.20（登出后后退拦截）、§17.21（恶意 redirect）、
§17.23（深链刷新 SPA fallback）、§17.24（前请求取消）——逐条对应见上表用例标题内标注。

## 运行

```
pnpm test:e2e                     # 全部项目（chromium 全量 + firefox/webkit 冒烟）
pnpm test:e2e --project=chromium  # 仅全量
pnpm test:e2e --project=firefox --project=webkit  # 仅冒烟（需本地已安装对应浏览器二进制）
pnpm exec playwright install      # 首次运行前安装浏览器二进制
```

401/refresh/取消等行为的可观测性来自 demo 测试专用控制器（§13.2）：demo 构建下
`window.__APEX_DEMO_E2E__` 提供 token 失效、端点人工延迟与调用记录读取（`e2e/helpers.ts`）。
