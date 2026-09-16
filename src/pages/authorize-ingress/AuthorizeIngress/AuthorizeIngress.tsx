/**
 * 软件授权页（P02，会话内覆盖层视图：登录会话内 1001000 挂起时由守卫/
 * SessionHost 转入本页，身份保留；也可在会话内直访）。
 *
 * 源实现 AuthorizeIngress/index.tsx @ e570b8df，本卡迁移差异：
 * - 深蓝科技风自包含视觉（源即独立暗色设计，不随全局主题切换）保留，
 *   局部 ConfigProvider darkAlgorithm 仅作用于本页卡片控件（源行为）；
 * - 激活提交接入 T011 写入任务（会话级动作 tabKey=null，零自动重发，
 *   结果未知转待确认不伪装成功）；
 * - 激活成功不再跳暂缓的调度监控（SPEC P02 修正）：调 T015 恢复接口
 *   `resumeAfterSoftwareAuthorizationActivated()`，按结论分流——resumed
 *   进入首个有权且本轮已实现的业务页；still-unauthorized/unreachable 留页
 *   重试；session-expired 由 SessionHost 收敛回登录页；
 * - 「返回登录」由源裸跳 /login 升级为 T017 统一受保护退出（含草稿/写入
 *   确认），避免遗留半会话。
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { App, Button, ConfigProvider, Input, theme as antdTheme } from 'antd'
import { Copy, KeyRound } from 'lucide-react'
import { usePageQuery } from '@/hooks/page-query'
import { useAuth } from '@/hooks/useAuth'
import { apiErrorMessage } from '@/services/request/request'
import { submitWriteTask } from '@/services/session-tasks'
import { resumeAfterSoftwareAuthorizationActivated } from '@/services/auth/invalidationOrchestrator'
import { resolveFirstAccessiblePath } from '@/router/firstAccessible'
import {
  getHardwareInfo,
  softwareActivation,
} from '@/services/system-involve/software-information/software-information.service'
import { copyTextToClipboard } from '@/utils/clipboard'
import { useProtectedLogout } from '@/features/auth/hooks/useProtectedLogout'
import styles from './AuthorizeIngress.module.css'

/** 激活动作标识（写入任务记录用；跨语言展示由页面重译） */
const ACTIVATE_ACTION_KEY = 'software.activate'

