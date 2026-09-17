/**
 * 传输任务订阅 hook（T00.6）：把模块级传输管理器的状态接入 React 渲染。
 *
 * - useSyncExternalStore 订阅；快照引用稳定性由管理器保证（notify 时才重建）
 * - 可选按页签过滤：页面传自己的 tabKey 只看到本页传输；不传参返回全部
 *   （关闭确认等一次性查询请用 findActiveTransfersIn，无需订阅）
 */

import { useSyncExternalStore } from 'react'
import { getTransfers, subscribeTransfers } from '@/services/transfer/transferManager'
import type { TransferTask } from '@/services/transfer/transfer.types'

/**
 * 订阅传输任务列表。
 * @param tabKey 可选页签 key 过滤；undefined 返回全部任务
 */
export function useTransfers(tabKey?: string | null): TransferTask[] {
  const tasks = useSyncExternalStore(subscribeTransfers, getTransfers, getTransfers)
  // 传输是文件操作级低频事件，渲染期直接过滤不会成为热点
  return tabKey === undefined ? tasks : tasks.filter((task) => task.tabKey === tabKey)
}
