/**
 * 菜单管理页面（规格 §14.2/§14.3）：路由 /system/menu，页面权限 system:menu:list。
 * 树表展示（type/name/routeId/path/permCode/sort/visible/status，不分页）由 useMenuTree
 * 承担（§17.24 竞态防护 + 页签作用域）；创建/编辑共用 MenuForm（按类型条件校验，
 * directory 不得设 routeId、page 必须设可识别 routeId、button 必须设 permCode）；
 * 删除存在子节点返回 RESOURCE_CONFLICT，冲突提示由请求层统一弹出（非 silent）。
 * 页面固定呈现说明文案：菜单管理不动态改变前端静态路由（规格 §14.1/§14.2）；
 * 新增/编辑/删除按钮由 <Auth> 按钮级门控（规格 §5.2），viewer 下隐藏，
 * 权限码一律引用 PERMISSIONS 常量，页面不出现权限魔法字符串。
 */
import { useState } from 'react'
import { Alert, App, Button, Drawer, Space, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { ListTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PERMISSIONS } from '@/constants/permission.constants'
import { MENU_I18N_NAMESPACE, MENU_TYPES } from '@/constants/system/menu/menu.constants'
import { Auth } from '@/components/Auth/Auth'
import { MenuForm } from '@/features/system/menu/components/MenuForm/MenuForm'
import type { MenuFormMode, MenuFormSubmitPayload } from '@/features/system/menu/components/MenuForm/MenuForm.types'
import { useMenuTree } from '@/features/system/menu/hooks/useMenuTree'
import { createMenu, deleteMenu, updateMenu } from '@/services/system/menu/menu.service'
import type { MenuItem } from '@/types/system/menu/menu.types'

/** 类型列文案 key：与 MENU_TYPES 一一对应（规格 §14.1 菜单类型枚举） */
const TYPE_LABEL_KEYS: Record<MenuItem['type'], string> = {
  [MENU_TYPES.DIRECTORY]: '目录',
  [MENU_TYPES.PAGE]: '页面',
  [MENU_TYPES.BUTTON]: '按钮',
}

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
      if (payload.mode === 'create') {
        // silent：字段映射与页面级错误由 MenuForm 呈现（规格 §7.4-3/§14.4）
        await createMenu(payload.dto, { silent: true })
        message.success(t('创建菜单成功'))
      } else {
        const target = formDrawer.menu
        if (target !== null) {
          await updateMenu(target.id, payload.dto, { silent: true })
          message.success(t('保存成功'))
        }
      }
      closeFormDrawer()
      reload()
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = (target: MenuItem): void => {
    modal.confirm({
      title: t('删除菜单'),
      content: t('确定要删除菜单「{{name}}」吗？删除后不可恢复。', { name: target.name }),
      okText: t('确认删除'),
      okButtonProps: { danger: true },
      cancelText: t('取消'),
      onOk: async () => {
        try {
          // 非 silent：删除冲突（存在子节点 RESOURCE_CONFLICT）由请求层统一弹出错误提示
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
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (type: MenuItem['type']) => <Tag>{t(TYPE_LABEL_KEYS[type])}</Tag>,
    },
    { title: t('名称'), dataIndex: 'name', key: 'name' },
    {
      title: t('路由 ID'),
      dataIndex: 'routeId',
      key: 'routeId',
      render: (routeId: string | undefined) => routeId ?? '-',
    },
    {
      title: t('路由路径'),
      dataIndex: 'path',
      key: 'path',
      render: (path: string | undefined) => path ?? '-',
    },
    {
      title: t('权限码'),
      dataIndex: 'permCode',
      key: 'permCode',
      render: (permCode: string | undefined) => permCode ?? '-',
    },
    { title: t('排序'), dataIndex: 'sort', key: 'sort', width: 80 },
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
        <Tag color={status === 'enabled' ? 'success' : 'error'}>
          {status === 'enabled' ? t('启用', { context: 'status' }) : t('禁用', { context: 'status' })}
        </Tag>
      ),
    },
    {
      title: t('操作'),
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space size={0}>
          <Auth code={PERMISSIONS.SYSTEM_MENU_UPDATE}>
            <Button type="link" icon={<Pencil size={14} />} onClick={() => setFormDrawer({ open: true, mode: 'edit', menu: record })}>
              {t('编辑')}
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
      {/* 固定说明文案（规格 §14.1/§14.2）：菜单管理不动态改变前端静态路由 */}
      <Alert
        type="info"
        showIcon
        icon={<ListTree size={16} />}
        message={t('菜单管理仅维护后端菜单数据，不会动态改变前端静态路由')}
        style={{ marginBottom: 16 }}
      />
      <div style={{ marginBottom: 16 }}>
        <Auth code={PERMISSIONS.SYSTEM_MENU_CREATE}>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setFormDrawer({ open: true, mode: 'create', menu: null })}>
            {t('新增菜单')}
          </Button>
        </Auth>
      </div>
      <Table<MenuItem>
        rowKey="id"
        columns={columns}
        dataSource={menus}
        loading={loading}
        pagination={false}
      />
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
