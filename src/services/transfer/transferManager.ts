/**
 * 传输管理器：模块级单例，承载独立于页面 effect 的传输生命周期（T00.6，规格 10.2）。
 *
 * 设计要点：
 * - AbortController 由管理器持有，不挂在页面 scope 上：切换页签（Activity 隐藏、
 *   effect 清理）、关闭页签、LRU 淘汰都不会误杀传输；普通查询的取消机制
 *   （RequestScopeProvider）与传输互不影响（规格 10.3）
 * - 上传到 100% 只是字节交付完毕：调用方应在响应返回前 markProcessing，
 *   由「正在处理」阶段区别于完成（规格 10.5）
 * - 成功/失败必须依据业务结果或文件响应判定；本地 cancel 仅代表客户端终止，
 *   不保证服务端已撤销，阶段标记为 aborted（结果待确认语义，规格 10.4）
 * - 本期不新增面向用户的全局任务中心（规格 10.2）：管理器只提供状态与订阅，
 *   页面内进度 UI 由 useTransfers 消费；承载页签已关闭的传输完成时由
 *   TransferWatcher 以一次性消息提示结果（非任务中心）
 * - 终态任务保留一小段时间供页面展示结果，随后自动清理，避免长期累积
 */

import type {
  TransferChangeListener,
  TransferDescriptor,
  TransferKind,
  TransferPhase,
  TransferProgress,
  TransferTask,
} from '@/services/transfer/transfer.types'
import { uiFeedback } from '@/services/feedback/uiFeedback'
import i18next from 'i18next'

/** 终态任务保留时长：页面能短暂看到结果，随后自动清理（不冒充任务中心） */
const TERMINAL_TTL_MS = 15_000

/** 管理器文案经 i18next 单例翻译（key 即中文文案，与 request 层同约定） */
function tr(key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, options ?? {})
}

/** 页面可调用的传输句柄：回报进度、推进阶段、终止请求 */
export interface TransferHandle {
  /** 传给请求层的取消信号（axios config.signal）；cancel() 即中止 */
  readonly signal: AbortSignal
  /** 回报真实进度；total 未知传 null（不确定进度），.loaded 仍应累加 */
  setProgress(loaded: number, total: number | null): void
  /** 字节交付完毕、等待服务端响应时调用（上传 100% 后的「正在处理」） */
  markProcessing(): void
  /** 业务结果或文件响应确认成功后调用 */
  succeed(): void
  /** 失败终态；reason 传已翻译的可展示文案 */
  fail(reason: string): void
  /** 本地主动终止（仅真实可取消的传输才暴露取消入口，规格 10.3） */
  cancel(): void
}

/** 内部可变任务记录 */
interface TransferRecord {
  task: TransferTask
  controller: AbortController
  /** 终态自动清理定时器 */
  ttlTimer?: number
}

/** 模块态：全部任务（含近期终态）+ 订阅者 */
const records = new Map<string, TransferRecord>()
const listeners = new Set<TransferChangeListener>()
let seq = 0

/**
 * 只读快照缓存：仅在 notify() 时整体重建。
 * useSyncExternalStore 以 Object.is 比较 getSnapshot 结果，若每次返回新数组
 * 会判定「快照持续变化」触发重渲染循环，因此快照重建必须收敛在本函数。
 */
let snapshotCache: TransferTask[] = []

function notify(): void {
  snapshotCache = [...records.values()].map((record) => record.task)
  for (const listener of listeners) listener()
}

/** 取全部任务快照（含近期终态）；引用稳定，可直接作为 useSyncExternalStore 的 getSnapshot */
export function getTransfers(): TransferTask[] {
  return snapshotCache
}

/** 统计若干页签内仍在进行的传输（transferring/processing 阶段） */
export function findActiveTransfersIn(tabKeys: ReadonlySet<string>): TransferTask[] {
  return getTransfers().filter(
    (task) =>
      task.tabKey !== null &&
      tabKeys.has(task.tabKey) &&
      (task.phase === 'transferring' || task.phase === 'processing'),
  )
}

/** 是否存在任一进行中的传输（会话结束清理等场景判断用） */
export function hasActiveTransfers(): boolean {
  return getTransfers().some((task) => task.phase === 'transferring' || task.phase === 'processing')
}

