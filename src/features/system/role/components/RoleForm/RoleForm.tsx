/**
 * 角色创建/编辑表单（对齐真实后端写入契约，后端请求体 extra="forbid"）：
 * - 创建：code（全局唯一、`^[a-z][a-z0-9_]*$` 且创建后不可改）+ displayName + description? + sortOrder；
 * - 编辑：仅 displayName/description?/sortOrder；code 以禁用态回显（isBuiltin 与普通角色一致）。
 *   状态变更走列表启停用操作，不在请求体中。
 * - VALIDATION.FAILED.errors 字段映射（规格 §14.4）：已知字段写入对应表单项错误，
 *   未知字段和非校验类错误显示为表单上方的页面级 Alert；
 *   提交请求由页面以 silent 发出，错误呈现全部由本表单承担（避免与全局提示重复）。
 */
import { useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { ROLE_CODE_PATTERN, ROLE_I18N_NAMESPACE } from '@/constants/system/role/role.constants'
import { getApiErrorText } from '@/i18n/errorTexts'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { isApiError } from '@/services/request/envelope'
import { parseValidationFieldIssues } from '@/utils/validationDetails'
import type { Role } from '@/types/system/role/role.types'
import type { RoleFormMode, RoleFormSubmitPayload, RoleFormValues } from './RoleForm.types'
import { toRoleFormValues } from './RoleForm.types'

/** 各模式下可接收字段级错误的表单项（规格 §14.4：未知字段显示页面级错误；字段名为后端 camelCase 契约键） */
const KNOWN_FIELDS_BY_MODE: Record<RoleFormMode, readonly (keyof RoleFormValues)[]> = {
  create: ['code', 'displayName', 'description', 'sortOrder'],
  edit: ['displayName', 'description', 'sortOrder'],
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
      ? toRoleFormValues(role)
      : { code: '', displayName: '', description: '', sortOrder: 0 }

  const handleFinish = async (values: RoleFormValues): Promise<void> => {
    setPageError(null)
    // description 去空白，空串按契约省略（后端可选字段）
    const trimmedDescription = values.description?.trim()
    const optionalDescription =
      trimmedDescription !== undefined && trimmedDescription.length > 0 ? { description: trimmedDescription } : {}
    const payload: RoleFormSubmitPayload =
      mode === 'create'
        ? {
            mode: 'create',
            dto: {
              code: values.code.trim(),
              displayName: values.displayName.trim(),
              ...optionalDescription,
              sortOrder: values.sortOrder,
            },
          }
        : {
            mode: 'edit',
            dto: {
              displayName: values.displayName.trim(),
              ...optionalDescription,
              sortOrder: values.sortOrder,
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
      // 其余已知 errorCode（如 code 重复 409 RBAC.ROLE_ALREADY_EXISTS）映射为前端 i18n 文案；
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
          rules={[
            { required: true, whitespace: true, message: t('请输入角色标识') },
            // 与后端 RoleCreateRequest pattern 同源的前置校验（小写字母开头，小写字母/数字/下划线）
            { pattern: ROLE_CODE_PATTERN, message: t('角色标识须为小写字母、数字或下划线，且以字母开头') },
          ]}
        >
          <Input placeholder={t('请输入角色标识')} allowClear />
        </Form.Item>
      ) : (
        // code 全局唯一且创建后不可修改（后端契约）：编辑模式仅禁用态回显，不作为表单项提交
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
      <Form.Item
        name="sortOrder"
        label={t('排序值')}
        rules={[{ required: true, message: t('请输入排序值') }]}
      >
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
