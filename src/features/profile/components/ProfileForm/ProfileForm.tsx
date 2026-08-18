/**
 * 个人资料编辑表单（规格 §14.2/§14.3 编辑资料契约）：
 * displayName（必填）/ email（必填，trim 后格式校验）/ phone（选填，空串按契约省略）；
 * username 创建后不可修改（规格 §14.3），以禁用态回显、不作为表单项提交。
 * 提交请求由页面以 silent 发出，VALIDATION_FAILED.details 字段映射与其他错误的
 * 呈现全部由本表单承担（规格 §14.4）：已知字段写入表单项，未知字段进页面级 Alert。
 */
import { useState } from 'react'
import { Alert, Button, Form, Input, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { USER_EMAIL_PATTERN } from '@/constants/system/user/user.constants'
import { PROFILE_I18N_NAMESPACE } from '@/constants/profile/profile.constants'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { getApiErrorText } from '@/i18n/errorTexts'
import { isApiError } from '@/services/request/envelope'
import { parseValidationFieldIssues } from '@/utils/validationDetails'
import type { User } from '@/types/system/user/user.types'
import type { ProfileFormSubmitPayload, ProfileFormValues } from './ProfileForm.types'

/** 可接收字段级错误的表单项（规格 §14.4：未知字段显示页面级错误） */
const KNOWN_FIELDS: readonly string[] = ['displayName', 'email', 'phone']

export interface ProfileFormProps {
  /** 当前会话用户：回显初始值与不可修改的 username */
  user: User
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：表单校验通过后给出编辑资料契约 DTO；抛出错误时由本表单映射呈现 */
  onSubmit: (payload: ProfileFormSubmitPayload) => Promise<void>
}

export function ProfileForm({ user, submitting, onSubmit }: ProfileFormProps) {
  const { t } = useTranslation(PROFILE_I18N_NAMESPACE)
  const { token } = theme.useToken()
  const [form] = Form.useForm<ProfileFormValues>()
  const [pageError, setPageError] = useState<string | null>(null)

  const initialValues: ProfileFormValues = {
    displayName: user.displayName,
    email: user.email ?? '',
    phone: user.phone ?? '',
  }

  const handleFinish = async (values: ProfileFormValues): Promise<void> => {
    setPageError(null)
    // email/phone 去空白，空串按契约省略（后端可选字段）
    const trimmedEmail = values.email?.trim()
    const optionalEmail = trimmedEmail !== undefined && trimmedEmail.length > 0 ? { email: trimmedEmail } : {}
    const trimmedPhone = values.phone?.trim()
    const optionalPhone = trimmedPhone !== undefined && trimmedPhone.length > 0 ? { phone: trimmedPhone } : {}
    const payload: ProfileFormSubmitPayload = {
      displayName: values.displayName.trim(),
      ...optionalEmail,
      ...optionalPhone,
    }
    try {
      await onSubmit(payload)
    } catch (error) {
      // VALIDATION_FAILED：已知字段映射到表单项，未知字段进页面级错误（规格 §14.4）
      if (isApiError(error) && error.errorCode === API_ERROR_CODES.VALIDATION_FAILED) {
        const issues = parseValidationFieldIssues(error.details) ?? []
        const fieldErrors: Array<{ name: keyof ProfileFormValues; errors: string[] }> = []
        const unknownMessages: string[] = []
        for (const issue of issues) {
          if (KNOWN_FIELDS.includes(issue.field)) {
            fieldErrors.push({ name: issue.field as keyof ProfileFormValues, errors: [issue.message] })
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
    <Form<ProfileFormValues>
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
      <Form.Item label={t('用户名')}>
        <Input value={user.username} disabled />
      </Form.Item>
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
        <Button type="primary" htmlType="submit" loading={submitting}>
          {t('保存')}
        </Button>
      </div>
    </Form>
  )
}
