/**
 * 用户创建/编辑表单（纯前端模式）：
 * - 创建：username（创建后不可改）+ password（12-128 位）+ displayName（必填）
 *   + email?/phone?（选填）；创建后固定 active，状态变更走列表启停用操作。
 * - 编辑：仅 displayName/email?/phone?；username 以禁用态回显，密码与角色不在本表单。
 * 校验规则与 auth.constants / user.constants 同源；提交载荷由页面在内存用户集合中落地。
 */
import { useState } from 'react'
import { Alert, Button, Form, Input, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from '@/constants/auth/auth.constants'
import { USER_EMAIL_PATTERN, USER_I18N_NAMESPACE } from '@/constants/system/user/user.constants'
import type { User } from '@/types/system/user/user.types'
import type { UserFormMode, UserFormSubmitPayload, UserFormValues } from './UserForm.types'
import { toUserFormValues } from './UserForm.types'

export interface UserFormProps {
  mode: UserFormMode
  /** 编辑目标用户；创建模式忽略 */
  user: User | null
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：表单校验通过后按模式给出写入载荷；页面保证落地成功（失败路径仅兜底提示） */
  onSubmit: (payload: UserFormSubmitPayload) => Promise<void>
  onCancel: () => void
}

/** 密码策略提示：长度插值来自密码常量，与校验正则同一权威来源 */
function passwordRuleText(t: ReturnType<typeof useTranslation>['t']): string {
  return t('密码长度需在 {{min}}-{{max}} 位之间', { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
}

export function UserForm({ mode, user, submitting, onSubmit, onCancel }: UserFormProps) {
  const { t } = useTranslation(USER_I18N_NAMESPACE)
  const { token } = theme.useToken()
  const [form] = Form.useForm<UserFormValues>()
  const [pageError, setPageError] = useState<string | null>(null)

  const initialValues: UserFormValues =
    mode === 'edit' && user !== null
      ? toUserFormValues(user)
      : { username: '', password: '', displayName: '', email: '', phone: '' }

  const handleFinish = async (values: UserFormValues): Promise<void> => {
    setPageError(null)
    // email/phone 去空白，空串按可选字段省略
    const trimmedEmail = values.email.trim()
    const optionalEmail = trimmedEmail.length > 0 ? { email: trimmedEmail } : {}
    const trimmedPhone = values.phone.trim()
    const optionalPhone = trimmedPhone.length > 0 ? { phone: trimmedPhone } : {}
    const payload: UserFormSubmitPayload =
      mode === 'create'
        ? {
            mode: 'create',
            draft: {
              username: values.username.trim(),
              password: values.password,
              displayName: values.displayName.trim(),
              ...optionalEmail,
              ...optionalPhone,
            },
          }
        : {
            mode: 'edit',
            draft: {
              displayName: values.displayName.trim(),
              ...optionalEmail,
              ...optionalPhone,
            },
          }
    try {
      await onSubmit(payload)
    } catch {
      // 纯前端模式页面落地不失败；兜底提示防御未来接入异步数据源时的未映射错误
      setPageError(t('保存失败，请稍后重试'))
    }
  }

  return (
    <Form<UserFormValues>
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={(values) => void handleFinish(values)}
      autoComplete="off"
      requiredMark={false}
    >
      {pageError !== null && (
        <Form.Item>
          <Alert type="error" showIcon message={pageError} />
        </Form.Item>
      )}
      {mode === 'create' ? (
        <Form.Item
          name="username"
          label={t('用户名')}
          rules={[{ required: true, whitespace: true, message: t('请输入用户名') }]}
        >
          <Input placeholder={t('请输入用户名')} allowClear />
        </Form.Item>
      ) : (
        // 用户名创建后不可修改：编辑模式仅禁用态回显，不作为表单项提交
        <Form.Item label={t('用户名')}>
          <Input value={user?.username ?? ''} disabled />
        </Form.Item>
      )}
      {mode === 'create' && (
        <Form.Item
          name="password"
          label={t('密码')}
          rules={[
            { required: true, message: t('请输入密码') },
            { pattern: PASSWORD_PATTERN, message: passwordRuleText(t) },
          ]}
        >
          <Input.Password placeholder={passwordRuleText(t)} autoComplete="new-password" />
        </Form.Item>
      )}
      <Form.Item
        name="displayName"
        label={t('显示名称')}
        rules={[{ required: true, whitespace: true, message: t('请输入显示名称') }]}
      >
        <Input placeholder={t('请输入显示名称')} allowClear />
      </Form.Item>
      <Form.Item
        name="email"
        label={t('邮箱')}
        rules={[
          {
            // 与提交载荷一致：先 trim 再做格式校验（选填字段空值放行）
            validator: (_rule, value: string) =>
              value === undefined || value.trim().length === 0 || USER_EMAIL_PATTERN.test(value.trim())
                ? Promise.resolve()
                : Promise.reject(new Error(t('邮箱格式不正确'))),
          },
        ]}
      >
        <Input placeholder={t('选填')} allowClear />
      </Form.Item>
      <Form.Item name="phone" label={t('手机号')}>
        <Input placeholder={t('选填')} allowClear />
      </Form.Item>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginSM }}>
        <Button onClick={onCancel}>{t('取消')}</Button>
        <Button type="primary" htmlType="submit" loading={submitting}>
          {t('保存')}
        </Button>
      </div>
    </Form>
  )
}