export default function AuthorizeIngress() {
  const { t } = useTranslation('auth')
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { identity } = useAuth()
  const protectedLogout = useProtectedLogout()

  /* 硬件码查询（挂载一次；覆盖层视图无常驻 scope，按常驻可见处理） */
  const hardwareQuery = usePageQuery({
    fetcher: (_params, { signal }) => getHardwareInfo({ signal }),
    params: {},
  })
  const hardwareId = typeof hardwareQuery.data === 'string' ? hardwareQuery.data : ''

  /* 激活码输入与提交状态；待确认提示（结果未知时内联展示，不伪装成败） */
  const [activationCode, setActivationCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState(false)

  /* 硬件码查询失败提示（对齐源 message.error；error 对象变化才提示一次） */
  useEffect(() => {
    if (!hardwareQuery.error) return
    const text = apiErrorMessage(hardwareQuery.error)
    void message.error(`${t('查询硬件信息出错')}${text}`)
  }, [hardwareQuery.error, message, t])

  /* 激活明确成功后的恢复编排（写入任务 onSuccess 回调，仅成功且纪元一致时进入） */
  const handleActivationSuccess = async () => {
    const outcome = await resumeAfterSoftwareAuthorizationActivated()
    if (outcome === 'resumed') {
      // 恢复通过：进入首个有权且本轮已实现的业务页（SPEC P02，不跳暂缓监控）
      void message.success(t('激活成功'))
      if (identity !== null) {
        navigate(resolveFirstAccessiblePath(identity), { replace: true })
      }
      return
    }
    if (outcome === 'still-unauthorized') {
      // 后端重查仍报未授权：激活未生效，留在本页可重试
      void message.warning(t('激活未生效，请核对激活码后重试'))
      return
    }
    if (outcome === 'unreachable') {
      // 核查不可达（后端 detail 异常等）：保持挂起，稍后可重试
      void message.warning(t('暂时无法核实激活结果，请稍后重试'))
      return
    }
    // session-expired：失效编排已收敛，SessionHost 自动回登录页，无需本地导航
  }

  /* 提交激活：经写入任务控制器（tabKey=null 会话级动作），零自动重发 */
  const handleActivate = () => {
    const code = activationCode.trim()
    if (!code || submitting) return
    setSubmitting(true)
    setPendingConfirm(false)
    const handle = submitWriteTask({
      tabKey: null,
      actionKey: ACTIVATE_ACTION_KEY,
      detail: t('提交软件激活'),
      run: (ctx) => softwareActivation({ activationCode: code }, { signal: ctx.signal }),
      onSuccess: () => {
        void handleActivationSuccess()
      },
    })
    void handle.settled.then((record) => {
      // 记录为 null：被会话复位/离开确认清除，宿主已收敛，本页状态照常复位
      if (record === null) {
        setSubmitting(false)
        return
      }
      if (record.status === 'success') {
        setActivationCode('')
      } else if (record.status === 'failed') {
        // 后端明确拒绝（如 1001020 激活失败）：保留后端原文提示（源行为）
        const text = record.error ? apiErrorMessage(record.error) : ''
        void message.warning(text || t('激活失败'))
      } else if (record.status === 'unknown') {
        // 结果未知（超时/网络中断/停止等待）：转待确认，不伪装成败
        setPendingConfirm(true)
        void message.warning(t('激活结果待确认，请稍后重试'))
      }
      setSubmitting(false)
    })
  }

  /* 复制硬件码（内网 http 部署经 execCommand 降级，见 utils/clipboard） */
  const handleCopyHardwareId = () => {
    if (!hardwareId) return
    if (copyTextToClipboard(hardwareId)) {
      void message.success(t('复制成功'))
    }
  }

  return (
    <div className={styles.auth}>
      {/* 装饰性背景水印，纯展示 */}
      <div className={styles.watermark}>LICENSE</div>
      {/*
       * 深色主题：本页为会话内覆盖层（隐藏外壳），局部使用 darkAlgorithm 让
       * 输入框/按钮融入深色卡片，colorPrimary 覆盖为青蓝色统一聚焦态描边
       */}
      <ConfigProvider
        theme={{
          algorithm: antdTheme.darkAlgorithm,
          token: {
            colorPrimary: '#35c8ff',
            colorInfo: '#35c8ff',
            borderRadius: 2,
          },
        }}
      >
        <div className={styles.card}>
          <div className={styles.emblem}>
            <KeyRound size={30} />
          </div>
          {/* 标题行：两侧翼形装饰线 + 辉光标题 + 英文小标题 */}
          <div className={styles.titleRow}>
            <span className={`${styles.wing} ${styles.wingLeft}`} />
            <h2 className={styles.title}>{t('软件授权')}</h2>
            <span className={`${styles.wing} ${styles.wingRight}`} />
          </div>
          <p className={styles.titleEn}>SOFTWARE LICENSE ACTIVATION</p>
          <p className={styles.subtitle}>
            {t('系统尚未激活，请将硬件码提供给管理员以获取激活码')}
          </p>

          <div className={styles.fieldLabel}>
            <span>{t('硬件码')}</span>
            <span className={styles.copyBtn} onClick={handleCopyHardwareId}>
              <Copy size={13} style={{ marginRight: 4 }} />
              {t('复制')}
            </span>
          </div>
          <div className={styles.hardwareId}>{hardwareId || '—'}</div>

          <Input.TextArea
            showCount
            allowClear
            placeholder={t('请输入激活码')}
            value={activationCode}
            autoSize={{ minRows: 4, maxRows: 8 }}
            onChange={(event) => setActivationCode(event.target.value)}
          />

          {/* 结果待确认：内联提示，保留重试入口，不伪装成功/失败 */}
          {pendingConfirm && (
            <p className={styles.pendingNotice}>{t('激活结果待确认，请稍后重试')}</p>
          )}

          <div className={styles.actions}>
            <Button className={styles.backBtn} onClick={() => void protectedLogout()}>
              {t('返回登录')}
            </Button>
            <Button
              type="primary"
              className={styles.submitBtn}
              loading={submitting}
              disabled={!activationCode.trim()}
              onClick={handleActivate}
            >
              {t('激活授权')}
            </Button>
          </div>
        </div>
      </ConfigProvider>
    </div>
  )
}
