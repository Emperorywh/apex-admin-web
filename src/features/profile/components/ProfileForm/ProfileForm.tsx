/**
 * 个人资料表单：显示名 + 邮箱，保存后局部更新当前会话用户。
 */

import { useEffect } from 'react'
import { App, Button, Form, Input } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { apiErrorMessage } from '@/services/request/request'
import { updateMyProfile } from '@/services/profile/profile.service'
import { userPatched } from '@/store/slices/authSlice'
import type { AuthUser } from '@/types/auth/auth.types'

/** 显示名长度边界（Unicode 字符数） */
const DISPLAY_NAME_MIN_LENGTH = 1
const DISPLAY_NAME_MAX_LENGTH = 32

/** 邮箱长度上限 */
const EMAIL_MAX_LENGTH = 254

interface ProfileFormValues {
  displayName: string
  email: string | null
}

interface ProfileFormProps {
  user: AuthUser
}

export function ProfileForm({ user }: ProfileFormProps) {
  const { t } = useTranslation('profile')
  const { t: tCommon } = useTranslation('common')
  const dispatch = useAppDispatch()
  const { message } = App.useApp()
  const [form] = Form.useForm<ProfileFormValues>()

  useEffect(() => {
    form.setFieldsValue({ displayName: user.displayName, email: user.email })
  }, [form, user.displayName, user.email])

  const handleFinish = async (values: ProfileFormValues) => {
    try {
      await updateMyProfile({ displayName: values.displayName, email: values.email || null })
      dispatch(
        userPatched({
          displayName: values.displayName,
          email: values.email || null,
          initials: values.displayName.trim().slice(0, 2).toUpperCase(),
        }),
      )
      void message.success(t('个人资料已保存'))
    } catch (error) {
      void message.error(apiErrorMessage(error) || t('保存失败，请稍后重试'))
    }
  }

  return (
    <Form<ProfileFormValues> form={form} layout="vertical" onFinish={handleFinish}>
      <Form.Item
        name="displayName"
        label={t('显示名')}
        rules={[
          { required: true, message: t('请输入显示名') },
          { min: DISPLAY_NAME_MIN_LENGTH, max: DISPLAY_NAME_MAX_LENGTH, message: t('显示名长度需在 1-32 个字符之间') },
        ]}
      >
        <Input placeholder={t('显示名')} />
      </Form.Item>
      <Form.Item
        name="email"
        label={t('邮箱')}
        rules={[
          { type: 'email', message: t('邮箱格式不正确') },
          { max: EMAIL_MAX_LENGTH, message: t('邮箱过长') },
        ]}
      >
        <Input placeholder={t('邮箱（选填）')} />
      </Form.Item>
      <Button type="primary" htmlType="submit">
        {tCommon('保存')}
      </Button>
    </Form>
  )
}
