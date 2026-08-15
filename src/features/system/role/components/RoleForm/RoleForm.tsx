/**
 * 角色创建/编辑表单（规格 §14.3 写入契约）：
 * - 创建：code（全局唯一且创建后不可改）+ name/description?/status；
 * - 编辑：仅 name/description?/status；code 以禁用态回显（builtIn 与普通角色一致，规格 §14.1）。
 * - VALIDATION_FAILED.details 字段映射（规格 §14.4）：已知字段写入对应表单项错误，
 *   未知字段与非校验类错误显示为表单上方的页面级 Alert；
 *   提交请求由页面以 silent 发出，错误呈现全部由本表单承担（避免与全局提示重复）。
 */
import { useState } from 'react'
import { Alert, Button, Form, Input, Radio, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { ROLE_I18N_NAMESPACE } from '@/constants/system/role/role.constants'
import { getApiErrorText } from '@/i18n/errorTexts'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { isApiError } from '@/services/request/envelope'
import { parseValidationFieldIssues } from '@/utils/validationDetails'
import type { Role } from '@/types/system/role/role.types'
import type { RoleFormMode, RoleFormSubmitPayload, RoleFormValues } from './RoleForm.types'

/** 各模式下可接收字段级错误的表单项（规格 §14.4：未知字段显示页面级错误） */
const KNOWN_FIELDS_BY_MODE: Record<RoleFormMode, readonly (keyof RoleFormValues)[]> = {
  create: ['code', 'name', 'description', 'status'],
  edit: ['name', 'description', 'status'],
}

export interface RoleFormProps {
  mode: RoleFormMode
  /** 编辑目标角色；创建模式忽略 */
  role: Role | null
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：表单校验通过后按模式给出写入契约 DTO；抛出错误时由本表单映射呈现 */
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
      ? { code: role.code, name: role.name, description: role.description ?? '', status: role.status }
      : { code: '', name: '', description: '', status: 'enabled' }

  const handleFinish = async (values: RoleFormValues): Promise<void> => {
    setPageError(null)
    // description 去空白，空串按契约省略（规格 §14.3 description?）
    const trimmedDescription = values.description?.trim()
    const optionalDescription =
      trimmedDescription !== undefined && trimmedDescription.length > 0 ? { description: trimmedDescription } : {}
    const payload: RoleFormSubmitPayload =
      mode === 'create'
        ? {
            mode: 'create',
            dto: {
              code: values.code.trim(),
              name: values.name.trim(),
              ...optionalDescription,
              status: values.status,
            },
          }
        : {
            mode: 'edit',
            dto: {
              name: values.name.trim(),
              ...optionalDescription,
              status: values.status,
            },
          }
    try {
      await onSubmit(payload)
    } catch (error) {
      // VALIDATION_FAILED：已知字段映射到表单项，未知字段进页面级错误（规格 §14.4）
      if (isApiError(error) && error.errorCode === API_ERROR_CODES.VALIDATION_FAILED) {
        const issues = parseValidationFieldIssues(error.details) ?? []
        // 运行时以字符串判定成员关系，命中后窄化为表单键供 setFields 使用
        const knownFields = KNOWN_FIELDS_BY_MODE[mode] as readonly string[]
        const fieldErrors: Array<{ name: keyof RoleFormValues; errors: string[] }> = []
        const unknownMessages: string[] = []
        for (const issue of issues) {
          if (knownFields.includes(issue.field)) {
            fieldErrors.push({ name: issue.field as keyof RoleFormValues, errors: [issue.message] })
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
      // 其余已知 errorCode（如 code 重复的 RESOURCE_CONFLICT）映射为前端 i18n 文案；
      // 未知错误显示固定兜底（规格 §7.4-3）；文案统一经 common 命名空间解析（errorTexts）
      setPageError(getApiErrorText(isApiError(error) ? error.errorCode : undefined))
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
          rules={[{ required: true, whitespace: true, message: t('请输入角色标识') }]}
        >
          <Input placeholder={t('请输入角色标识')} allowClear />
        </Form.Item>
      ) : (
        // code 全局唯一且创建后不可修改（规格 §14.3）：编辑模式仅禁用态回显，不作为表单项提交
        <Form.Item label={t('角色标识')}>
          <Input value={role?.code ?? ''} disabled />
        </Form.Item>
      )}
      <Form.Item
        name="name"
        label={t('角色名称')}
        rules={[{ required: true, whitespace: true, message: t('请输入角色名称') }]}
      >
        <Input placeholder={t('请输入角色名称')} allowClear />
      </Form.Item>
      <Form.Item name="description" label={t('描述')}>
        <Input.TextArea placeholder={t('请输入描述')} rows={3} allowClear />
      </Form.Item>
      <Form.Item name="status" label={t('状态')}>
        <Radio.Group
          options={[
            { label: t('启用', { context: 'status' }), value: 'enabled' },
            { label: t('禁用', { context: 'status' }), value: 'disabled' },
          ]}
        />
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
