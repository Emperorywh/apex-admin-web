/**
 * 菜单管理页：树形表格 + 新建/编辑（含层级调整）/删除。
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Badge, Button, Popconfirm, Space, Table } from 'antd'
import { Plus } from 'lucide-react'
import { MenuForm } from '@/features/system/menu/components/MenuForm/MenuForm'
import { useMenuTree } from '@/features/system/menu/hooks/useMenuTree'
import { createMenu, deleteMenu, updateMenu, updateMenuHierarchy } from '@/services/system/menu/menu.service'
import { apiErrorMessage } from '@/services/request/request'
import type { MenuTreeNode } from '@/types/system/menu/menu.types'
import type { MenuFormValues } from '@/features/system/menu/components/MenuForm/MenuForm'

/** 排除自身子树后的可选父节点（防环） */
function collectParents(nodes: MenuTreeNode[], excludeId: string | null): Array<{ id: string; label: string }> {
  const result: Array<{ id: string; label: string }> = []
  for (const node of nodes) {
    if (node.id === excludeId) continue
    const label = node.name
    result.push({ id: node.id, label })
    result.push(...collectParents(node.children, excludeId))
  }
  return result
}

export default function Menu() {
  const { t } = useTranslation('system')
  const { t: tCommon } = useTranslation('common')
  const { message } = App.useApp()
  const { tree, loading, reload } = useMenuTree()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MenuTreeNode | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  const parentOptions = useMemo(
    () => collectParents(tree, editing?.id ?? null),
    [tree, editing],
  )

  const handleFormOk = async (values: MenuFormValues) => {
    setSaving(true)
    try {
      if (creating) {
        await createMenu({
          parentId: values.parentId,
          name: values.name,
          path: values.path,
          icon: values.icon || null,
          sort: values.sort,
        })
        void message.success(t('菜单已创建'))
      } else if (editing !== null) {
        await updateMenu(editing.id, {
          name: values.name,
          path: values.path,
          icon: values.icon || null,
          sort: values.sort,
        })
        await updateMenuHierarchy(editing.id, { parentId: values.parentId, sort: values.sort })
        void message.success(t('菜单已更新'))
      }
      setFormOpen(false)
      reload()
    } catch (caught) {
      void message.error(apiErrorMessage(caught) || tCommon('操作失败，请稍后重试'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (record: MenuTreeNode) => {
    try {
      await deleteMenu(record.id)
      void message.success(t('菜单已删除'))
      reload()
    } catch (caught) {
      void message.error(apiErrorMessage(caught) || tCommon('操作失败，请稍后重试'))
    }
  }

  const columns = [
    { title: t('菜单名称'), dataIndex: 'name', width: 200 },
    { title: t('路由路径'), dataIndex: 'path', width: 200 },
    { title: t('图标名'), dataIndex: 'icon', width: 140, render: (value: string | null) => value ?? '—' },
    { title: t('排序'), dataIndex: 'sort', width: 80 },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 90,
      render: (status: MenuTreeNode['status']) => (
        <Badge status={status === 'active' ? 'success' : 'default'} text={status === 'active' ? t('启用') : t('停用')} />
      ),
    },
    {
      title: tCommon('操作'),
      key: 'actions',
      width: 160,
      render: (_: unknown, record: MenuTreeNode) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setCreating(false)
              setEditing(record)
              setFormOpen(true)
            }}
          >
            {tCommon('编辑')}
          </Button>
          <Popconfirm title={t('确认删除该菜单？')} onConfirm={() => void remove(record)}>
            <Button type="link" size="small" danger>
              {tCommon('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 页面标题由页签与 document.title 承载，顶部只保留工具栏：主操作居右 */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          icon={<Plus size={15} />}
          onClick={() => {
            setCreating(true)
            setEditing(null)
            setFormOpen(true)
          }}
        >
          {t('新建菜单')}
        </Button>
      </div>
      <Table<MenuTreeNode>
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={tree}
        pagination={false}
        expandable={{ defaultExpandAllRows: true }}
      />
      <MenuForm
        open={formOpen}
        menu={editing}
        parentOptions={parentOptions}
        saving={saving}
        onOk={(values) => void handleFormOk(values)}
        onCancel={() => setFormOpen(false)}
      />
    </div>
  )
}
