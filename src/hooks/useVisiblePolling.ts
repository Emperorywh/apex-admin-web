/**
 * 可见串行轮询 hook（T00.6，规格 8.2 / D14）：实时页面的唯一刷新调度入口。
 *
 * 行为契约：
 * - 仅在「工作区页签激活（Activity visible）且浏览器文档可见」时刷新；
 *   后台页签暂停轮询并保留最后一次快照，不清空数据
 * - 串行：一次请求完成后约 5 秒（POLL_BASE_INTERVAL_MS）才发起下一次，
 *   永不并发堆积；间隔从完成时刻起算，而非固定节拍
 * - 重新可见 / 重新激活立即刷新一次（恢复即查），随后恢复常规节奏
 * - 失败按倍率退避至上限（POLL_BACKOFF_MULTIPLIER / POLL_MAX_BACKOFF_MS）；
 *   成功后回到基础间隔
 * - 主动取消不是失败：页签关闭/淘汰/隐藏导致 scope 信号中止时静默停止，
 *   不退避、不报错（与请求层取消语义一致）
 * - 语言切换不改写业务值：refresh 引用经 ref 消费，切换语言不触发额外轮询，
 *   下一次到点的请求自然携带新 Accept-Language；依赖服务端语言的只读展示
 *   如需立即重查，由页面自行监听语言事件（DoD 12）
 *
 * 页面约定：refresh 必须是只读查询（ GET / 查询性质 POST ），内部把收到的
 * signal 传给请求层；写操作永不进入轮询。失败区域清理与错误展示由页面在
 * refresh 实现内按 DoD 6 处理（清对应远端区域、保留筛选与草稿）。
 */

import { useEffect, useRef, useState } from 'react'
import {
  POLL_BACKOFF_MULTIPLIER,
  POLL_BASE_INTERVAL_MS,
  POLL_MAX_BACKOFF_MS,
} from '@/constants/polling.constants'
import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'

export interface VisiblePollingOptions {
  /** 单次刷新动作；signal 为当前 scope 取消信号，务必传给请求层 */
  refresh: (signal: AbortSignal) => Promise<void>
  /** 关闭开关（如页面未进入实时模式）；默认 true */
  enabled?: boolean
}

/** 浏览器文档可见性（模块级单例订阅，避免每页各自挂 visibilitychange） */
function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}

export function useVisiblePolling({ refresh, enabled = true }: VisiblePollingOptions): void {
  const scope = useRequestScope()
  const documentVisible = useDocumentVisible()

  // refresh 经 ref 消费：页面每次渲染的内联闭包不会重启轮询循环，
  // 循环内取到的永远是最新的实现（拿到最新筛选条件由页面经闭包/ref 自理）
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  })

  const signal = scope?.signal
  const isActive = scope?.isActive ?? true

  useEffect(() => {
    // 无信号（无 scope，如登录页）或被禁用或处于后台：不调度，快照保留
    if (!enabled || !isActive || !documentVisible || signal === undefined) return

    let disposed = false
    let timer: number | undefined
    // 每轮间隔（失败退避期间的「上一轮间隔」）；成功立即回到基础间隔
    let nextDelay = POLL_BASE_INTERVAL_MS

    const tick = async (): Promise<void> => {
      try {
        // 串行核心：await 完成才调度下一轮；signal 中止时请求层拒绝且无副作用
        await refreshRef.current(signal)
        nextDelay = POLL_BASE_INTERVAL_MS
      } catch {
        // 主动取消（页签关闭/隐藏/刷新重建）：静默停止，不算失败、不退避
        if (disposed || signal.aborted) return
        nextDelay = Math.min(nextDelay * POLL_BACKOFF_MULTIPLIER, POLL_MAX_BACKOFF_MS)
      }
      if (disposed || signal.aborted) return
      timer = window.setTimeout(() => {
        void tick()
      }, nextDelay)
    }

    // 进入可见/激活状态立即刷新（恢复即查），之后按完成时刻 + 间隔串行推进
    void tick()

    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [enabled, isActive, documentVisible, signal])
}
