/**
 * 登录表单（规格 §14.2）：用户名/密码校验、登录中状态与回跳目标展示。
 * 提交经 useLogin 走认证会话登录状态机（auth.service.login → token/epoch → profile → 导航意图）；
 * 登录请求为 silent（规格 §7.2/§6.3），失败文案由本表单以行内 Alert 呈现，避免全局提示重复。
 */
import { useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import { Lock, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { API_ERROR_FALLBACK_TEXT, getApiErrorText } from '@/i18n/errorTexts'
import { isApiError } from '@/services/request/envelope'
import { useLogin, type LoginSubmitValues } from '@/features/auth/hooks/useLogin'
import styles from './LoginForm.module.css'

/** 表单值：字段名与 LoginSubmitValues 一致 */
type LoginFormValues = LoginSubmitValues

export function LoginForm() {
  const { t } = useTranslation()
  const { submitting, redirectTarget, submit } = useLogin()
  const [errorText, setErrorText] = useState<string | null>(null)

  const handleFinish = async (values: LoginFormValues) => {
    setErrorText(null)
    try {
      await submit(values)
    } catch (error) {
      // 已知 errorCode 映射为本地化文案；未知错误显示固定兜底文案（规格 §7.4-3）
      const errorCode = isApiError(error) ? error.errorCode : undefined
      setErrorText(errorCode !== undefined ? getApiErrorText(errorCode) : t(API_ERROR_FALLBACK_TEXT))
    }
  }

  return (
    <Form<LoginFormValues> layout="vertical" onFinish={handleFinish} autoComplete="off" requiredMark={false}>
      {errorText !== null && (
        <Form.Item>
          <Alert type="error" showIcon message={errorText} />
        </Form.Item>
      )}
      <Form.Item
        name="username"
        rules={[{ required: true, whitespace: true, message: t('请输入用户名') }]}
      >
        <Input prefix={<UserRound size={16} />} placeholder={t('用户名')} autoComplete="username" allowClear />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[{ required: true, message: t('请输入密码') }]}
      >
        <Input.Password prefix={<Lock size={16} />} placeholder={t('密码')} autoComplete="current-password" />
      </Form.Item>
      {redirectTarget !== null && (
        <div className={styles.redirectHint}>
          {t('登录后将前往')}：<code>{redirectTarget}</code>
        </div>
      )}
      <Button type="primary" htmlType="submit" block loading={submitting}>
        {t('登录')}
      </Button>
    </Form>
  )
}