/** 订阅任务变化（useSyncExternalStore 消费）；返回退订函数 */
export function subscribeTransfers(listener: TransferChangeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 生成自增任务 ID（模块内唯一即可，不进存储） */
function nextId(kind: TransferKind): string {
  seq += 1
  return `${kind}-${Date.now().toString(36)}-${seq}`
}

/** 终态写入：记录时间、安排 TTL 清理并通知 */
function settle(id: string, phase: Extract<TransferPhase, 'done' | 'failed' | 'aborted'>, reason?: string): void {
  const record = records.get(id)
  if (!record) return
  if (record.task.phase === 'done' || record.task.phase === 'failed' || record.task.phase === 'aborted') return
  if (!record.controller.signal.aborted && phase === 'aborted') record.controller.abort()
  record.task = {
    ...record.task,
    phase,
    reason,
    finishedAt: Date.now(),
  }
  // 终态保留一小段时间供 UI 展示，随后移除；已取消的定时器不可能存在（终态只写一次）
  record.ttlTimer = window.setTimeout(() => {
    records.delete(id)
    notify()
  }, TERMINAL_TTL_MS)
  notify()
}

/** 发起一次传输登记；调用方负责把 handle.signal 传给请求层并回报进度/结果 */
export function beginTransfer(descriptor: TransferDescriptor): TransferHandle {
  const id = nextId(descriptor.kind)
  const controller = new AbortController()
  const progress: TransferProgress = { loaded: 0, total: null }
  records.set(id, {
    controller,
    task: {
      id,
      tabKey: descriptor.tabKey,
      kind: descriptor.kind,
      name: descriptor.name,
      phase: 'transferring',
      progress,
      startedAt: Date.now(),
      finishedAt: null,
    },
  })
  notify()

  return {
    signal: controller.signal,
    setProgress(loaded, total) {
      const record = records.get(id)
      if (!record) return
      // 终态后忽略迟到的事件（axios 取消后仍可能触发一次进度回调）
      if (isTerminal(record.task.phase)) return
      record.task = { ...record.task, progress: { loaded, total } }
      notify()
    },
    markProcessing() {
      const record = records.get(id)
      if (!record || isTerminal(record.task.phase)) return
      record.task = { ...record.task, phase: 'processing' }
      notify()
    },
    succeed() {
      settle(id, 'done')
    },
    fail(reason) {
      settle(id, 'failed', reason)
    },
    cancel() {
      // 本地终止：中止在途请求；服务端可能已开始处理，aborted ≠ 服务端已撤销（规格 10.4）
      settle(id, 'aborted', tr('传输已取消（仅本机终止，服务端处理不保证已撤销）'))
    },
  }
}

/** 取消指定传输（状态追踪入口之一；页面/关闭确认场景调用） */
export function cancelTransfer(id: string): void {
  const record = records.get(id)
  if (!record) return
  if (isTerminal(record.task.phase)) return
  settle(id, 'aborted', tr('传输已取消（仅本机终止，服务端处理不保证已撤销）'))
}

/** 终止全部进行中的传输（退出登录/会话失效时清用户数据，规格 5.3） */
export function abortAllTransfers(reason: string): void {
  for (const [id, record] of records) {
    if (isTerminal(record.task.phase)) continue
    // 直接置终态但不逐条弹提示：会话结束的批量终止由 TransferWatcher 静默呈现
    if (!record.controller.signal.aborted) record.controller.abort()
    record.task = { ...record.task, phase: 'aborted', reason, finishedAt: Date.now() }
    record.ttlTimer = window.setTimeout(() => {
      records.delete(id)
      notify()
    }, TERMINAL_TTL_MS)
  }
  notify()
}

/** 清空全部记录（含终态残留）；登出后不留上一会话的传输痕迹 */
export function clearTransfers(): void {
  for (const record of records.values()) {
    if (record.ttlTimer !== undefined) window.clearTimeout(record.ttlTimer)
    if (!record.controller.signal.aborted) record.controller.abort()
  }
  records.clear()
  notify()
}

function isTerminal(phase: TransferPhase): boolean {
  return phase === 'done' || phase === 'failed' || phase === 'aborted'
}

/**
 * 承载页签是否已全部关闭（孤儿传输判定）。
 * tabKey 为 null 的传输视为「无承载页签」，其终态始终以消息提示。
 */
export function isOrphanedTransfer(task: TransferTask, openTabKeys: ReadonlySet<string>): boolean {
  return task.tabKey === null || !openTabKeys.has(task.tabKey)
}

/**
 * 孤儿传输终态的一次性消息提示（状态追踪的最小呈现，非全局任务中心）。
 * 由 TransferWatcher 在订阅回调中调用；同一任务只提示一次。
 */
const notifiedIds = new Set<string>()

export function notifyOrphanedTransferOnce(task: TransferTask, openTabKeys: ReadonlySet<string>): void {
  if (notifiedIds.has(task.id)) return
  if (!isOrphanedTransfer(task, openTabKeys)) return
  notifiedIds.add(task.id)
  if (task.phase === 'done') {
    uiFeedback.message.success(tr('"{{name}}" 传输完成', { name: task.name }))
  } else if (task.phase === 'failed') {
    uiFeedback.message.error(tr('"{{name}}" 传输失败：{{reason}}', { name: task.name, reason: task.reason ?? '' }))
  } else if (task.phase === 'aborted') {
    uiFeedback.message.warning(tr('"{{name}}" 传输已终止：{{reason}}', { name: task.name, reason: task.reason ?? '' }))
  }
}

/** 测试/会话切换场景重置通知去重（正常流程无需调用） */
export function resetTransferNotifications(): void {
  notifiedIds.clear()
}
