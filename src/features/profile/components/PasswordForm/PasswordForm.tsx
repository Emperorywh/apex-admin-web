/**
 * 修改密码表单（规格 §14.2/§14.3）：oldPassword（必填）+ newPassword（必填，满足密码策略）
 * + confirmPassword（必填，须与新密码一致；仅前端校验项，不进入提交契约）。
 * 提交请求由页面以 silent 发出，错误呈现全部由本表单承担（规格 §14.4）：
 * VALIDATION_FAILED 已知字段写入表单项；旧密码错误（401 AUTH_INVALID_CREDENTIALS）
 * 映射到 oldPassword 表单项；其余已知 errorCode 与未知错误显示为页面级 Alert。
 * 提交成功后表单清空（onSubmit 未抛错即视为成功）。
 */
import { useState } from 'react'
import { Alert, Button, Form, Input, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from '@/constants/auth/auth.constants'
import { PROFILE_I18N_NAMESPACE } from '@/constants/profile/profile.constants'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { getApiErrorText } from '@/i18n/errorTexts'
import { isApiError } from '@/services/request/envelope'
import { parseValidationFieldIssues } from '@/utils/validationDetails'
import type { PasswordFormSubmitPayload, PasswordFormValues } from './PasswordForm.types'

/** 可接收字段级错误的表单项（规格 §14.4：未知字段显示页面级错误） */
const KNOWN_FIELDS: readonly string[] = ['oldPassword', 'newPassword']

export interface PasswordFormProps {
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：表单校验通过后给出修改密码契约 DTO；抛出错误时由本表单映射呈现 */
  onSubmit: (payload: PasswordFormSubmitPayload) => Promise<void>
}

export function PasswordForm({ submitting, onSubmit }: PasswordFormProps) {
  const { t } = useTranslation(PROFILE_I18N_NAMESPACE)
  const { token } = theme.useToken()
  const [form] = Form.useForm<PasswordFormValues>()
  const [pageError, setPageError] = useState<string | null>(null)

  const handleFinish = async (values: PasswordFormValues): Promise<void> => {
    setPageError(null)
    const payload: PasswordFormSubmitPayload = {
      oldPassword: values.oldPassword,
      newPassword: values.newPassword,
    }
    try {
      await onSubmit(payload)
      // 成功后清空表单（旧密码与新密码均不应残留输入态）
      form.resetFields()
    } catch (error) {
      // 旧密码错误：映射到 oldPassword 表单项（规格 §14.4 AUTH_INVALID_CREDENTIALS 语义）
      if (isApiError(error) && error.errorCode === API_ERROR_CODES.AUTH_INVALID_CREDENTIALS) {
        form.setFields([{ name: 'oldPassword', errors: [t('原密码不正确')] }])
        return
      }
      // VALIDATION_FAILED：已知字段映射到表单项，未知字段进页面级错误（规格 §14.4）
      if (isApiError(error) && error.errorCode === API_ERROR_CODES.VALIDATION_FAILED) {
        const issues = parseValidationFieldIssues(error.details) ?? []
        const fieldErrors: Array<{ name: keyof PasswordFormValues; errors: string[] }> = []
        const unknownMessages: string[] = []
        for (const issue of issues) {
          if (KNOWN_FIELDS.includes(issue.field)) {
            fieldErrors.push({ name: issue.field as keyof PasswordFormValues, errors: [issue.message] })
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
      // 其余已知 errorCode 映射为前端 i18n 文案；未知错误显示固定兜底（规格 §7.4-3）
      setPageError(getApiErrorText(isApiError(error) ? error.errorCode : undefined))
    }
  }

  return (
    <Form<PasswordFormValues>
      form={form}
      layout="vertical"
      onFinish={(values) => void handleFinish(values)}
      autoComplete="off"
      requiredMark={false}
    >
      {pageError !== null && (
        <Form.Item>
          <Alert type="error" showIcon message={pageError} />
        </Form.Item>
      )}
      <Form.Item
        name="oldPassword"
        label={t('原密码')}
        rules={[{ required: true, message: t('请输入原密码') }]}
      >
        <Input.Password placeholder={t('请输入原密码')} autoComplete="current-password" />
      </Form.Item>
      <Form.Item
        name="newPassword"
        label={t('新密码')}
        rules={[
          { required: true, message: t('请输入新密码') },
          // 密码策略与创建用户同一权威来源（规格 §14.3：最少 8 位且同时含字母和数字）
          { pattern: PASSWORD_PATTERN, message: t('密码最少 {{min}} 位且必须同时包含字母和数字', { min: PASSWORD_MIN_LENGTH }) },
        ]}
      >
        <Input.Password placeholder={t('密码最少 {{min}} 位且必须同时包含字母和数字', { min: PASSWORD_MIN_LENGTH })} autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        name="confirmPassword"
        label={t('确认新密码')}
        dependencies={['newPassword']}
        rules={[
          { required: true, message: t('请再次输入新密码') },
          {
            validator: (_rule, value: string) =>
              value === undefined || value === form.getFieldValue('newPassword')
                ? Promise.resolve()
                : Promise.reject(new Error(t('两次输入的密码不一致'))),
          },
        ]}
      >
        <Input.Password placeholder={t('请再次输入新密码')} autoComplete="new-password" />
      </Form.Item>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginSM }}>
        <Button type="primary" htmlType="submit" loading={submitting}>
          {t('修改密码')}
        </Button>
      </div>
    </Form>
  )
}
