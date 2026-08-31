/**
 * 角色创建/编辑表单（纯前端模式）：
 * - 创建：code（`^[a-z][a-z0-9_]*$` 且创建后不可改）+ displayName + description? + sortOrder；
 * - 编辑：仅 displayName/description?/sortOrder；code 以禁用态回显（isBuiltin 与普通角色一致）。
 *   状态变更走列表启停用操作，不在本表单。
 * 校验正则与 role.constants 同源；提交载荷由页面在内存角色集合中落地。
 */
import { useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { ROLE_CODE_PATTERN, ROLE_I18N_NAMESPACE } from '@/constants/system/role/role.constants'
import type { Role } from '@/types/system/role/role.types'
import type { RoleFormMode, RoleFormSubmitPayload, RoleFormValues } from './RoleForm.types'
import { toRoleFormValues } from './RoleForm.types'

export interface RoleFormProps {
  mode: RoleFormMode
  /** 编辑目标角色；创建模式忽略 */
  role: Role | null
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：表单校验通过后按模式给出写入载荷；页面保证落地成功（失败路径仅兜底提示） */
  onSubmit: (payload: RoleFormSubmitPayload) => Promise<void>
  onCancel: () => void
}

export function RoleForm({ mode, role, submitting, onSubmit, onCancel }: RoleFormProps) {
  const { t } = useTranslation(ROLE_I18N_NAMESPACE)
  const { token } = theme.useToken()
  const [form] = Form.useForm<RoleFormValues>()
  const [pageError, setPageError] = useState<string | null>(null)

  const initialValues: RoleFormValues =
    mode === 'edit' && role !== null
      ? toRoleFormValues(role)
      : { code: '', displayName: '', description: '', sortOrder: 0 }

  const handleFinish = async (values: RoleFormValues): Promise<void> => {
    setPageError(null)
    // description 去空白，空串按可选字段省略
    const trimmedDescription = values.description.trim()
    const optionalDescription = trimmedDescription.length > 0 ? { description: trimmedDescription } : {}
    const payload: RoleFormSubmitPayload =
      mode === 'create'
        ? {
            mode: 'create',
            draft: {
              code: values.code.trim(),
              displayName: values.displayName.trim(),
              ...optionalDescription,
              sortOrder: values.sortOrder,
            },
          }
        : {
            mode: 'edit',
            draft: {
              displayName: values.displayName.trim(),
              ...optionalDescription,
              sortOrder: values.sortOrder,
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
    <Form<RoleFormValues>
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
          name="code"
          label={t('角色标识')}
          rules={[
            { required: true, whitespace: true, message: t('请输入角色标识') },
            // 与原后端 RoleCreateRequest pattern 同源的前置校验（小写字母开头，小写字母/数字/下划线）
            { pattern: ROLE_CODE_PATTERN, message: t('角色标识须为小写字母、数字或下划线，且以字母开头') },
          ]}
        >
          <Input placeholder={t('请输入角色标识')} allowClear />
        </Form.Item>
      ) : (
        // code 全局唯一且创建后不可修改：编辑模式仅禁用态回显，不作为表单项提交
        <Form.Item label={t('角色标识')}>
          <Input value={role?.code ?? ''} disabled />
        </Form.Item>
      )}
      <Form.Item
        name="displayName"
        label={t('角色名称')}
        rules={[{ required: true, whitespace: true, message: t('请输入角色名称') }]}
      >
        <Input placeholder={t('请输入角色名称')} allowClear />
      </Form.Item>
      <Form.Item name="description" label={t('描述')}>
        <Input.TextArea placeholder={t('请输入描述')} rows={3} allowClear />
      </Form.Item>
      <Form.Item name="sortOrder" label={t('排序值')} rules={[{ required: true, message: t('请输入排序值') }]}>
        <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder={t('请输入排序值')} />
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
