/**
 * 用户新建 / 编辑表单（Modal）。
 * 创建与编辑请求体不同构：编辑不可改用户名与密码（后端 extra="forbid"）。
 */

import { useEffect } from 'react'
import { Form, Input, Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '@/constants/auth/auth.constants'
import type { UserFormProps, UserFormValues } from '@/features/system/user/components/UserForm/UserForm.types'

export function UserForm({ open, user, roleOptions, saving, onOk, onCancel }: UserFormProps) {
  const { t } = useTranslation('system')
  const { t: tCommon } = useTranslation('common')
  const [form] = Form.useForm<UserFormValues>()
  const editing = user !== null

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (user) {
      form.setFieldsValue({
        username: user.username,
        displayName: user.displayName,
        email: user.email ?? undefined,
        roleCodes: user.roleCodes,
      })
    }
  }, [open, user, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    onOk(values)
  }

  return (
    <Modal
      open={open}
      title={editing ? t('编辑用户') : t('新建用户')}
      okText={tCommon('保存')}
      cancelText={tCommon('取消')}
      confirmLoading={saving}
      onOk={() => void handleOk()}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Form<UserFormValues> form={form} layout="vertical">
        <Form.Item
          name="username"
          label={t('用户名')}
          rules={[
            { required: true, message: t('请输入用户名') },
            { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH, message: t('用户名长度需在 2-32 个字符之间') },
          ]}
        >
          <Input disabled={editing} placeholder={t('用户名')} />
        </Form.Item>
        {!editing ? (
          <Form.Item
            name="password"
            label={t('初始密码')}
            rules={[
              { required: true, message: t('请输入初始密码') },
              { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH, message: t('密码长度需在 12-128 个字符之间') },
            ]}
          >
            <Input.Password placeholder={t('初始密码')} />
          </Form.Item>
        ) : null}
        <Form.Item
          name="displayName"
          label={t('显示名')}
          rules={[{ required: true, message: t('请输入显示名') }]}
        >
          <Input placeholder={t('显示名')} />
        </Form.Item>
        <Form.Item name="email" label={t('邮箱')} rules={[{ type: 'email', message: t('邮箱格式不正确') }]}>
          <Input placeholder={t('邮箱（选填）')} />
        </Form.Item>
        <Form.Item name="roleCodes" label={t('角色')}>
          <Select
            mode="multiple"
            allowClear
            placeholder={t('选择角色')}
            options={roleOptions.map((role) => ({ value: role.code, label: role.name }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
