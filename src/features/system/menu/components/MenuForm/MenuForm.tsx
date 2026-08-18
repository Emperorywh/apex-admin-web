/**
 * 菜单创建/编辑表单（对齐真实后端写入契约，后端请求体 extra="forbid"）：
 * 创建与编辑共用字段集 { parentId, menuType, title, name?, path?, component?, icon?, sortOrder, visible }，
 * 但提交契约不同构——编辑请求体不含 parentId/menuType/sortOrder（menuType 创建后不可变更，
 * 层级与排序调整走独立端点 PUT /menus/:id/hierarchy），表单据编辑目标原值对比，
 * parentId/sortOrder 有变化时附带 hierarchy 载荷由页面追加调用。
 * 按类型条件约束：link 必须设置 path（外部 URL）；name/component 为 page/link 的路由元数据。
 * 条件字段 preserve=false：类型切换即从表单存储移除隐藏值，提交 DTO 不外泄。
 * VALIDATION.FAILED.errors 字段映射（规格 §14.4）：已知字段写入对应表单项错误，
 * 未知字段和非校验类错误显示为表单上方的页面级 Alert；
 * 提交请求由页面以 silent 发出，错误呈现全部由本表单承担（避免与全局提示重复）。
 */
import { useMemo, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Radio, TreeSelect, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { MENU_I18N_NAMESPACE, MENU_TYPES } from '@/constants/system/menu/menu.constants'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { getApiErrorText } from '@/i18n/errorTexts'
import { isApiError } from '@/services/request/envelope'
import { parseValidationFieldIssues } from '@/utils/validationDetails'
import type { MenuItem } from '@/types/system/menu/menu.types'
import type { MenuFormMode, MenuFormSubmitPayload, MenuFormValues } from './MenuForm.types'

/** 各字段级错误可映射的表单项（规格 §14.4：未知字段显示页面级错误；字段名为后端 camelCase 契约键） */
const KNOWN_FIELDS: readonly (keyof MenuFormValues)[] = [
  'parentId',
  'menuType',
  'title',
  'name',
  'path',
  'component',
  'icon',
  'sortOrder',
  'visible',
]

export interface MenuFormProps {
  mode: MenuFormMode
  /** 编辑目标菜单；创建模式忽略 */
  menu: MenuItem | null
  /** 当前菜单树（上级菜单 TreeSelect 选项来源） */
  tree: MenuItem[]
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：表单校验通过后给出写入契约载荷；抛出错误时由本表单映射呈现 */
  onSubmit: (payload: MenuFormSubmitPayload) => Promise<void>
  onCancel: () => void
}

/** 从菜单树收集自身及全部后代 ID（编辑模式禁选，防止父链成环） */
function collectSelfAndDescendantIds(nodes: readonly MenuItem[], into: Set<string>): void {
  for (const node of nodes) {
    into.add(node.id)
    collectSelfAndDescendantIds(node.children, into)
  }
}

/** 菜单树 → 上级菜单 TreeSelect 选项：标题展示，编辑目标自身及后代禁选 */
function buildParentTreeData(
  nodes: readonly MenuItem[],
  disabledIds: ReadonlySet<string>,
): Array<{ key: string; value: string; title: string; disabled: boolean; children?: ReturnType<typeof buildParentTreeData> }> {
  return nodes.map((node) => ({
    key: node.id,
    value: node.id,
    title: node.title,
    disabled: disabledIds.has(node.id),
    ...(node.children.length > 0 ? { children: buildParentTreeData(node.children, disabledIds) } : {}),
  }))
}

export function MenuForm({ mode, menu, tree, submitting, onSubmit, onCancel }: MenuFormProps) {
  const { t } = useTranslation(MENU_I18N_NAMESPACE)
  const { token } = theme.useToken()
  const [form] = Form.useForm<MenuFormValues>()
  const [pageError, setPageError] = useState<string | null>(null)

  // 编辑模式禁选自身及后代：父链成环会让树组装失去唯一根（后端 409 MENU.CYCLE_DETECTED 前置防护）
  const disabledParentIds = useMemo(() => {
    if (mode !== 'edit' || menu === null) {
      return new Set<string>()
    }
    const ids = new Set<string>()
    collectSelfAndDescendantIds([menu], ids)
    return ids
  }, [mode, menu])
  const parentTreeData = useMemo(() => buildParentTreeData(tree, disabledParentIds), [tree, disabledParentIds])

  const initialValues: MenuFormValues =
    mode === 'edit' && menu !== null
      ? {
          parentId: menu.parentId,
          menuType: menu.menuType,
          title: menu.title,
          name: menu.name ?? '',
          path: menu.path ?? '',
          component: menu.component ?? '',
          icon: menu.icon ?? '',
          sortOrder: menu.sortOrder,
          visible: menu.visible,
        }
      : { parentId: null, menuType: MENU_TYPES.DIRECTORY, title: '', sortOrder: 0, visible: true }

  const handleFinish = async (values: MenuFormValues): Promise<void> => {
    setPageError(null)
    // name/path/component/icon 去空白，空串按契约省略（后端可选字段）
    const optionalFields: Pick<MenuFormValues, 'name' | 'path' | 'component' | 'icon'> = {}
    for (const key of ['name', 'path', 'component', 'icon'] as const) {
      const trimmed = values[key]?.trim()
      if (trimmed !== undefined && trimmed.length > 0) {
        optionalFields[key] = trimmed
      }
    }
    const payload: MenuFormSubmitPayload =
      mode === 'create'
        ? {
            mode: 'create',
            dto: {
              parentId: values.parentId ?? null,
              menuType: values.menuType,
              title: values.title.trim(),
              ...optionalFields,
              sortOrder: values.sortOrder,
              visible: values.visible,
            },
          }
        : {
            mode: 'edit',
            dto: {
              title: values.title.trim(),
              ...optionalFields,
              visible: values.visible,
            },
            // parentId/sortOrder 不在编辑请求体内：相对编辑目标变化时经独立层级端点调整
            hierarchy:
              menu !== null && (values.parentId !== menu.parentId || values.sortOrder !== menu.sortOrder)
                ? { parentId: values.parentId ?? null, sortOrder: values.sortOrder }
                : null,
          }
    try {
      await onSubmit(payload)
    } catch (error) {
      // VALIDATION.FAILED：已知字段映射到表单项，未知字段进页面级错误（规格 §14.4）
      if (isApiError(error) && error.errorCode === API_ERROR_CODES.VALIDATION_FAILED) {
        const issues = parseValidationFieldIssues(error.details) ?? []
        const knownFields = KNOWN_FIELDS as readonly string[]
        const fieldErrors: Array<{ name: keyof MenuFormValues; errors: string[] }> = []
        const unknownMessages: string[] = []
        for (const issue of issues) {
          if (knownFields.includes(issue.field)) {
            fieldErrors.push({ name: issue.field as keyof MenuFormValues, errors: [issue.message] })
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
      // 其余已知 errorCode（如成环 409 MENU.CYCLE_DETECTED）映射为前端 i18n 文案；
      // 未知错误显示固定兜底（规格 §7.4-3）
      setPageError(getApiErrorText(isApiError(error) ? error.errorCode : undefined))
    }
  }

  return (
    <Form<MenuFormValues>
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
      <Form.Item name="parentId" label={t('上级菜单')}>
        <TreeSelect
          allowClear
          treeDefaultExpandAll
          placeholder={t('留空为根级菜单')}
          treeData={parentTreeData}
        />
      </Form.Item>
      {mode === 'create' ? (
        <Form.Item
          name="menuType"
          label={t('类型')}
          rules={[{ required: true, message: t('请选择菜单类型') }]}
        >
          <Radio.Group
            options={[
              { label: t('目录', { context: 'menuType' }), value: MENU_TYPES.DIRECTORY },
              { label: t('页面', { context: 'menuType' }), value: MENU_TYPES.PAGE },
              { label: t('外链', { context: 'menuType' }), value: MENU_TYPES.LINK },
            ]}
          />
        </Form.Item>
      ) : (
        // 菜单类型创建后不可变更（后端契约）：编辑模式仅禁用态回显
        <Form.Item label={t('类型')}>
          <Input
            value={
              initialValues.menuType === MENU_TYPES.DIRECTORY
                ? t('目录', { context: 'menuType' })
                : initialValues.menuType === MENU_TYPES.PAGE
                  ? t('页面', { context: 'menuType' })
                  : t('外链', { context: 'menuType' })
            }
            disabled
          />
        </Form.Item>
      )}
      <Form.Item
        name="title"
        label={t('标题')}
        rules={[{ required: true, whitespace: true, message: t('请输入菜单标题') }]}
      >
        <Input placeholder={t('请输入菜单标题')} allowClear />
      </Form.Item>
      {/* 按类型条件渲染：preserve=false 使类型切换即移除另一类型独占字段 */}
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.menuType !== cur.menuType}>
        {({ getFieldValue }) => {
          const menuType = getFieldValue('menuType') as MenuFormValues['menuType']
          if (menuType === MENU_TYPES.PAGE || menuType === MENU_TYPES.LINK) {
            return (
              <>
                <Form.Item
                  name="name"
                  preserve={false}
                  label={t('路由名称')}
                  rules={[{ whitespace: true, message: t('请输入路由名称') }]}
                >
                  <Input placeholder={t('选填：前端路由名称')} allowClear />
                </Form.Item>
                <Form.Item
                  name="path"
                  preserve={false}
                  label={t('路由路径')}
                  rules={
                    // link 的 path 是外部 URL，必填；page 的 path 选填
                    menuType === MENU_TYPES.LINK
                      ? [{ required: true, whitespace: true, message: t('link 类型必须设置路由路径') }]
                      : []
                  }
                >
                  <Input
                    placeholder={menuType === MENU_TYPES.LINK ? t('请输入外部链接地址') : t('选填：前端路由路径')}
                    allowClear
                  />
                </Form.Item>
              </>
            )
          }
          // directory：不渲染 name/path/component，提交 DTO 不携带
          return null
        }}
      </Form.Item>
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.menuType !== cur.menuType}>
        {({ getFieldValue }) => {
          const menuType = getFieldValue('menuType') as MenuFormValues['menuType']
          if (menuType !== MENU_TYPES.PAGE) {
            return null
          }
          return (
            <Form.Item name="component" preserve={false} label={t('组件标识')}>
              <Input placeholder={t('选填：前端组件标识')} allowClear />
            </Form.Item>
          )
        }}
      </Form.Item>
      <Form.Item name="icon" label={t('图标')}>
        <Input placeholder={t('选填：图标标识')} allowClear />
      </Form.Item>
      <Form.Item
        name="sortOrder"
        label={t('排序值')}
        rules={[{ required: true, message: t('请输入排序值') }]}
      >
        <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder={t('请输入排序值')} />
      </Form.Item>
      <Form.Item name="visible" label={t('是否可见')}>
        <Radio.Group
          options={[
            { label: t('显示'), value: true },
            { label: t('隐藏'), value: false },
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
