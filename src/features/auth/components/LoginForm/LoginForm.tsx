/**
 * 登录表单（纯前端模式）：用户名/密码校验、登录中状态与回跳目标展示。
 * 提交经 useLogin 走本地登录状态机（写入 token/权限快照 → 导航意图），任意账号密码均可登录；
 * 本地登录不会失败，行内 Alert 仅作意外异常的兜底展示。
 */
import { useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import { Lock, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
    } catch {
      // 纯前端模式登录不会失败；兜底文案仅防御意外异常
      setErrorText(t('登录失败，请稍后重试'))
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
