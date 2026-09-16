/**
 * 会话任务订阅 Hook（T011）：页面 UI 只经此处读取任务状态，不得绕过
 * store 直接持有任务句柄之外的内部结构（useSyncExternalStore 消费快照）。
 *
 * - useSessionTasksSnapshot()：全量快照（外壳徽标、离开保护协调器用）；
 * - useTabWriteTasks(tabKey) / useTabTransferTasks(tabKey)：按页签过滤，
 *   页面据此渲染本页任务与「结果待确认」记录（含对象/动作/提交时间）。
 */

import { useSyncExternalStore } from 'react'
import { useMemo } from 'react'
import type {
  SessionTasksSnapshot,
  TransferTaskRecord,
  WriteTaskRecord,
} from '@/services/session-tasks/sessionTask.types'
import {
  getSessionTasksSnapshot,
  subscribeSessionTasks,
} from '@/services/session-tasks/sessionTaskStore'

/** 全量会话任务快照；引用在无变化期间稳定 */
export function useSessionTasksSnapshot(): SessionTasksSnapshot {
  return useSyncExternalStore(subscribeSessionTasks, getSessionTasksSnapshot, getSessionTasksSnapshot)
}

/** 指定页签的写入任务（按提交时间倒序；快照本身已倒序） */
export function useTabWriteTasks(tabKey: string | null): readonly WriteTaskRecord[] {
  const snapshot = useSessionTasksSnapshot()
  return useMemo(
    () => snapshot.writes.filter((task) => task.tabKey === tabKey),
    [snapshot, tabKey],
  )
}

/** 指定页签的传输任务（含活动传输的进度/阶段反馈） */
export function useTabTransferTasks(tabKey: string | null): readonly TransferTaskRecord[] {
  const snapshot = useSessionTasksSnapshot()
  return useMemo(
    () => snapshot.transfers.filter((task) => task.tabKey === tabKey),
    [snapshot, tabKey],
  )
}

/** 是否存在活动传输（任一页签）——供关闭/退出保护的快速判定 */
export function useHasActiveTransfers(): boolean {
  const snapshot = useSessionTasksSnapshot()
  return snapshot.transfers.some((task) => task.status === 'active')
}
