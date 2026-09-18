/**
 * 软件激活表单（可复用激活业务组件，P02 交付、P29 软件信息页复用）。
 *
 * 职责（规格 P02 专项）：
 * - 激活码输入 + 提交 POST /auth/license/softwareActivation（真实写接口）；
 * - 失败保留用户输入并按后端真实结果提示（不伪造成功、不自动重试）；
 * - 成功仅以后端 code=200 判定，回调 onActivated 由调用方决定后续导航
 *   （本组件不绑死跳转目标，P02 落点规则 / P29 原地刷新均适用）；
 * - 可选 onBack 渲染「返回登录」按钮（P02 独立页形态；P29 不传即不渲染）。
 *
 * 组件不感知硬件码展示（调用方自行布局），也不消费路由/会话状态，保持可复用。
 */

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Button, Input } from 'antd'
import { activateSoftware } from '@/services/license-activation/license.service'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import styles from '@/features/license-activation/components/ActivationForm/ActivationForm.module.css'

export interface ActivationFormProps {
  /** 激活成功（后端已确认）后的回调；导航/刷新决策归调用方 */
  onActivated: () => void
  /** 可选返回行为：传入时在操作区渲染「返回登录」按钮（P02 独立页使用） */
  onBack?: () => void
}

export function ActivationForm({ onActivated, onBack }: ActivationFormProps) {
  const { t } = useTranslation('license-activation')
  const { message } = App.useApp()
  // 激活码输入：失败时原样保留（DoD：失败保留输入），成功后由调用方导航离开
  const [activationCode, setActivationCode] = useState('')
  // 提交中状态：防重复提交（写操作不自动重试，规格 9）
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    const code = activationCode.trim()
    if (!code || submitting) return
    setSubmitting(true)
    try {
      await activateSoftware(code)
      // 真实成功反馈（A03）：仅后端 code=200 才到达此处
      void message.success(t('激活成功'))
      onActivated()
    } catch (error) {
      // 主动取消静默；真实失败提示后端信息，输入保留供修正后重试
      if (!isCancelledError(error)) {
        const text = apiErrorMessage(error)
        void message.error(text ? `${t('激活出错')}：${text}` : t('激活出错'))
      }
    } finally {
      setSubmitting(false)
    }
  }, [activationCode, submitting, message, t, onActivated])

  return (
    <div className={styles.form}>
      <Input.TextArea
        showCount
        allowClear
        maxLength={2000}
        placeholder={t('请输入激活码')}
        value={activationCode}
        autoSize={{ minRows: 4, maxRows: 8 }}
        onChange={(e) => setActivationCode(e.target.value)}
      />
      <div className={styles.actions}>
        {onBack && (
          <Button className={styles.backBtn} onClick={onBack} disabled={submitting}>
            {t('返回登录')}
          </Button>
        )}
        <Button
          type="primary"
          className={styles.submitBtn}
          loading={submitting}
          disabled={!activationCode.trim()}
          onClick={handleSubmit}
        >
          {t('激活授权')}
        </Button>
      </div>
    </div>
  )
}
