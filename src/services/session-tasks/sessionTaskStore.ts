/**
 * 会话任务 store：写入与文件传输记录的唯一容器（T011）。
 *
 * - 记录挂在稳定会话层（SessionHost 挂载 SessionTasksHost），不进 redux：
 *   页签缓存宿主、页签关闭/淘汰都不影响任务回执；UI 仅通过订阅读取；
 * - 快照不可变：任何记录新增/更新/移除都生成新数组与新快照对象，
 *   保证 useSyncExternalStore 的引用一致性；
 * - 会话纪元变化（登录/登出/切账号）由 SessionTasksHost 调用
 *   resetSessionTasks() 清空全部记录——旧会话任务不流入新账号（§6.3）。
 */

import type {
  SessionTasksSnapshot,
  TransferTaskRecord,
  WriteTaskRecord,
} from '@/services/session-tasks/sessionTask.types'

interface SessionTaskState {
  writes: WriteTaskRecord[]
  transfers: TransferTaskRecord[]
}

const state: SessionTaskState = {
  writes: [],
  transfers: [],
}

/** 当前快照缓存：仅在记录变化时重建，保证订阅方拿到的引用稳定 */
let snapshot: SessionTasksSnapshot = { writes: state.writes, transfers: state.transfers }

type SessionTasksListener = () => void

const listeners = new Set<SessionTasksListener>()

/** 订阅会话任务变化；返回取消订阅函数（页面 Hook 与离开保护协调器共用） */
export function subscribeSessionTasks(listener: SessionTasksListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 读取当前快照；引用在无变化期间恒定（useSyncExternalStore 约束） */
export function getSessionTasksSnapshot(): SessionTasksSnapshot {
  return snapshot
}

/** 记录变化后同步重建快照并通知订阅方；notify 本身无节流（变更频率已由引擎节流） */
function commit(): void {
  snapshot = { writes: [...state.writes], transfers: [...state.transfers] }
  for (const listener of listeners) listener()
}

/* -------------------------------------------------------------------------- */
/* 任务 ID：单调递增 + 时间戳，仅前端追溯用，绝不进入业务请求                     */
/* -------------------------------------------------------------------------- */

let taskSequence = 0

export function nextSessionTaskId(prefix: string): string {
  taskSequence += 1
  return `${prefix}-${Date.now().toString(36)}-${taskSequence}`
}

/* -------------------------------------------------------------------------- */
/* 写入记录维护                                                                */
/* -------------------------------------------------------------------------- */

export function addWriteRecord(record: WriteTaskRecord): void {
  state.writes = [record, ...state.writes]
  commit()
}

/**
 * 按 id 更新写入记录；record 不存在（已被清除/复位）时静默忽略——
 * 迟到回执不得复活已清除的记录（§6.3 结果未知处理）。
 */
export function updateWriteRecord(id: string, patch: Partial<WriteTaskRecord>): void {
  const index = state.writes.findIndex((item) => item.id === id)
  if (index < 0) return
  const next = [...state.writes]
  next[index] = { ...next[index], ...patch }
  state.writes = next
  commit()
}

/** 移除写入记录（离开确认后清记录、旧纪元记录丢弃） */
export function removeWriteRecord(id: string): void {
  if (!state.writes.some((item) => item.id === id)) return
  state.writes = state.writes.filter((item) => item.id !== id)
  commit()
}

export function getWriteRecord(id: string): WriteTaskRecord | undefined {
  return state.writes.find((item) => item.id === id)
}

/* -------------------------------------------------------------------------- */
/* 传输记录维护                                                                */
/* -------------------------------------------------------------------------- */

export function addTransferRecord(record: TransferTaskRecord): void {
  state.transfers = [record, ...state.transfers]
  commit()
}

/**
 * 按 id 更新传输记录；记录不存在时静默忽略（与写入同理，防迟到回执复活）。
 * 进度推进使用函数式 patch，引擎闭包内直接读取最新值。
 */
export function updateTransferRecord(
  id: string,
  patch: Partial<TransferTaskRecord> | ((current: TransferTaskRecord) => Partial<TransferTaskRecord>),
): void {
  const index = state.transfers.findIndex((item) => item.id === id)
  if (index < 0) return
  const current = state.transfers[index]
  const resolved = typeof patch === 'function' ? patch(current) : patch
  const next = [...state.transfers]
  next[index] = { ...current, ...resolved }
  state.transfers = next
  commit()
}

export function getTransferRecord(id: string): TransferTaskRecord | undefined {
  return state.transfers.find((item) => item.id === id)
}

/** 移除传输记录 */
export function removeTransferRecord(id: string): void {
  if (!state.transfers.some((item) => item.id === id)) return
  state.transfers = state.transfers.filter((item) => item.id !== id)
  commit()
}

/* -------------------------------------------------------------------------- */
/* 会话复位                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 清空全部任务记录（会话纪元变化时由 SessionTasksHost 调用）。
 * 不主动中止在途请求——认证失效编排（T015）通过各控制器的
 * cancel/stop API 显式处理；本函数只保证旧记录不流入新会话。
 */
export function resetSessionTasks(): void {
  if (state.writes.length === 0 && state.transfers.length === 0) return
  state.writes = []
  state.transfers = []
  commit()
}
