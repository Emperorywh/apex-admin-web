# 操作映射总台账（operations）

> 由统筹者汇总维护；页面任务只更新自己的 `tasks/<ID>.md`，由统筹者把已合并实现的映射汇总到这里。
> 列：旧路由/组件/操作 → 新实现 → method/path/operationId → 权限 → 状态/证据。
> T00.1 初始化（2026-09-17）：尚无已合并页面实现，全部待各任务交付后登记。

| 任务 | 旧入口/操作 | 新实现 | Method + Path | operationId | 权限 | 状态 | 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P02 | AuthorizeIngress/硬件码展示 | `pages/authorize-ingress` + `features/license-activation/hooks/useHardwareInfo` | GET /fms/v1/auth/license/getHardwareInfo | getHardwareInfo | 无需认证（实证） | 已合并；验证已通过 | tasks/P02.md（联验 2026-09-18） |
| P02 | AuthorizeIngress/硬件码复制 | `features/license-activation/utils/copyText` | — | — | 登录 | 已合并；验证已通过 | 剪贴板读回实证 |
| P02 | AuthorizeIngress/激活提交 | `features/license-activation/components/ActivationForm`（P29 复用） | POST /fms/v1/auth/license/softwareActivation | softwareActivation | 登录（security None） | 已合并；读链路通过，**写副作用待专用环境** | tasks/P02.md |
| P02 | （旧）成功跳 /over-look | activationConfirmed + resolveLandingPath 按权限导航 | — | — | 登录 | 已合并；落点机制实证 | tasks/P02.md |

## 汇总状态口径

- 页面任务记录中的「操作映射」表是权威明细；本表只汇总已合并到工作分支的实现。
- 状态沿用 TASKS.md：实施状态（未开始/进行中/前端完成/受阻/已合并）与验证状态（未验证/部分通过/已通过/不适用）分开记录。
