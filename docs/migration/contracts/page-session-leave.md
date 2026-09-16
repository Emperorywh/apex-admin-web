# 合同：页面会话（内存草稿、轻量状态、离开协调与容量准入）（T013 交付）

> 消费方：所有带表单/编辑态的业务页（T028/T030/T035/T043/T047/T059/T061/T066/T067 等）、主动退出接线（T017）、强制失效编排（T015）、分域验收（T093/T094）。
> 规格依据：SPEC §8.1、§9.1、A09/A11/A13。隔离验证见 `evidence/T013/`（V01—V05 已通过；V06/V07 及刷新恢复复核见交接剩余项）。
> 边界：草稿/轻量状态挂在稳定会话层（不随页签实例淘汰丢失）；写入/传输任务仍在 `@/services/session-tasks`（T011），本层只读取其记录构成保护条件，不接管任务生命周期。

## 1. 模块与入口

| 文件 | 职责 |
| --- | --- |
| `src/services/page-session/pageSession.types.ts` | DraftRecord / TabProtection / LeaveConfirmRequest 等类型 |
| `src/services/page-session/pageSessionStore.ts` | 草稿登记 + 轻量页签状态唯一容器（内存、不写 localStorage） |
| `src/services/page-session/leaveGuard.ts` | 统一离开协调器：保护汇总、确认通道、批量原子关闭、容量准入、beforeunload |
| `src/services/page-session/usePageSession.ts` | 页面侧 Hook：`usePageSession`（tabKey + 草稿/轻量状态操作）、`useTabDrafts` |
| `src/router/tabIdentity.ts` | 页签身份解析唯一规则（SessionHost 同步与页面 Hook 共用） |
| `src/layouts/SessionHost/LeaveGuardHost.tsx` | 稳定会话层宿主：确认弹窗（声明式 Modal）、beforeunload 同步、纪元复位 |

## 2. 页面接入方式

```ts
import { usePageSession } from '@/services/page-session'

const session = usePageSession()
// session.tabKey: 当前页签 key（满幅视图为 null；对象页签已按 objectParam 归一）

// 草稿：只在用户实际修改数据的事件处理器里登记（无稿初始值不会误标为脏）
onChange={(v) => { setForm(v); session.setDirty('main-form', '新建订单') }}
// 保存成功 / 用户确认重置后解除（只解除草稿保护，不解除任务保护）
await save(); session.clearDirty('main-form')

// 轻量状态：查询条件/分页/展开与选中 ID 等可序列化数据；LRU 淘汰重建后仍可读回
session.setLightState('filters', { page, keyword })   // 存入前 JSON 往返，不可序列化被静默丢弃
const saved = session.getLightState<{ page: number }>('filters')  // 挂载时读一次用于恢复
```

- 页签身份规则与宿主同源（`router/tabIdentity.ts`），页面不得自行拼接 tabKey。
- 轻量状态不保存大批查询结果；「LRU 重建时恢复并核验对象」的核验（对象仍存在/有权）是页面职责。
- 关闭/刷新页签会清该页签全部草稿与轻量状态（协调器执行）；账号切换/认证失效由纪元复位清空。

## 3. 离开协调（关闭/刷新/退出共用）

```ts
import { requestCloseTabs, requestRefreshTab, confirmSessionExit } from '@/services/page-session'

await requestCloseTabs([key | ...keys])  // 单关/批量：无保护直接原子执行；有保护先弹确认
await requestRefreshTab(key)             // 页签刷新：确认后清草稿/轻量状态再重建实例
const ok = await confirmSessionExit()    // 主动退出保护检查（含会话级 tabKey=null 任务）
```

- 保护条件三类：草稿登记、写入任务 `queued/running/unknown`、传输 `active/unknown/cancelled但已发字节`（T011 记录）。
- 确认弹窗按页签列明对象、动作、执行中/待确认状态，并固定提示「停止等待不能撤销后端执行；结果未知请稍后在来源页核查，系统不会自动重发」；确认后才 `stopWaiting → cancel → dismiss` 并清除页面会话状态。
- **批量原子性**：范围在发起时确定（TabsBar 右键/Dock 废纸篓按当前页签列表取可关集合），确认后单次 `tabsClosed(keys)` dispatch；取消时一个页签都不关。
- 全部页签被关闭后 SessionHost 自动 `replace` 回首个有权入口（`resolveFirstAccessiblePath`），不留无宿主空页。
- **T017 接线**：Header 退出已改为 `await confirmSessionExit()` → 通过后执行 `logout()` + `sessionExpired()`；T017 重做登录/用户菜单时保持此顺序。
- **T015 接线点**：强制失效编排可直接调用 `releaseProtections` 同款组合（stopWaiting/cancel/dismiss + `clearTabSessionState`）；本层不自行编排。

## 4. 容量准入与保护性 LRU

- 容量上限沿用 `PAGE_CACHE_MAX_ENTRIES = 10`（`tabsSlice` 已导出）。
- `tabSynced` 增加 `protectedTabKeys`：受保护页签在 LRU 淘汰中豁免；全部候选受保护时宁可暂时超容量也不丢状态。
- 新建页签且「待淘汰候选全部受保护」时，`useBlocker` 在导航提交前拦截并弹「页签容量已满」：留在当前页（reset，不导航）或仍要打开（proceed，超容量但受保护页不淘汰）。
- 已知限制：被拦后极短时间内连续发起多次导航（探针循环场景）会堆叠 blocked 状态，弹窗按最新 blocked 位置重建（`blockerKey` 修复），但堆叠期间的中间导航会被丢弃——正常人工操作（一次一个导航）不受影响。

## 5. 浏览器刷新/关闭（A13 范围内）

- 任一页签存在保护条件（含会话级任务）时挂载 `beforeunload` 原生守卫，无保护时卸载；由 `syncBeforeUnloadGuard()` 在保护快照变化时同步。
- 原生提示只在浏览器能力范围内保护，确认离开后不承诺回执/续传（§9.1）。

## 6. 已验证限制与移交发现

- 确认弹窗必须走声明式 `<Modal>`（LeaveGuardHost）：命令式 `modal.confirm` 在 StrictMode 下 effect 双挂载会产生无法销毁的僵尸弹窗（已踩坑并修复，后续卡勿回退）。
- 验证期间发现**刷新后登录态恢复在真实后端环境两次失败**（token 已存储但 restore 未通过，落地 /login?redirect=...），属 T005 身份恢复范围（合同 §7 已有缓存快照渲染路径存疑项），归 T090 真实环境复核；T013 未改动 auth 层。
- 轻量状态存入经 JSON 往返：函数/循环引用被静默丢弃；消费方保存纯数据。
- 探针页 `?dirty=1` 挂载自动置脏仅用于构造批量保护场景；正式页面必须由用户动作触发登记。
