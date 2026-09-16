# 合同：会话级写入与文件传输任务（T011 交付）

> 消费方：所有业务页的保存/指令/删除提交（T028/T030/T035/T047/T048…）、文件上传页（T035/T037/T071/T074/T077）、离开保护协调器（T013/T017）、统一失效编排（T015）。
> 规格依据：SPEC §6.3、§9.1、§10.1、A11/A13。隔离验证见 `evidence/T011/`。
> 边界：本层与查询层（`@/hooks/page-query`）互不接管；页面订阅经 `@/services/session-tasks` 唯一入口。

## 1. 模块与入口

| 文件 | 职责 |
| --- | --- |
| `src/services/session-tasks/sessionTask.types.ts` | 任务记录/状态/快照类型 |
| `src/services/session-tasks/sessionTaskStore.ts` | 记录唯一容器：订阅 + 不可变快照 + 会话复位 |
| `src/services/session-tasks/writeTasks.ts` | 普通写入控制器：submit/stopWaiting/dismiss |
| `src/services/session-tasks/uploadEngine.ts` | XHR 上传引擎：真实进度/速度/ETA/停滞检测/信封判读 |
| `src/services/session-tasks/transferTasks.ts` | 文件传输控制器：start/cancel/dismiss 与阶段推进 |
| `src/services/session-tasks/useSessionTasks.ts` | 订阅 Hook（快照/按页签过滤/活动传输判定） |
| `src/layouts/SessionHost/SessionTasksHost.tsx` | 稳定会话层挂载（SessionHost 内 PageCacheHost 旁）：纪元变化清空记录 |

## 2. 写入任务调用方式

```ts
import { submitWriteTask, stopWaitingForWrite, dismissWriteTask, useTabWriteTasks } from '@/services/session-tasks'

const handle = submitWriteTask({
  tabKey,                    // 当前页签 key（对象页签为稳定对象身份）；会话级动作为 null
  actionKey: 'vehicle.delete',
  detail: `删除车辆 ${name}`, // 提交时语言；跨语言展示由页面按 actionKey 重译
  run: (ctx) => legacyPost('/fms/v1/dispatcher/vehicle/deleteVehicle', { vehicleKey }, { signal: ctx.signal }),
  onSuccess: () => reload(),  // 仅明确成功且纪元一致时调用（刷新列表/统计）
})
// handle.settled: Promise<WriteTaskRecord | null>（记录被清除/复位时为 null，不 reject）

const tasks = useTabWriteTasks(tabKey)   // 页面渲染本页任务（含待确认记录：对象/动作/提交时间）
```

- **query 边界**：`run` 必须把 `ctx.signal` 透传给请求层；该信号属任务控制器（会话级），**绝不**传查询 scope 的 AbortSignal。
- **状态机**：`queued`（执行器未调用）→ `running` → `success | failed | unknown`；执行器调用前取消为 `cancelled`（可证明未提交）。
- **结果语义**（§6.3）：仅后端信封可判读的明确拒绝（业务失败/授权/会话码）记 `failed` 并保留 bizCode/bizMessage 原文；超时、网络中断、信封不可判读、用户停止等待一律记 `unknown`（`unknownReason: receipt-lost | stopped-waiting`），保留对象/动作/提交时间供页面核查，不得标为失败或已撤销。无任何自动重试/重发。
- **停止等待**（§9.1 离开确认原语）：`stopWaitingForWrite(id)` 中止在途等待并转待确认；不能撤销后端执行。离开确认完成后协调器调 `dismissWriteTask(id)` 清记录（内部会先 abort 防悬挂）。

## 3. 文件传输调用方式

```ts
import { startTransferTask, cancelTransferTask, useTabTransferTasks } from '@/services/session-tasks'

const handle = startTransferTask({
  tabKey, kind: 'version', name: file.name,
  url: '/fms/v1/…upload…',            // 旧协议路径，鉴权/语言头由引擎注入
  formData,                            // 字段名与扩展名校验按源契约由页面负责（如 .zip）
  onSuccess: (envelope) => refresh(),  // 仅信封业务成功且纪元一致时调用
  stallTimeoutMs: 60_000,              // 缺省沿旧系统 60 秒（连接/上传阶段）
})
```

- **阶段**：`preparing → uploading（真实进度/速度/ETA）→ server-processing → 终态`。字节 100% 不等于成功——`uploading` 结束进入 `server-processing`（不跑停滞检测，后端处理耗时不可预估），等待信封业务成功才记 `success`（§10.1）。
- **进度**：`lengthComputable=false` 时 `percent=null`，页面必须显示不定进度；百分比仅可计算总量时展示。
- **终态与 resultUnknown**（"已有数据发往后端且执行结果不明"判据为 `bytesSent>0`）：
  | 引擎结果 | 状态 | resultUnknown |
  | --- | --- | --- |
  | 信封业务成功 | success | false |
  | 信封业务拒绝 | failed | false |
  | 用户取消 | cancelled | bytesSent>0 |
  | 停滞中止/网络中断/服务端处理超时 | bytesSent>0 ? unknown : failed | unknown 时 true |
  | HTTP 非 2xx / 响应不可判读 | failed / unknown | bytesSent>0 / true |
- **取消**：`cancelTransferTask(id)` 仅说明前端停止传输；不承诺后端未执行。`dismissTransferTask(id)` 移除记录（离开确认后）。
- 引擎沿旧 `uploadWithProgress` 语义：100ms 节流 + 末次必发、连接/上传阶段 60 秒停滞中止、服务端处理阶段停用停滞、不设硬超时（响应侧 60 秒保护，超时归待确认）。

## 4. 会话与页签关系（§9.1）

- 任务层挂在 SessionHost 稳定会话层：切页签/进全屏/暂缓/404 视图只暂停页面 UI（Activity 效果卸载），回执继续入 store；原页重新激活即恢复订阅显示最新状态。
- 页签关闭/刷新不自动中止任务：运行中/待确认构成离开保护条件（T013 消费 `useSessionTasksSnapshot` 判定），确认后逐条 dismiss。
- 身份纪元变化（登录/登出/切账号/认证失效，`auth.epoch`）由 SessionTasksHost 统一 `resetSessionTasks()`；落定时刻纪元不一致的迟到回执被丢弃，onSuccess 一律不调用，不写入新账号。
- T015 接线点：认证失效/授权暂停/撤权时的"中止可取消等待 + 清记录"经 stopWaiting/cancel/dismiss 组合实现，本层不自行编排。

## 5. 已验证限制与移交发现

- 环回环境浏览器网络缓冲会整体吞下 30MB 级请求体，`uploading` 阶段真实停滞无法在隔离环境构造；停滞检测代码沿旧实现原样迁移，真实停滞/大文件行为归 T090/T096 复核。
- `toApiError` 现在识别裸 `ApiError` 形状对象并原样透传（本次修复；此前 legacyCall 抛出的错误会被降级为 CLIENT.UNKNOWN，导致取消/业务失败误判）。
- 任务记录的 `detail` 是提交时语言快照；语言切换后待确认记录的展示重译是页面职责（按 `actionKey`），本层不存 i18n key 之外的文案状态。
- 传输类别 `kind`、进度条与待确认记录的 UI 呈现归各页面/外壳卡；本层不提供全局操作中心（SPEC 明确不新增）。
