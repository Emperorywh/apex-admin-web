/**
 * 菜单创建/编辑表单（纯前端模式）：
 * 共用字段集 { parentId, menuType, title, name?, path?, component?, icon?, sortOrder, visible }；
 * 编辑模式 menuType 禁改（类型回显为禁用输入框），parentId/sortOrder 可调整并由页面在
 * 内存树中移动层级。按类型条件约束：link 必须设置 path（外部 URL）；name/component 为
 * page/link 的路由元数据；条件字段 preserve=false，类型切换即从表单存储移除隐藏值。
 * 图标字段为本地彩色图标下拉（AppIcon 封装的已注册名集合），带实时预览。
 */
import { useMemo, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Radio, Select, TreeSelect, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { MENU_I18N_NAMESPACE, MENU_TYPES } from '@/constants/system/menu/menu.constants'
import { AppIcon, LOCAL_ICON_PREFIX, getRegisteredLocalIconNames } from '@/components/AppIcon/AppIcon'
import type { MenuItem } from '@/types/system/menu/menu.types'
import type { MenuFormMode, MenuFormSubmitPayload, MenuFormValues } from './MenuForm.types'

export interface MenuFormProps {
  mode: MenuFormMode
  /** 编辑目标菜单；创建模式忽略 */
  menu: MenuItem | null
  /** 当前菜单树（上级菜单 TreeSelect 选项来源） */
  tree: MenuItem[]
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：表单校验通过后给出写入载荷；页面保证落地成功（失败路径仅兜底提示） */
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
): Array<{
  key: string
  value: string
  title: string
  disabled: boolean
  children?: ReturnType<typeof buildParentTreeData>
}> {
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

  // 编辑模式禁选自身及后代：父链成环会让树组装失去唯一根（原后端 409 MENU.CYCLE_DETECTED 的前置防护）
  const disabledParentIds = useMemo(() => {
    if (mode !== 'edit' || menu === null) {
      return new Set<string>()
    }
    const ids = new Set<string>()
    collectSelfAndDescendantIds([menu], ids)
    return ids
  }, [mode, menu])
  const parentTreeData = useMemo(() => buildParentTreeData(tree, disabledParentIds), [tree, disabledParentIds])

  // 图标选项：本地彩色图标注册表中菜单域的 ic-* 短名，带 AppIcon 实时预览
  const iconOptions = useMemo(
    () =>
      getRegisteredLocalIconNames()
        .filter((shortName) => shortName.startsWith('ic-'))
        .map((shortName) => ({
          value: shortName,
          label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: token.marginXS }}>
              <AppIcon name={`${LOCAL_ICON_PREFIX}${shortName}`} size={16} />
              {shortName}
            </span>
          ),
        })),
    [token.marginXS],
  )

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
    // name/path/component/icon 去空白，空串按可选字段省略
    const optionalFields: Pick<MenuFormValues, 'name' | 'path' | 'component' | 'icon'> = {}
    for (const key of ['name', 'path', 'component', 'icon'] as const) {
      const trimmed = values[key]?.trim()
      if (trimmed !== undefined && trimmed.length > 0) {
        optionalFields[key] = trimmed
      }
    }
    try {
      await onSubmit({
        // 编辑模式类型不可改：payload.menuType 固定为原类型，页面按原值原地更新
        menuType: mode === 'edit' && menu !== null ? menu.menuType : values.menuType,
        parentId: values.parentId ?? null,
        title: values.title.trim(),
        ...optionalFields,
        sortOrder: values.sortOrder,
        visible: values.visible,
      })
    } catch {
      // 纯前端模式页面落地不失败；兜底提示防御未来接入异步数据源时的未映射错误
      setPageError(t('保存失败，请稍后重试'))
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
        <TreeSelect allowClear treeDefaultExpandAll placeholder={t('留空为根级菜单')} treeData={parentTreeData} />
      </Form.Item>
      {mode === 'create' ? (
        <Form.Item name="menuType" label={t('类型')} rules={[{ required: true, message: t('请选择菜单类型') }]}>
          <Radio.Group
            options={[
              { label: t('目录', { context: 'menuType' }), value: MENU_TYPES.DIRECTORY },
              { label: t('页面', { context: 'menuType' }), value: MENU_TYPES.PAGE },
              { label: t('外链', { context: 'menuType' }), value: MENU_TYPES.LINK },
            ]}
          />
        </Form.Item>
      ) : (
        // 菜单类型创建后不可变更（与原后端契约一致）：编辑模式仅禁用态回显
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
          // directory：不渲染 name/path/component，提交载荷不携带
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
        <Select
          allowClear
          showSearch
          placeholder={t('选填：图标标识')}
          options={iconOptions}
          optionFilterProp="value"
        />
      </Form.Item>
      <Form.Item name="sortOrder" label={t('排序值')} rules={[{ required: true, message: t('请输入排序值') }]}>
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
