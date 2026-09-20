/**
 * 实时看板数据 hook（P34 私有；同一首页唯一一份数据与可见轮询，D29）。
 *
 * 行为契约（规格 8.2 / DoD 6/7 / D14/D15，旧 index.tsx 轮询机制等价升级）：
 * - 调度：唯一 useVisiblePolling 5 秒串行循环（页签激活 + 文档可见才刷新；
 *   隐藏暂停保留快照；恢复可见立即刷新；失败按倍率退避至上限）；
 * - 双区域并行：看板聚合（KPI/图表）与未关闭告警列表并行请求、独立成败——
 *   任一失败只清空自己对应的远端区域并置错误态，不以空列表/零 KPI 冒充成功；
 * - 页面级退避：任一区域真正失败时 refresh 抛错，交由轮询层统一退避重查
 *   （两区域同一节奏恢复；主动取消不抛错——切页/隐藏导致 scope 中止时静默停止）；
 * - 防乱序：串行循环天然不并发；页签关闭时请求随 scope 信号取消；
 * - 告警列表规模上限 100 条（服务层固定），持续时长每轮现算（当前时刻 − 发生时间）。
 */

import { useCallback, useState } from 'react'
import { getDashboardBoard } from '@/services/dashboard/dashboard.service'
import { pageOpenSystemAlarmRecords } from '@/services/dashboard/dashboard.service'
import type {
  DashboardBoardDto,
  SystemAlarmRecordDto,
} from '@/services/dashboard/dashboard.service.types'
import { buildRealtimeSnapshot, mapOpenAlertItem } from '@/features/dashboard/realtime'
import type { OpenAlertItem, RealtimeSnapshot } from '@/features/dashboard/realtime'
import { useVisiblePolling } from '@/hooks/useVisiblePolling'

/** 看板聚合 → 快照的包装（独立函数便于失败分支对照阅读） */
function toSnapshot(dto: DashboardBoardDto): RealtimeSnapshot {
  return buildRealtimeSnapshot(dto, Date.now())
}

/** 告警记录数组 → 列表项（持续时长统一按当前时刻现算） */
function toAlertItems(records: SystemAlarmRecordDto[]): OpenAlertItem[] {
  const now = Date.now()
  return records.map((record) => mapOpenAlertItem(record, now))
}

export interface RealtimeDashboardState {
  /** 看板快照；null = 尚未首次成功或已因失败清空（首载骨架 / 错误态由 error 区分） */
  snapshot: RealtimeSnapshot | null
  /** 未关闭告警列表；null = 尚未首次成功或已因失败清空 */
  alerts: OpenAlertItem[] | null
  /** 是否正在轮询刷新（仅首次加载展示骨架，后续轮询保留旧数据就地更新） */
  loading: boolean
  /** 看板聚合区域是否处于真实失败态（取消不算） */
  boardError: boolean
  /** 告警列表区域是否处于真实失败态（取消不算） */
  alertsError: boolean
}

export function useRealtimeDashboard(): RealtimeDashboardState {
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot | null>(null)
  const [alerts, setAlerts] = useState<OpenAlertItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [boardError, setBoardError] = useState(false)
  const [alertsError, setAlertsError] = useState(false)

  const refresh = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    try {
      // 双区域并行；Promise.allSettled 保证互不吞掉对方的成败
      const [boardResult, alertsResult] = await Promise.allSettled([
        getDashboardBoard({ days: 2 }, { signal }),
        pageOpenSystemAlarmRecords({ signal }),
      ])

      // 主动取消（页签关闭/隐藏/刷新重建）：静默返回，不清数据、不置错误、不算失败
      if (signal.aborted) return

      let failed = false

      if (boardResult.status === 'fulfilled') {
        setSnapshot(toSnapshot(boardResult.value))
        setBoardError(false)
      } else {
        // 真正失败：立即清空该请求对应的远端数据区域（DoD 6），错误态如实呈现
        setSnapshot(null)
        setBoardError(true)
        failed = true
      }

      if (alertsResult.status === 'fulfilled') {
        setAlerts(toAlertItems(alertsResult.value))
        setAlertsError(false)
      } else {
        setAlerts(null)
        setAlertsError(true)
        failed = true
      }

      // 任一区域失败 → 抛错触发轮询层退避（页面级同一节奏，恢复时两区域一起重查）
      if (failed) throw new Error('dashboard-region-failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useVisiblePolling({ refresh })

  return { snapshot, alerts, loading, boardError, alertsError }
}
