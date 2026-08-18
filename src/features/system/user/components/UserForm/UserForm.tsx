/**
 * 用户创建/编辑表单（对齐真实后端写入契约，后端请求体 extra="forbid"）：
 * - 创建：username（创建后不可改）+ password（12-128 位）+ displayName（必填）
 *   + email?/phone?（选填）；创建后固定 active，状态变更走列表启停用操作。
 * - 编辑：仅 displayName/email?/phone?；username 以禁用态回显，密码与角色走独立接口。
 * - VALIDATION.FAILED.errors 字段映射（规格 §14.4）：已知字段写入对应表单项错误，
 *   未知字段和非校验类错误显示为表单上方的页面级 Alert；
 *   提交请求由页面以 silent 发出，错误呈现全部由本表单承担（避免与全局提示重复）。
 */
import { useState } from 'react'
import { Alert, Button, Form, Input, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from '@/constants/auth/auth.constants'
import { USER_EMAIL_PATTERN, USER_I18N_NAMESPACE } from '@/constants/system/user/user.constants'
import { getApiErrorText } from '@/i18n/errorTexts'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { isApiError } from '@/services/request/envelope'
import { parseValidationFieldIssues } from '@/utils/validationDetails'
import type { User } from '@/types/system/user/user.types'
import type { UserFormMode, UserFormSubmitPayload, UserFormValues } from './UserForm.types'
import { toUserFormValues } from './UserForm.types'

/** 各模式下可接收字段级错误的表单项（规格 §14.4：未知字段显示页面级错误；字段名为后端 camelCase 契约键） */
const KNOWN_FIELDS_BY_MODE: Record<UserFormMode, readonly (keyof UserFormValues)[]> = {
  create: ['username', 'password', 'displayName', 'email', 'phone'],
  edit: ['displayName', 'email', 'phone'],
}

export interface UserFormProps {
  mode: UserFormMode
  /** 编辑目标用户；创建模式忽略 */
  user: User | null
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：表单校验通过后按模式给出写入契约 DTO；抛出错误时由本表单映射呈现 */
  onSubmit: (payload: UserFormSubmitPayload) => Promise<void>
  onCancel: () => void
}

/** 密码策略提示：长度插值来自密码常量（后端 SPEC 23.2），与校验正则同一权威来源 */
function passwordRuleText(t: TFunction): string {
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
    // email/phone 去空白，空串按契约省略（后端可选字段）
    const trimmedEmail = values.email?.trim()
    const optionalEmail = trimmedEmail !== undefined && trimmedEmail.length > 0 ? { email: trimmedEmail } : {}
    const trimmedPhone = values.phone?.trim()
    const optionalPhone = trimmedPhone !== undefined && trimmedPhone.length > 0 ? { phone: trimmedPhone } : {}
    const payload: UserFormSubmitPayload =
      mode === 'create'
        ? {
            mode: 'create',
            dto: {
              username: values.username.trim(),
              password: values.password,
              displayName: values.displayName.trim(),
              ...optionalEmail,
              ...optionalPhone,
            },
          }
        : {
            mode: 'edit',
            dto: {
              displayName: values.displayName.trim(),
              ...optionalEmail,
              ...optionalPhone,
            },
          }
    try {
      await onSubmit(payload)
    } catch (error) {
      // VALIDATION.FAILED：已知字段映射到表单项，未知字段进页面级错误（规格 §14.4）
      if (isApiError(error) && error.errorCode === API_ERROR_CODES.VALIDATION_FAILED) {
        const issues = parseValidationFieldIssues(error.details) ?? []
        // 运行时以字符串判定成员关系，命中后窄化为表单键供 setFields 使用
        const knownFields = KNOWN_FIELDS_BY_MODE[mode] as readonly string[]
        const fieldErrors: Array<{ name: keyof UserFormValues; errors: string[] }> = []
        const unknownMessages: string[] = []
        for (const issue of issues) {
          if (knownFields.includes(issue.field)) {
            fieldErrors.push({ name: issue.field as keyof UserFormValues, errors: [issue.message] })
          } else {
            unknownMessages.push(`${issue.field}: ${issue.message}`)
          }
        }
        if (fieldErrors.length > 0) {
          form.setFields(fieldErrors)
        }
        if (unknownMessages.length > 0) {
          setPageError(unknownMessages.join('；'))
        }
        return
      }
      // 其余已知 errorCode 映射为前端 i18n 文案；未知错误显示固定兜底（规格 §7.4-3）；
      // 文案统一经 common 命名空间解析（errorTexts），与表单所在命名空间无关
      setPageError(getApiErrorText(isApiError(error) ? error.errorCode : undefined))
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
        // 用户名创建后不可修改（后端契约）：编辑模式仅禁用态回显，不作为表单项提交
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
