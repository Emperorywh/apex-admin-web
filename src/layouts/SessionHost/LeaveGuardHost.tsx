/**
 * 离开保护宿主（T013）：挂在 SessionHost 稳定会话层（SessionTasksHost 旁），
 * 承担三件事——
 * 1. 渲染离开确认弹窗：消费离开协调器的待确认队列，按动作类型列出
 *    受影响对象、动作与执行中/待确认状态，说明停止等待不能撤销后端执行；
 * 2. 浏览器刷新/关闭守卫：会话内存在任一保护条件时挂载 beforeunload
 *    原生提示，无保护时卸载（§9.1 浏览器原生能力范围内保护）；
 * 3. 会话纪元复位：登录/登出/切账号/认证失效使 auth.epoch 递增时，
 *    清空页面会话（草稿/轻量状态）并丢弃未裁决的确认请求。
 */

import { useEffect, useMemo } from 'react'
import { Modal } from 'antd'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '@/hooks/useAppSelector'
import { findDefinitionByPath } from '@/router/definitions'
import { resolveObjectKey } from '@/router/objectTab'
import {
  getSessionTasksSnapshot,
  subscribeSessionTasks,
} from '@/services/session-tasks'
import {
  getLeaveConfirmsSnapshot,
  resetLeaveGuard,
  resolveLeaveConfirm,
  subscribeLeaveConfirms,
  syncBeforeUnloadGuard,
} from '@/services/page-session/leaveGuard'
import { resetPageSession } from '@/services/page-session/pageSessionStore'
import type {
  LeaveAction,
  LeaveConfirmRequest,
  TabProtection,
} from '@/services/page-session/pageSession.types'
import styles from '@/layouts/SessionHost/LeaveGuardHost.module.css'

/** 离开动作的弹窗标题与确认按钮文案（key 即中文文案，英文走 common 词条） */
const ACTION_TEXT: Record<LeaveAction, { title: string; okText: string }> = {
  close: { title: '关闭页签前请确认', okText: '停止等待并关闭' },
  refresh: { title: '刷新页签前请确认', okText: '停止等待并刷新' },
  'batch-close': { title: '批量关闭页签前请确认', okText: '停止等待并全部关闭' },
  logout: { title: '退出登录前请确认', okText: '停止等待并退出' },
}

export function LeaveGuardHost() {
  const { t } = useTranslation('common')
  const epoch = useAppSelector((state) => state.auth.epoch)

  /* 纪元变化：清页面会话 + 丢弃未裁决确认请求（挂载首跑以当前纪元为基线复位一次） */
  useEffect(() => {
    resetPageSession()
    resetLeaveGuard()
  }, [epoch])

  /* 待确认队列与保护状态变化时同步 beforeunload 守卫 */
  const confirmQueue = useSyncExternalStore(subscribeLeaveConfirms, getLeaveConfirmsSnapshot)
  const tasksSnapshot = useSyncExternalStore(subscribeSessionTasks, getSessionTasksSnapshot)
  useEffect(() => {
    syncBeforeUnloadGuard()
  }, [confirmQueue, tasksSnapshot])

  const pending = confirmQueue[0] ?? null

  /* 声明式渲染确认弹窗：不使用命令式 modal.confirm——StrictMode 下
     effect 双挂载会产生无法销毁的僵尸弹窗实例；队列空即卸载，由 React 保证清理 */
  if (pending === null) return null
  return <LeaveConfirmModal request={pending} t={t} />
}

interface LeaveConfirmModalProps {
  request: LeaveConfirmRequest
  t: (key: string) => string
}

/** 单条离开确认弹窗；key=请求 id 由外层保证，队列逐条呈现且状态不复用 */
function LeaveConfirmModal({ request, t }: LeaveConfirmModalProps) {
  const { action, protections } = request
  const actionText = ACTION_TEXT[action]

  const content = useMemo(() => <ProtectionList protections={protections} t={t} />, [protections, t])

  return (
    <Modal
      open
      title={t(actionText.title)}
      width={560}
      okText={t(actionText.okText)}
      okButtonProps={{ danger: true }}
      cancelText={t('留在当前页')}
      onOk={() => resolveLeaveConfirm(request.id, true)}
      onCancel={() => resolveLeaveConfirm(request.id, false)}
    >
      {content}
    </Modal>
  )
}

/** 保护明细：按页签分组列出草稿与写入/传输任务（对象、动作、执行中/待确认） */
function ProtectionList({
  protections,
  t,
}: {
  protections: readonly TabProtection[]
  t: (key: string) => string
}) {
  return (
    <div className={styles.list}>
      <p className={styles.warning}>
        {t('停止等待不能撤销后端执行；结果未知时请稍后在来源页核查，系统不会自动重发。')}
      </p>
      {protections.map((protection) => (
        <ProtectionGroup key={protection.tabKey ?? '__session__'} protection={protection} t={t} />
      ))}
    </div>
  )
}

function ProtectionGroup({
  protection,
  t,
}: {
  protection: TabProtection
  t: (key: string) => string
}) {
  /* 会话级任务（tabKey=null）不隶属页签，单独成组 */
  const meta =
    protection.tabKey === null
      ? null
      : (findDefinitionByPath(tabKeyPathname(protection.tabKey))?.meta ?? null)
  const objectKey =
    meta?.objectParam !== undefined && protection.tabKey !== null
      ? resolveObjectKey(tabKeySearch(protection.tabKey), meta.objectParam)
      : null
  const title =
    protection.tabKey === null
      ? t('会话级任务（不隶属页签）')
      : `${t(meta?.title ?? protection.tabKey)}${objectKey ? ` · ${objectKey}` : ''}`

  return (
    <div className={styles.group}>
      <div className={styles.groupTitle}>{title}</div>
      <ul className={styles.items}>
        {protection.drafts.map((draft) => (
          <li key={`draft:${draft.draftKey}`}>
            <span className={styles.badge}>{t('草稿')}</span>
            {draft.label}
          </li>
        ))}
        {protection.writes.map((record) => (
          <li key={record.id}>
            <span className={styles.badge}>
              {record.status === 'unknown' ? t('待确认') : t('执行中')}
            </span>
            {record.detail}
          </li>
        ))}
        {protection.transfers.map((record) => (
          <li key={record.id}>
            <span className={styles.badge}>
              {record.status === 'active' ? t('传输中') : t('待确认')}
            </span>
            {record.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 页签 key（路径 + 规范 search）取路径部分 */
function tabKeyPathname(tabKey: string): string {
  return tabKey.split('?')[0] || tabKey
}

/** 页签 key 取 search 部分（含 ?；无参数返回空串） */
function tabKeySearch(tabKey: string): string {
  const index = tabKey.indexOf('?')
  return index < 0 ? '' : tabKey.slice(index)
}
