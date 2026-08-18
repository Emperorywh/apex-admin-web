/**
 * 菜单管理页面（对齐真实后端 menu 接口）：路由 /system/menu，页面权限 menu:menu:read。
 * 树表展示（menuType/title/name/path/sortOrder/visible/status，不分页）由 useMenuTree 承担
 * （§17.24 竞态防护 + 页签作用域）；创建/编辑共用 MenuForm（编辑与创建不同构：基本信息走
 * PUT /menus/:id，parentId/sortOrder 变化追加 PUT /menus/:id/hierarchy；link 类型必须设置 path）；
 * 状态变更走 POST /menus/:id/enable|disable；删除存在子菜单返回 409，冲突提示由请求层
 * 统一弹出（非 silent）。页面固定呈现说明文案：菜单管理不动态改变前端静态路由；
 * 新增/编辑/启停用/删除按钮由 <Auth> 按钮级门控（规格 §5.2），viewer 下隐藏，
 * 权限码一律引用 PERMISSIONS 常量，页面不出现权限魔法字符串。
 */
import { useState } from 'react'
import { Alert, App, Button, Drawer, Space, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { CircleCheck, CircleSlash, ListTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { PERMISSIONS } from '@/constants/permission.constants'
import { MENU_I18N_NAMESPACE, MENU_TYPES } from '@/constants/system/menu/menu.constants'
import { AppIcon } from '@/components/AppIcon/AppIcon'
import { Auth } from '@/components/Auth/Auth'
import { PageCard } from '@/components/PageCard/PageCard'
import { MenuForm } from '@/features/system/menu/components/MenuForm/MenuForm'
import type { MenuFormMode, MenuFormSubmitPayload } from '@/features/system/menu/components/MenuForm/MenuForm.types'
import { useMenuTree } from '@/features/system/menu/hooks/useMenuTree'
import { adjustMenuHierarchy, createMenu, deleteMenu, disableMenu, enableMenu, updateMenu } from '@/services/system/menu/menu.service'
import type { MenuItem } from '@/types/system/menu/menu.types'

/** 类型列文案 key：与 MENU_TYPES 一一对应（目录/页面/外链） */
const TYPE_LABEL_KEYS: Record<MenuItem['menuType'], string> = {
  [MENU_TYPES.DIRECTORY]: '目录',
  [MENU_TYPES.PAGE]: '页面',
  [MENU_TYPES.LINK]: '外链',
}

/** 列表时间列展示格式（dayjs）；页面私有常量（规格 §3.6） */
const MENU_TABLE_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm'

/** 表单 Drawer 开合状态：mode + 编辑目标（创建模式 menu 为 null） */
interface FormDrawerState {
  open: boolean
  mode: MenuFormMode
  menu: MenuItem | null
}

const FORM_DRAWER_CLOSED: FormDrawerState = { open: false, mode: 'create', menu: null }

export function Menu() {
  const { t } = useTranslation(MENU_I18N_NAMESPACE)
  const { message, modal } = App.useApp()
  const { menus, loading, reload } = useMenuTree()
  const [formDrawer, setFormDrawer] = useState<FormDrawerState>(FORM_DRAWER_CLOSED)
  const [submitting, setSubmitting] = useState(false)

  const closeFormDrawer = (): void => {
    setFormDrawer(FORM_DRAWER_CLOSED)
  }

  const handleFormSubmit = async (payload: MenuFormSubmitPayload): Promise<void> => {
    setSubmitting(true)
    try {
      // silent：字段映射与页面级错误由 MenuForm 呈现（规格 §7.4-3/§14.4）
      if (payload.mode === 'create') {
        await createMenu(payload.dto, { silent: true })
        message.success(t('创建菜单成功'))
      } else {
        const target = formDrawer.menu
        if (target !== null) {
          await updateMenu(target.id, payload.dto, { silent: true })
          // parentId/sortOrder 有变化：追加独立层级调整端点（成环由后端 409 拒绝）
          if (payload.hierarchy !== null) {
            await adjustMenuHierarchy(target.id, payload.hierarchy, { silent: true })
          }
          message.success(t('保存成功'))
        }
      }
      closeFormDrawer()
      reload()
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = (target: MenuItem): void => {
    // 非 silent：启停用失败由请求层统一弹出错误提示
    const action =
      target.status === 'active'
        ? disableMenu(target.id).then(() => t('禁用成功'))
        : enableMenu(target.id).then(() => t('启用成功'))
    void action
      .then((successText) => {
        message.success(successText)
        reload()
      })
      .catch(() => {
        // 吞掉 rejection；失败提示已由请求层弹出
      })
  }

  const confirmDelete = (target: MenuItem): void => {
    modal.confirm({
      title: t('删除菜单'),
      content: t('确定要删除菜单「{{name}}」吗？删除后不可恢复。', { name: target.title }),
      okText: t('确认删除'),
      okButtonProps: { danger: true },
      cancelText: t('取消'),
      onOk: async () => {
        try {
          // 非 silent：删除冲突（存在子菜单 409）由请求层统一弹出错误提示
          await deleteMenu(target.id)
          message.success(t('删除成功'))
          reload()
        } catch {
          // 吞掉 rejection 使确认框正常关闭；失败提示已由请求层弹出
        }
      },
    })
  }

  const columns: TableProps<MenuItem>['columns'] = [
    {
      title: t('类型'),
      dataIndex: 'menuType',
      key: 'menuType',
      width: 90,
      render: (menuType: MenuItem['menuType']) => <Tag>{t(TYPE_LABEL_KEYS[menuType], { context: 'menuType' })}</Tag>,
    },
    {
      // 图标列（SPEC_UI2 §5.7 本规格唯一列结构例外）：后端可选 icon 字段（`local:` 图标名），
      // 渲染统一经 AppIcon；无图标呈现占位
      title: t('图标'),
      dataIndex: 'icon',
      key: 'icon',
      width: 72,
      render: (icon: string | null) => (icon !== null && icon !== '' ? <AppIcon name={icon} size={20} /> : '-'),
    },
    { title: t('标题'), dataIndex: 'title', key: 'title' },
    {
      title: t('路由名称'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string | null) => name ?? '-',
    },
    {
      title: t('路由路径'),
      dataIndex: 'path',
      key: 'path',
      render: (path: string | null) => path ?? '-',
    },
    { title: t('排序值'), dataIndex: 'sortOrder', key: 'sortOrder', width: 90 },
    {
      title: t('是否可见'),
      dataIndex: 'visible',
      key: 'visible',
      width: 100,
      render: (visible: boolean) => (visible ? t('显示') : t('隐藏')),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: MenuItem['status']) => (
        <Tag color={status === 'active' ? 'success' : 'error'}>
          {status === 'active' ? t('启用', { context: 'status' }) : t('禁用', { context: 'status' })}
        </Tag>
      ),
    },
    {
      title: t('更新时间'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (updatedAt: string) => dayjs(updatedAt).format(MENU_TABLE_DATETIME_FORMAT),
    },
    {
      title: t('操作'),
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size={0}>
          <Auth code={PERMISSIONS.SYSTEM_MENU_UPDATE}>
            <Button type="link" icon={<Pencil size={14} />} onClick={() => setFormDrawer({ open: true, mode: 'edit', menu: record })}>
              {t('编辑')}
            </Button>
          </Auth>
          <Auth code={PERMISSIONS.SYSTEM_MENU_UPDATE}>
            <Button
              type="link"
              icon={record.status === 'active' ? <CircleSlash size={14} /> : <CircleCheck size={14} />}
              onClick={() => toggleStatus(record)}
            >
              {record.status === 'active' ? t('禁用', { context: 'button' }) : t('启用', { context: 'button' })}
            </Button>
          </Auth>
          <Auth code={PERMISSIONS.SYSTEM_MENU_DELETE}>
            <Button type="link" danger icon={<Trash2 size={14} />} onClick={() => confirmDelete(record)}>
              {t('删除')}
            </Button>
          </Auth>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 单卡片合并（SPEC_UI2 §7）：固定说明 + 工具栏 + 树表进同一张纸面白卡 */}
      <PageCard
        search={
          <>
            {/* 固定说明文案：菜单管理不动态改变前端静态路由 */}
            <Alert
              type="info"
              showIcon
              icon={<ListTree size={16} />}
              message={t('菜单管理仅维护后端菜单数据，不会动态改变前端静态路由')}
              style={{ marginBottom: 16 }}
            />
            <Auth code={PERMISSIONS.SYSTEM_MENU_CREATE}>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setFormDrawer({ open: true, mode: 'create', menu: null })}>
                {t('新增菜单')}
              </Button>
            </Auth>
          </>
        }
      >
        <Table<MenuItem>
          rowKey="id"
          columns={columns}
          dataSource={menus}
          loading={loading}
          pagination={false}
        />
      </PageCard>
      <Drawer
        title={formDrawer.mode === 'create' ? t('新增菜单') : t('编辑菜单')}
        placement="right"
        width={440}
        open={formDrawer.open}
        onClose={closeFormDrawer}
        destroyOnHidden
      >
        <MenuForm
          mode={formDrawer.mode}
          menu={formDrawer.menu}
          tree={menus}
          submitting={submitting}
          onSubmit={handleFormSubmit}
          onCancel={closeFormDrawer}
        />
      </Drawer>
    </div>
  )
}
