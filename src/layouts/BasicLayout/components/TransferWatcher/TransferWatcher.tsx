/**
 * 传输状态观察者（T00.6）：挂在 BasicLayout 的一次性桥组件（不渲染 UI）。
 *
 * 职责一：孤儿传输的终态提示——承载页签已被关闭（或不隶属任何页签）的传输
 * 完成/失败/终止时，以一次性消息告知结果。这是「状态追踪」的最小呈现，
 * 不是全局任务中心（规格 10.2 明确本期不新增）；页签仍在时的进度与结果
 * 由页面自身经 useTransfers 呈现，此处不重复打扰。
 *
 * 职责二：会话结束清用户数据（规格 5.3）——退出登录/会话失效/多窗口同步
 * 退出时，本机终止全部进行中的传输并清空历史记录；本地终止不代表服务端
 * 已撤销处理（aborted 语义，规格 10.4），提示文案已说明。
 */

import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAuth } from '@/hooks/useAuth'
import {
  abortAllTransfers,
  clearTransfers,
  getTransfers,
  notifyOrphanedTransferOnce,
  resetTransferNotifications,
  subscribeTransfers,
} from '@/services/transfer/transferManager'

export function TransferWatcher() {
  const { isAuthenticated } = useAuth()
  const tabs = useAppSelector((state) => state.tabs.tabs)
  const { i18n } = useTranslation()
  // 当前打开的页签 key 集合：孤儿判定用；useMemo 保持引用稳定，
  // 避免订阅 effect 因集合新引用而反复重建
  const openTabKeys = useMemo(() => new Set(tabs.map((tab) => tab.key)), [tabs])

  /* 终态提示：仅在会话有效时提示孤儿传输；登出过程中的批量终止不逐条打扰 */
  useEffect(() => {
    const check = () => {
      if (!isAuthenticated) return
      for (const task of getTransfers()) {
        if (task.finishedAt !== null) notifyOrphanedTransferOnce(task, openTabKeys)
      }
    }
    check()
    return subscribeTransfers(check)
  }, [isAuthenticated, openTabKeys])

  /* 会话结束：终止全部进行中的传输并清空记录（含终态残留） */
  useEffect(() => {
    if (isAuthenticated) return
    abortAllTransfers(i18n.t('登录已结束，传输已在本机终止'))
    clearTransfers()
    resetTransferNotifications()
  }, [isAuthenticated, i18n])

  /* 订阅/语言依赖变化时任务文案随语言更新（提示经 i18next 即时翻译，无需额外处理） */
  return null
}
