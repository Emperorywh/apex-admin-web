/**
 * 登录表单：用户名 + 密码，成功后按 redirect 参数回跳。
 * 后端未接入期间登录直通，密码仅做必填校验。
 */

import { App, Button, Form, Input } from 'antd'
import { Lock, UserRound } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, LOGIN_REDIRECT_QUERY_KEY } from '@/constants/auth/auth.constants'
import { FALLBACK_PATH } from '@/constants/route.constants'
import { useLogin } from '@/features/auth/hooks/useLogin'
import { apiErrorMessage } from '@/services/request/request'
import styles from '@/features/auth/components/LoginForm/LoginForm.module.css'

interface LoginFormValues {
  username: string
  password: string
}

export function LoginForm() {
  const { t } = useTranslation('auth')
  const { t: tCommon } = useTranslation('common')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { submitting, submit } = useLogin()
  const { message } = App.useApp()

  const handleFinish = async (values: LoginFormValues) => {
    try {
      await submit(values)
      const redirect = searchParams.get(LOGIN_REDIRECT_QUERY_KEY)
      navigate(redirect && redirect.startsWith('/') ? redirect : FALLBACK_PATH, { replace: true })
    } catch (error) {
      const text = apiErrorMessage(error)
      void message.error(text || t('登录失败，请稍后重试'))
    }
  }

  return (
    <Form<LoginFormValues> layout="vertical" requiredMark={false} onFinish={handleFinish}>
      <Form.Item
        name="username"
        label={t('用户名')}
        rules={[
          { required: true, message: t('请输入用户名') },
          { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH, message: t('用户名长度需在 2-32 个字符之间') },
        ]}
      >
        <Input size="large" prefix={<UserRound size={16} />} placeholder={t('用户名')} autoComplete="username" />
      </Form.Item>
      <Form.Item
        name="password"
        label={t('密码')}
        rules={[{ required: true, message: t('请输入密码') }]}
      >
        <Input.Password size="large" prefix={<Lock size={16} />} placeholder={t('密码')} autoComplete="current-password" />
      </Form.Item>
      <Button type="primary" size="large" htmlType="submit" block loading={submitting} className={styles.submit}>
        {tCommon('登录')}
      </Button>
      <p className={styles.hint}>{t('演示模式：任意账号密码均可登录')}</p>
    </Form>
  )
}
