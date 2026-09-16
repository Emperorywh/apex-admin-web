# 合同：页面统一查询接口（T010 交付）

> 消费方：所有业务页查询 Hook（T030/T066/T084/T089 等各页接入）、T081（图表数据获取可复用可见性语义）。
> 规格依据：SPEC §6.3（并发/过期响应防护）、§9.2（可见性轮询）。隔离验证见 `evidence/T010/`。
> 边界：本接口只管“读”；写入/上传下载归 T011 会话任务层，禁止用查询 scope 的 AbortSignal 承载写入。

## 1. 模块与入口

| 文件 | 职责 |
| --- | --- |
| `src/hooks/page-query/usePageQuery.ts` | 统一查询控制器：发起/清理唯一入口的编排 effect + 代际守卫 |
| `src/hooks/page-query/pageQuery.types.ts` | 类型与 `PAGE_POLLING` 轮询常量（§9.2 源频率唯一来源） |
| `src/hooks/page-query/useDocumentVisible.ts` | document 可见性（visibilitychange, useSyncExternalStore） |
| `src/hooks/page-query/index.ts` | 唯一引入口；业务页不得深路径绕过 |

已迁移消费方（公共 API 不变）：`useOrderList`、`useRoleList`、`useUserList`、`useMenuTree`、`useDashboardOverview`（30s 轮询沿用当前目标实现；源“完成后 5 秒”归 T084）。

## 2. 调用方式

```ts
import { PAGE_POLLING, usePageQuery } from '@/hooks/page-query'

const page = usePageQuery({
  fetcher: (params, { signal }) => pageOrders(params, { signal }), // signal 必须透传给请求层
  params: query,                       // 可 JSON 序列化的纯数据条件；变化即新条件
  polling: PAGE_POLLING.taskRecords,   // 缺省不轮询；频率只能取 PAGE_POLLING 常量
  enabled: isValid,                    // false 不发请求（非法参数/无权不发业务请求），不清数据
})
// page: { data, loading, refreshing, error: ApiError|null, failureCount, reload }
```

- `loading`＝尚无成功数据且有待完成请求；`refreshing`＝已有数据后的后台刷新/轮询。
- `data` 保持最近一次成功值：轮询失败/刷新中不清空，页面据此做降级展示（错误态 + 旧数据）。
- `failureCount` 连续失败计数（成功清零）；本层不弹 toast，去重归 T003 错误事件层。
- `error` 为最近一次已落定失败的 ApiError（取消不算失败）；成功落定才清空。

## 3. 行为语义（已实现）

1. **可见性**＝Activity 激活（RequestScopeProvider isActive）∧ document 可见。任一不满足：中止在途、撤销轮询定时器、保留数据与错误态；恢复可见立即发起一次请求，不积攒隐藏期间任务（§9.2）。
2. **过期响应隔离**：每次发起递增代际，仅最新代可落地；条件切换/隐藏/卸载同时 `abort()` 上一代请求（§6.3 AbortSignal + 代际双保险）。取消静默（无错误、无状态变更）。
3. **轮询**：以“上次请求落定”为基准重排 `setTimeout`——`interval` 模式间隔=intervalMs（防并发堆叠，等效满足“不并发堆叠”优先于字面固定节拍）；`after-completion` 模式间隔=gapMs。任一时刻至多 1 在途 + 1 定时器。源频率：任务记录 1s、实时看板完成后 5s、服务器资源完成后 2s；**其他页面不得因名字含“状态”擅自增加轮询**。
4. **条件键**：`JSON.stringify(params)` 判定变化，消费方无需记忆化；含函数/循环引用的条件退化为引用身份键（WeakMap）。
5. **scope 联动**：页签刷新（revision）、关闭、LRU 淘汰、overlay 挂起经由 scope signal abort 传导到每代请求；无 Provider（登录页）时视为常驻可见、无取消联动。
6. **卸载保护**：卸载后任何响应不落地（mountedRef + 代际双检）。

## 4. 已验证限制与移交发现

- 遮挡（隐藏渲染进程）环境下定时器被钳制到整秒网格：1s 轮询实测 2.0s 周期；真实前台频率待 T090 复核。
- `enabled=false → true` 的恢复请求、`reload()` 与条件切换共用同一编排入口，互不产生重复链（日志证明单链）。
- 慢请求竞态、失败降级、隐藏暂停、恢复立即请求、可见态关闭中止在途与 document 隐藏分支的证据见 `evidence/T010/`（2026-09-16 第六轮补齐 V03b/V04/document 分支：页签栏切回 348ms 内恢复请求、关闭页签与窗口最小化均产生服务端 `aborted=true`、恢复后 10ms 内重发）；前台真实轮询频率的复核归 T090。
- 分页回正、筛选重置编排是调用方职责（T003 合同 §4）；本控制器不代管页码。
