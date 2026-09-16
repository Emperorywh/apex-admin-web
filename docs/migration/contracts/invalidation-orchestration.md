# 合同：统一失效编排、授权暂停恢复与权限撤权（T015 交付）

> 消费方：T017（主动退出/用户菜单）、T018（授权页激活接线）、各业务页（按钮撤权的动作消费）、T092（跨页安全矩阵验收）。
> 规格依据：SPEC §6.2、§8.2、§9.1、A02/A03/A09。隔离验证见 `evidence/T015/`；实现见 `src/services/auth/invalidationOrchestrator.ts`。
> 边界：本层只做编排（监听状态变迁与事件、调用各清理点），不自建第二套身份/任务/草稿状态；查询暂停依赖 T007 宿主可见性（overlay 挂起即 abort），写入/传输中止经 T011 控制器 API。

## 1. 模块与装配

| 文件 | 职责 |
| --- | --- |
| `src/services/auth/invalidationOrchestrator.ts` | 唯一编排器：`initInvalidationOrchestrator()`（main.tsx 启动期注册一次）+ `abortCancellableSessionActivities()` + `reconcileRevokedPagesNow()` + `reconcilePermissionsAfterForbidden()` + `resumeAfterSoftwareAuthorizationActivated()` + `isPermissionReconcileInProgress()` |
| `src/services/auth/auth.service.ts` | T005 之上新增 `reverifyIdentity()`：会话中 detail 重查唯一入口（与启动恢复共用协议与快照组装），返回 `verified / unauthorized / session-expired / unreachable` |
| `src/store/slices/authSlice.ts` | 新增 `softwareAuthorizationResumed`：清除挂起标记，不动身份与纪元 |
| `src/router/guard.ts` | 认证检查后新增授权挂起强制：`authorizationRequired && 非授权页 → redirect /authorize-ingress`（直访也不例外） |
| `src/layouts/SessionHost/SessionHost.tsx` | 挂起时 SPA 内跳转授权页的效应（与守卫同一条件，覆盖会话内变迁） |

## 2. 认证失效（1000000 / 会话不可信）——已接线，无需页面参与

1. 事件桥（T005）清存储/请求头并派发 `sessionExpired`（`identity===null` 守卫保证并发失效只处理一次）；
2. 编排器 store 订阅捕获 epoch 变化，**同步**（先于 React 宿主）`abortCancellableSessionActivities()`：执行中/排队写入 `stopWaitingForWrite`（转待确认）、在途传输 `cancelTransferTask`（已发字节转待确认）；
3. React 宿主按纪元复位：`SessionTasksHost` 清任务记录、`LeaveGuardHost` 清草稿/轻量状态与未裁决离开确认、`tabsSlice` 清页签缓存；
4. SessionHost 效应跳登录页（带回跳地址）；迟到回执凭纪元丢弃，重登后不自动重发。

## 3. 软件授权暂停/恢复（1001000）——T018 接线点

- **暂停**（`authorizationRequired` false→true）：编排器中止可取消活动（记录保留为待确认，供恢复后核查）；草稿、页签会话、页签缓存全部保留（身份仍有效，不推进纪元）；路由层转授权页。
- **恢复**（T018 在激活成功后调用，唯一入口）：

```ts
import { resumeAfterSoftwareAuthorizationActivated } from '@/services/auth/invalidationOrchestrator'

const outcome = await resumeAfterSoftwareAuthorizationActivated()
// 'resumed'：挂起已解除、新快照撤权已收敛，调用方负责路由回业务视图
// 'still-unauthorized'：激活未生效（后端仍 1001000），保持授权页
// 'session-expired'：失效编排已收敛，交登录页
// 'unreachable'：网络/服务不可达，保持挂起，稍后可重试
```

- 恢复通过即 `softwareAuthorizationResumed`（不推进纪元→草稿/待确认任务保留），并按新快照收敛暂停期间可能发生的页面撤权；仍有权草稿与入口由既有机制自动恢复，不自动恢复写入/上传。

## 4. 403 权限重查与两类撤权（§8.2）

- 请求层 403（`request-error` 且 `status===403`）触发 `reconcilePermissionsAfterForbidden()`：**单飞行**（并发 403 只处理一次），核验期间 `isPermissionReconcileInProgress()` 供动作层阻止被拒动作重发；
- 重查即 `reverifyIdentity()`：`verified` → 按新快照收敛撤权；`session-expired` → 走第 2 节；`unauthorized` → 走第 3 节；`unreachable` → 保留原快照；
- **页面撤权**（路由 `menuCode` 不在新快照祖先填充集合）：`reconcileRevokedPagesNow()` 停等并清除被撤页签任务记录、清草稿/轻量状态、单次 dispatch 原子关闭全部被撤页签（无确认框，不以确认阻止撤权）、通知「权限已变更」（common 词条，含未知结果与不重发说明）；
- **仅按钮撤权**：无页签命中即不动页面与草稿；动作入口由消费方按 `useAuth().hasButtonCode` 隐藏/禁用，不允许提交。

## 5. 已验证限制与移交发现（2026-09-17）

- **真实后端 detail 恒返回信封 500**（有效 root token 亦然）：恢复/重查实际走「不可达→保留快照」分支；`verified/resumed` 全链、detail 真实形状归 T090 核验后回填本合同与 T005 合同 §5。
- 真实后端对无效 token 不返回 1000000（各端点均 500），1000000 事件→失效链路由事件层注入验证（事件总线/桥/编排器为生产路径，见 evidence V01）；真实过期会话行为归 T090。
- 传输任务在暂停/撤权下的中止与写入共用 `cancelTransferTask` 原语（引擎语义 T011 已验证）；真实大文件停滞/中止归 T090/T096。
- 403 单飞行已实现并有并发丢弃逻辑，完整「detail 成功→撤权」端到端样本缺真实环境，归 T090 定向补验（V06 ◐）。
- 授权挂起标记为会话内状态（不持久化）：整页刷新后由 restoreSession 的 detail 重新检出（真实环境受第 1 条限制，刷新后暂不自动回到授权页，待 detail 修复后自然生效）。
