/**
 * 菜单管理页面（纯前端模式）：路由 /system/menu，页面权限 menu:menu:read。
 * 数据来自 menu.demoData.ts 的确定性演示树，页面在内存树上完成创建/编辑（含层级
 * 移动与兄弟排序）/启停用/删除（存在子菜单拒绝删除），刷新页面后重置回演示树；
 * 接入真实后端时以 menu service 替换数据落地层，页面交互结构不需调整。
 * 页面固定呈现说明文案：菜单管理不动态改变前端静态路由；
 * 新增/编辑/启停用/删除按钮由 <Auth> 按钮级门控（规格 §5.2），
 * 权限码一律引用 PERMISSIONS 常量，页面不出现权限魔法字符串。
 */
import { useMemo, useState } from 'react'
import { Alert, App, Button, Drawer, Space, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { CircleCheck, CircleSlash, ListTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { PERMISSIONS } from '@/constants/permission.constants'
import { MENU_I18N_NAMESPACE, MENU_TYPES } from '@/constants/system/menu/menu.constants'
import { MENU_DEMO_TREE } from '@/constants/system/menu/menu.demoData'
import { AppIcon } from '@/components/AppIcon/AppIcon'
import { Auth } from '@/components/Auth/Auth'
import { PageCard } from '@/components/PageCard/PageCard'
import { MenuForm } from '@/features/system/menu/components/MenuForm/MenuForm'
import type { MenuFormMode, MenuFormSubmitPayload } from '@/features/system/menu/components/MenuForm/MenuForm.types'
import type { MenuItem } from '@/types/system/menu/menu.types'

/** 类型列文案 key：与 MENU_TYPES 一一对应（目录/页面/外链） */
const TYPE_LABEL_KEYS: Record<MenuItem['menuType'], string> = {
  [MENU_TYPES.DIRECTORY]: '目录',
  [MENU_TYPES.PAGE]: '页面',
  [MENU_TYPES.LINK]: '外链',
}

/** 列表时间列展示格式（dayjs）；页面私有常量（规格 §3.6） */
const MENU_TABLE_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm'

/** 兄弟节点排序：sortOrder 升序，同值按标题拼音稳定排序 */
function compareSiblings(a: MenuItem, b: MenuItem): number {
  return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'zh-Hans-CN')
}

/** 深拷贝并整体重排：每个层级的兄弟节点按 compareSiblings 排序 */
function sortTree(nodes: readonly MenuItem[]): MenuItem[] {
  return [...nodes].sort(compareSiblings).map((node) => ({ ...node, children: sortTree(node.children) }))
}

/** 在树中按 id 摘除节点（immutable），返回新树与被摘除节点（未命中为 null） */
function removeNode(nodes: readonly MenuItem[], targetId: string): { tree: MenuItem[]; removed: MenuItem | null } {
  let removed: MenuItem | null = null
  const walk = (list: readonly MenuItem[]): MenuItem[] => {
    const result: MenuItem[] = []
    for (const node of list) {
      if (node.id === targetId) {
        removed = node
        continue
      }
      result.push({ ...node, children: walk(node.children) })
    }
    return result
  }
  return { tree: walk(nodes), removed }
}

/** 将节点插入到指定父级（parentId 为 null 插入根级），immutable */
function insertNode(nodes: readonly MenuItem[], node: MenuItem, parentId: string | null): MenuItem[] {
  if (parentId === null) {
    return [...nodes, node]
  }
  return nodes.map((current) =>
    current.id === parentId
      ? { ...current, children: [...current.children, node] }
      : { ...current, children: insertNode(current.children, node, parentId) },
  )
}

/** 原地更新节点字段（不动层级），immutable */
function mapNode(nodes: readonly MenuItem[], targetId: string, patch: Partial<MenuItem>): MenuItem[] {
  return nodes.map((node) =>
    node.id === targetId ? { ...node, ...patch } : { ...node, children: mapNode(node.children, targetId, patch) },
  )
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
  // 内存菜单树：演示树初始化，全部写操作仅落在页面状态（刷新重置）
  const [menus, setMenus] = useState<MenuItem[]>(MENU_DEMO_TREE)
  const [formDrawer, setFormDrawer] = useState<FormDrawerState>(FORM_DRAWER_CLOSED)
  const [submitting, setSubmitting] = useState(false)

  const closeFormDrawer = (): void => {
    setFormDrawer(FORM_DRAWER_CLOSED)
  }

  const handleFormSubmit = async (payload: MenuFormSubmitPayload): Promise<void> => {
    setSubmitting(true)
    try {
      const nowIso = new Date().toISOString()
      const target = formDrawer.menu
      if (target === null) {
        const created: MenuItem = {
          id: crypto.randomUUID(),
          parentId: payload.parentId,
          menuType: payload.menuType,
          title: payload.title,
          name: payload.name ?? null,
          path: payload.path ?? null,
          component: payload.component ?? null,
          icon: payload.icon ?? null,
          sortOrder: payload.sortOrder,
          visible: payload.visible,
          status: 'active',
          children: [],
          createdAt: nowIso,
          updatedAt: nowIso,
        }
        setMenus((prev) => sortTree(insertNode(prev, created, payload.parentId)))
        message.success(t('创建菜单成功'))
      } else {
        // 层级未变：原地更新；层级变化：先摘除再插入新父级（成环由表单禁选自身及后代前置防护）
        const patch: Partial<MenuItem> = {
          title: payload.title,
          name: payload.name ?? null,
          path: payload.path ?? null,
          component: payload.component ?? null,
          icon: payload.icon ?? null,
          sortOrder: payload.sortOrder,
          visible: payload.visible,
          updatedAt: nowIso,
        }
        setMenus((prev) => {
          if (payload.parentId === target.parentId) {
            return sortTree(mapNode(prev, target.id, patch))
          }
          const { tree, removed } = removeNode(prev, target.id)
          if (removed === null) {
            return prev
          }
          return sortTree(insertNode(tree, { ...removed, ...patch, parentId: payload.parentId }, payload.parentId))
        })
        message.success(t('保存成功'))
      }
      closeFormDrawer()
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = (target: MenuItem): void => {
    const nextStatus: MenuItem['status'] = target.status === 'active' ? 'disabled' : 'active'
    setMenus((prev) =>
      mapNode(prev, target.id, { status: nextStatus, updatedAt: new Date().toISOString() }),
    )
    message.success(nextStatus === 'active' ? t('启用成功') : t('禁用成功'))
  }

  const confirmDelete = (target: MenuItem): void => {
    // 存在子菜单拒绝删除（与原后端 409 冲突行为一致），提示不弹确认框
    if (target.children.length > 0) {
      message.warning(t('存在子菜单，无法删除'))
      return
    }
    modal.confirm({
      title: t('删除菜单'),
      content: t('确定要删除菜单「{{name}}」吗？删除后不可恢复。', { name: target.title }),
      okText: t('确认删除'),
      okButtonProps: { danger: true },
      cancelText: t('取消'),
      onOk: async () => {
        setMenus((prev) => sortTree(removeNode(prev, target.id).tree))
        message.success(t('删除成功'))
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
      // 图标列（SPEC_UI2 §5.7 本规格唯一列结构例外）：可选 icon 字段（`local:` 图标名），
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
      width: 220,
      render: (_, record) => (
        <Space size={0}>
          <Auth code={PERMISSIONS.SYSTEM_MENU_UPDATE}>
            <Button
              type="link"
              size="small"
              icon={<Pencil size={14} />}
              onClick={() => setFormDrawer({ open: true, mode: 'edit', menu: record })}
            >
              {t('编辑')}
            </Button>
          </Auth>
          <Auth code={PERMISSIONS.SYSTEM_MENU_UPDATE}>
            <Button
              type="link"
              size="small"
              icon={record.status === 'active' ? <CircleSlash size={14} /> : <CircleCheck size={14} />}
              onClick={() => toggleStatus(record)}
            >
              {record.status === 'active' ? t('禁用', { context: 'button' }) : t('启用', { context: 'button' })}
            </Button>
          </Auth>
          <Auth code={PERMISSIONS.SYSTEM_MENU_DELETE}>
            <Button type="link" size="small" danger icon={<Trash2 size={14} />} onClick={() => confirmDelete(record)}>
              {t('删除')}
            </Button>
          </Auth>
        </Space>
      ),
    },
  ]

  const alertMessage = useMemo(() => t('菜单管理仅维护后端菜单数据，不会动态改变前端静态路由'), [t])

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
              message={alertMessage}
              style={{ marginBottom: 16 }}
            />
            <Auth code={PERMISSIONS.SYSTEM_MENU_CREATE}>
              <Button
                type="primary"
                icon={<Plus size={14} />}
                onClick={() => setFormDrawer({ open: true, mode: 'create', menu: null })}
              >
                {t('新增菜单')}
              </Button>
            </Auth>
          </>
        }
      >
        <Table<MenuItem> rowKey="id" columns={columns} dataSource={menus} pagination={false} />
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
