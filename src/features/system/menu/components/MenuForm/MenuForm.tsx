/**
 * 菜单新建 / 编辑表单（Modal）。
 * 编辑保存时同时提交层级调整（parentId + sort 走独立 hierarchy 端点）。
 */

import { useEffect } from 'react'
import { Form, Input, InputNumber, Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { PERMISSION_CODES } from '@/constants/permission.constants'
import type { MenuTreeNode } from '@/types/system/menu/menu.types'

export interface MenuFormValues {
  parentId: string | null
  name: string
  path: string
  icon?: string
  sort: number
  permCode?: string
}

export interface MenuFormProps {
  open: boolean
  /** 编辑目标；null 表示新建 */
  menu: MenuTreeNode | null
  /** 可选父节点（不含自身子树，防环） */
  parentOptions: Array<{ id: string; label: string }>
  saving: boolean
  onOk: (values: MenuFormValues) => void
  onCancel: () => void
}

export function MenuForm({ open, menu, parentOptions, saving, onOk, onCancel }: MenuFormProps) {
  const { t } = useTranslation('system')
  const { t: tCommon } = useTranslation('common')
  const [form] = Form.useForm<MenuFormValues>()

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (menu) {
      form.setFieldsValue({
        parentId: menu.parentId,
        name: menu.name,
        path: menu.path,
        icon: menu.icon ?? undefined,
        sort: menu.sort,
        permCode: menu.permCode ?? undefined,
      })
    }
  }, [open, menu, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    onOk(values)
  }

  return (
    <Modal
      open={open}
      title={menu ? t('编辑菜单') : t('新建菜单')}
      okText={tCommon('保存')}
      cancelText={tCommon('取消')}
      confirmLoading={saving}
      onOk={() => void handleOk()}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Form<MenuFormValues> form={form} layout="vertical" initialValues={{ sort: 1, parentId: null }}>
        <Form.Item name="parentId" label={t('上级菜单')}>
          <Select
            allowClear
            placeholder={t('作为顶级菜单')}
            options={parentOptions.map((option) => ({ value: option.id, label: option.label }))}
          />
        </Form.Item>
        <Form.Item name="name" label={t('菜单名称')} rules={[{ required: true, message: t('请输入菜单名称') }]}>
          <Input placeholder={t('菜单名称')} />
        </Form.Item>
        <Form.Item
          name="path"
          label={t('路由路径')}
          rules={[
            { required: true, message: t('请输入路由路径') },
            { pattern: /^\/[a-zA-Z0-9\-_/]*$/, message: t('路由路径需以 / 开头') },
          ]}
        >
          <Input placeholder="/system/user" />
        </Form.Item>
        <Form.Item name="icon" label={t('图标名')}>
          <Input placeholder="users" />
        </Form.Item>
        <Form.Item name="sort" label={t('排序')} rules={[{ required: true, message: t('请输入排序值') }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="permCode" label={t('权限码')}>
          <Select
            allowClear
            placeholder={t('所有登录用户可见')}
            options={Object.values(PERMISSION_CODES).map((code) => ({ value: code, label: code }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
