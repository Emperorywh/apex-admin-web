/**
 * 角色新建 / 编辑表单（Modal）。编码仅创建时可改。
 */

import { useEffect } from 'react'
import { Form, Input, Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import type { RoleEntity } from '@/types/system/role/role.types'

export interface RoleFormValues {
  code: string
  name: string
  description?: string
}

export interface RoleFormProps {
  open: boolean
  /** 编辑目标；null 表示新建 */
  role: RoleEntity | null
  saving: boolean
  onOk: (values: RoleFormValues) => void
  onCancel: () => void
}

export function RoleForm({ open, role, saving, onOk, onCancel }: RoleFormProps) {
  const { t } = useTranslation('system')
  const { t: tCommon } = useTranslation('common')
  const [form] = Form.useForm<RoleFormValues>()
  const editing = role !== null

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (role) {
      form.setFieldsValue({
        code: role.code,
        name: role.name,
        description: role.description ?? undefined,
      })
    }
  }, [open, role, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    onOk(values)
  }

  return (
    <Modal
      open={open}
      title={editing ? t('编辑角色') : t('新建角色')}
      okText={tCommon('保存')}
      cancelText={tCommon('取消')}
      confirmLoading={saving}
      onOk={() => void handleOk()}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Form<RoleFormValues> form={form} layout="vertical">
        <Form.Item
          name="code"
          label={t('角色编码')}
          rules={[
            { required: true, message: t('请输入角色编码') },
            { pattern: /^[a-z][a-z0-9_]*$/, message: t('角色编码为小写字母、数字与下划线') },
          ]}
        >
          <Input disabled={editing} placeholder="ops_admin" />
        </Form.Item>
        <Form.Item name="name" label={t('角色名称')} rules={[{ required: true, message: t('请输入角色名称') }]}>
          <Input placeholder={t('角色名称')} />
        </Form.Item>
        <Form.Item name="description" label={t('描述')}>
          <Input.TextArea rows={2} placeholder={t('描述（选填）')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
