/**
 * 登录表单：用户名 + 密码，成功后按激活状态与 redirect 参数分流（SPEC P01）。
 * - activated === false（严格判定，源行为）→ 进入软件授权页；
 * - 其余按 redirect 回跳首个目标（有权入口选择归 T007 路由宿主）。
 */

import { App, Button, Form, Input } from 'antd'
import { Lock, UserRound } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LOGIN_REDIRECT_QUERY_KEY } from '@/constants/auth/auth.constants'
import { ROUTE_PATHS } from '@/router/definitions'
import { resolveFirstAccessiblePath } from '@/router/firstAccessible'
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
      const snapshot = await submit(values)
      // 源判定：仅 activated === false 进入授权流程；字段缺失视为已激活
      if (snapshot.activated === false) {
        navigate(ROUTE_PATHS['authorize-ingress'], { replace: true })
        return
      }
      const redirect = searchParams.get(LOGIN_REDIRECT_QUERY_KEY)
      // 无有效回跳时解析首个有权且本轮已实现的业务页（跳过暂缓模块，SPEC §4）
      navigate(
        redirect && redirect.startsWith('/') ? redirect : resolveFirstAccessiblePath(snapshot),
        { replace: true },
      )
    } catch (error) {
      const text = apiErrorMessage(error)
      void message.error(text || t('登录失败，请稍后重试'))
    }
  }

  return (
    <Form<LoginFormValues> layout="vertical" requiredMark={false} onFinish={handleFinish}>
      {/* 源登录表单仅做必填校验，无用户名长度约束（长度边界属用户管理表单规则） */}
      <Form.Item
        name="username"
        label={t('用户名')}
        rules={[{ required: true, message: t('请输入用户名') }]}
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
    </Form>
  )
}
