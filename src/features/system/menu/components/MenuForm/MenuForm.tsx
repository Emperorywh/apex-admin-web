/**
 * 菜单创建/编辑表单（规格 §14.3 写入契约）：
 * 创建与编辑共用同一字段集 { parentId, type, name, routeId?, path?, permCode?, sort, visible, status }。
 * 按类型条件校验：directory 不渲染也不得提交 routeId/path/permCode；page 必须设置可识别
 * routeId（全集对照 MENU_PAGE_ROUTE_IDS）；button 必须设置 permCode（选项为正式权限码）。
 * 条件字段 preserve=false：类型切换即从表单存储移除另一类型独占字段，提交 DTO 不会外泄隐藏值。
 * VALIDATION_FAILED.details 字段映射（规格 §14.4）：已知字段写入对应表单项错误，
 * 未知字段与非校验类错误显示为表单上方的页面级 Alert；
 * 提交请求由页面以 silent 发出，错误呈现全部由本表单承担（避免与全局提示重复）。
 */
import { useMemo, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Radio, Select, TreeSelect, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { PERMISSIONS } from '@/constants/permission.constants'
import { MENU_I18N_NAMESPACE, MENU_PAGE_ROUTE_IDS, MENU_TYPES } from '@/constants/system/menu/menu.constants'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { getApiErrorText } from '@/i18n/errorTexts'
import { isApiError } from '@/services/request/envelope'
import { parseValidationFieldIssues } from '@/utils/validationDetails'
import type { MenuItem } from '@/types/system/menu/menu.types'
import type { MenuFormMode, MenuFormSubmitPayload, MenuFormValues } from './MenuForm.types'

/** 各字段级错误可映射的表单项（规格 §14.4：未知字段显示页面级错误） */
const KNOWN_FIELDS: readonly string[] = ['parentId', 'type', 'name', 'routeId', 'path', 'permCode', 'sort', 'visible', 'status']

export interface MenuFormProps {
  mode: MenuFormMode
  /** 编辑目标菜单；创建模式忽略 */
  menu: MenuItem | null
  /** 当前菜单树（上级菜单 TreeSelect 选项来源） */
  tree: MenuItem[]
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：表单校验通过后给出写入契约 DTO；抛出错误时由本表单映射呈现 */
  onSubmit: (payload: MenuFormSubmitPayload) => Promise<void>
  onCancel: () => void
}

/** 从菜单树收集自身及全部后代 ID（编辑模式禁选，防止父链成环） */
function collectSelfAndDescendantIds(nodes: readonly MenuItem[], into: Set<string>): void {
  for (const node of nodes) {
    into.add(node.id)
    if (node.children !== undefined && node.children.length > 0) {
      collectSelfAndDescendantIds(node.children, into)
    }
  }
}

/** 菜单树 → 上级菜单 TreeSelect 选项：编辑目标自身及后代禁选 */
function buildParentTreeData(
  nodes: readonly MenuItem[],
  disabledIds: ReadonlySet<string>,
): Array<{ key: string; value: string; title: string; disabled: boolean; children?: ReturnType<typeof buildParentTreeData> }> {
  return nodes.map((node) => ({
    key: node.id,
    value: node.id,
    title: node.name,
    disabled: disabledIds.has(node.id),
    ...(node.children !== undefined && node.children.length > 0
      ? { children: buildParentTreeData(node.children, disabledIds) }
      : {}),
  }))
}

/** 表单值 → 写入契约 DTO（规格 §14.3 按类型条件约束在此强制：directory 不携带 routeId/path/permCode） */
function buildMenuWriteDto(values: MenuFormValues): MenuFormSubmitPayload['dto'] {
  const dto: MenuFormSubmitPayload['dto'] = {
    parentId: values.parentId ?? null,
    type: values.type,
    name: values.name.trim(),
    sort: values.sort,
    visible: values.visible,
    status: values.status,
  }
  if (values.type === MENU_TYPES.PAGE) {
    // page 必填校验已保证 routeId 存在
    dto.routeId = values.routeId ?? ''
    const path = values.path?.trim()
    if (path !== undefined && path.length > 0) {
      dto.path = path
    }
  }
  if (values.type === MENU_TYPES.BUTTON) {
    // button 必填校验已保证 permCode 存在
    dto.permCode = values.permCode ?? ''
  }
  return dto
}

export function MenuForm({ mode, menu, tree, submitting, onSubmit, onCancel }: MenuFormProps) {
  const { t } = useTranslation(MENU_I18N_NAMESPACE)
  const { token } = theme.useToken()
  const [form] = Form.useForm<MenuFormValues>()
  const [pageError, setPageError] = useState<string | null>(null)

  // 编辑模式禁选自身及后代：父链成环会让树组装失去唯一根（规格 §14.3 parentId 合法性）
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
          type: menu.type,
          name: menu.name,
          routeId: menu.routeId,
          path: menu.path ?? '',
          permCode: menu.permCode,
          sort: menu.sort,
          visible: menu.visible,
          status: menu.status,
        }
      : { parentId: null, type: MENU_TYPES.DIRECTORY, name: '', sort: 1, visible: true, status: 'enabled' }

  const handleFinish = async (values: MenuFormValues): Promise<void> => {
    setPageError(null)
    const payload: MenuFormSubmitPayload = { mode, dto: buildMenuWriteDto(values) }
    try {
      await onSubmit(payload)
    } catch (error) {
      // VALIDATION_FAILED：已知字段映射到表单项，未知字段进页面级错误（规格 §14.4）
      if (isApiError(error) && error.errorCode === API_ERROR_CODES.VALIDATION_FAILED) {
        const issues = parseValidationFieldIssues(error.details) ?? []
        const fieldErrors: Array<{ name: keyof MenuFormValues; errors: string[] }> = []
        const unknownMessages: string[] = []
        for (const issue of issues) {
          if (KNOWN_FIELDS.includes(issue.field)) {
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
      // 其余已知 errorCode 映射为前端 i18n 文案；未知错误显示固定兜底（规格 §7.4-3）
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
      <Form.Item
        name="type"
        label={t('类型')}
        rules={[{ required: true, message: t('请选择菜单类型') }]}
      >
        <Radio.Group
          options={[
            { label: t('目录', { context: 'menuType' }), value: MENU_TYPES.DIRECTORY },
            { label: t('页面', { context: 'menuType' }), value: MENU_TYPES.PAGE },
            { label: t('按钮', { context: 'menuType' }), value: MENU_TYPES.BUTTON },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="name"
        label={t('名称')}
        rules={[{ required: true, whitespace: true, message: t('请输入菜单名称') }]}
      >
        <Input placeholder={t('请输入菜单名称')} allowClear />
      </Form.Item>
      {/* 按类型条件渲染：preserve=false 使类型切换即移除另一类型独占字段（规格 §14.3） */}
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
        {({ getFieldValue }) => {
          const type = getFieldValue('type') as MenuFormValues['type']
          if (type === MENU_TYPES.PAGE) {
            return (
              <>
                <Form.Item
                  name="routeId"
                  preserve={false}
                  label={t('路由 ID')}
                  rules={[
                    { required: true, message: t('page 类型必须设置路由 ID') },
                    {
                      // 可识别 routeId：全集对照 route.constants 登记的路由 ID（规格 §14.3）
                      validator: (_rule, value: string | undefined) =>
                        value === undefined || MENU_PAGE_ROUTE_IDS.includes(value)
                          ? Promise.resolve()
                          : Promise.reject(new Error(t('路由 ID 必须是已注册的路由 ID'))),
                    },
                  ]}
                >
                  {/* 选项为固定小集合（已注册路由 ID），关闭虚拟滚动保证选项完整渲染 */}
                  <Select
                    showSearch
                    virtual={false}
                    placeholder={t('请选择路由 ID')}
                    options={MENU_PAGE_ROUTE_IDS.map((routeId) => ({ label: routeId, value: routeId }))}
                  />
                </Form.Item>
                <Form.Item name="path" preserve={false} label={t('路由路径')}>
                  <Input placeholder={t('选填：默认展示路由路径')} allowClear />
                </Form.Item>
              </>
            )
          }
          if (type === MENU_TYPES.BUTTON) {
            return (
              <Form.Item
                name="permCode"
                preserve={false}
                label={t('权限码')}
                rules={[{ required: true, message: t('button 类型必须设置权限码') }]}
              >
                {/* 选项为固定小集合（权限码全集），关闭虚拟滚动保证选项完整渲染 */}
                <Select
                  showSearch
                  virtual={false}
                  placeholder={t('请选择权限码')}
                  options={Object.values(PERMISSIONS).map((permCode) => ({ label: permCode, value: permCode }))}
                />
              </Form.Item>
            )
          }
          // directory：不渲染 routeId/path/permCode，提交 DTO 不携带（规格 §14.3）
          return null
        }}
      </Form.Item>
      <Form.Item
        name="sort"
        label={t('排序')}
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
