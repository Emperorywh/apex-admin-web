/**
 * 登录表单：用户名 + 密码，成功后按回跳参数或登录落点导航。
 * 会话由 useLogin 经真实登录接口构建（T00.3）；落点规则见 @/router/routeAccess：
 * 未激活 → 软件授权页；首页可用优先；否则首个有权限且已完成迁移的业务页；
 * 回跳仅接受站内、存在且当前可用的目标（规格 5.11 / D29）。
 */

import { App, Button, Form, Input } from 'antd'
import { Lock, UserRound } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, LOGIN_REDIRECT_QUERY_KEY } from '@/constants/auth/auth.constants'
import { useLogin } from '@/features/auth/hooks/useLogin'
import { apiErrorMessage } from '@/services/request/request'
import { resolveLandingPath, resolveSafeRedirectPath } from '@/router/routeAccess'
import { store } from '@/store/store'
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
      // 真实成功反馈（A03）：凭据正确按真实结果提示，不提前冒充成功
      void message.success(t('登录成功'))
      // sessionReady 已落库：直接读 store 最新会话（组件闭包中的旧快照不可靠）
      const auth = store.getState().auth
      // 深链接回跳校验：仅放行站内且有权限、已完成迁移的目标，否则落登录落点
      const safeRedirect = resolveSafeRedirectPath(
        searchParams.get(LOGIN_REDIRECT_QUERY_KEY),
        auth,
      )
      navigate(safeRedirect ?? resolveLandingPath(auth), { replace: true })
    } catch (error) {
      const text = apiErrorMessage(error)
      void message.error(text || t('登录失败，请稍后重试'))
    }
  }

  return (
    <Form<LoginFormValues>
      layout="horizontal"
      requiredMark={false}
      labelCol={{ span: 6 }}
      wrapperCol={{ span: 18 }}
      onFinish={handleFinish}
    >
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
    </Form>
  )
}
