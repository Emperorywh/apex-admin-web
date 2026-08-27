/**
 * 角色管理页：分页表格 + 新建/编辑/启停用/删除（写权限门控）。
 * 权限分配端点后端暂缺，仅详情展示权限码（SPEC 约定只读）。
 */

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Badge, Button, Card, Drawer, Popconfirm, Select, Space, Table, Tag, type TablePaginationConfig } from 'antd'
import { Plus } from 'lucide-react'
import { DEFAULT_PAGE_SIZE } from '@/constants/request.constants'
import { PERMISSION_CODES } from '@/constants/permission.constants'
import { ROLE_SORT_FIELDS } from '@/constants/system/role/role.constants'
import { useAuth } from '@/hooks/useAuth'
import { usePageRequest } from '@/hooks/usePageRequest'
import { RoleForm } from '@/features/system/role/components/RoleForm/RoleForm'
import { useRoleList } from '@/features/system/role/hooks/useRoleList'
import { createRole, deleteRole, disableRole, enableRole, getRole, updateRole } from '@/services/system/role/role.service'
import { apiErrorMessage } from '@/services/request/request'
import type { RoleEntity } from '@/types/system/role/role.types'
import type { RoleFormValues } from '@/features/system/role/components/RoleForm/RoleForm'
import type { RoleSortField } from '@/constants/system/role/role.constants'

/** 排序字段 → 中文标签（作为 i18n key） */
const ROLE_SORT_LABELS: Record<RoleSortField, string> = {
  code: '角色编码',
  name: '角色名称',
  createdAt: '创建时间',
  updatedAt: '更新时间',
}

export default function Role() {
  const { t } = useTranslation('system')
  const { t: tCommon } = useTranslation('common')
  const { hasAuth } = useAuth()
  const { signal } = usePageRequest()
  const { message } = App.useApp()
  const { items, total, loading, query, setQuery, reload } = useRoleList()
  const canWrite = hasAuth(PERMISSION_CODES.RBAC_ROLE_WRITE)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RoleEntity | null>(null)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<RoleEntity | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const openDetail = useCallback(
    (record: RoleEntity) => {
      getRole(record.id, { signal })
        .then((entity) => {
          setDetail(entity)
          setDetailOpen(true)
        })
        .catch((caught) => {
          void message.error(apiErrorMessage(caught) || tCommon('操作失败，请稍后重试'))
        })
    },
    [message, signal, tCommon],
  )

  const toggleStatus = async (record: RoleEntity) => {
    try {
      if (record.status === 'active') await disableRole(record.id)
      else await enableRole(record.id)
      void message.success(t('状态已更新'))
      reload()
    } catch (caught) {
      void message.error(apiErrorMessage(caught) || tCommon('操作失败，请稍后重试'))
    }
  }

  const remove = async (record: RoleEntity) => {
    try {
      await deleteRole(record.id)
      void message.success(t('角色已删除'))
      reload()
    } catch (caught) {
      void message.error(apiErrorMessage(caught) || tCommon('操作失败，请稍后重试'))
    }
  }

  const handleFormOk = async (values: RoleFormValues) => {
    setSaving(true)
    try {
      if (editing === null) {
        await createRole({ code: values.code, name: values.name, description: values.description || null })
        void message.success(t('角色已创建'))
      } else {
        await updateRole(editing.id, { name: values.name, description: values.description || null })
        void message.success(t('角色已更新'))
      }
      setFormOpen(false)
      reload()
    } catch (caught) {
      void message.error(apiErrorMessage(caught) || tCommon('操作失败，请稍后重试'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { title: t('角色编码'), dataIndex: 'code', width: 150 },
    { title: t('角色名称'), dataIndex: 'name', width: 140 },
    {
      title: t('描述'),
      dataIndex: 'description',
      ellipsis: true,
      render: (value: string | null) => value ?? '—',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 90,
      render: (status: RoleEntity['status']) => (
        <Badge status={status === 'active' ? 'success' : 'default'} text={status === 'active' ? t('启用') : t('停用')} />
      ),
    },
    {
      title: t('创建时间'),
      dataIndex: 'createdAt',
      width: 170,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: tCommon('操作'),
      key: 'actions',
      width: 240,
      render: (_: unknown, record: RoleEntity) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openDetail(record)}>
            {t('详情')}
          </Button>
          {canWrite ? (
            <>
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setEditing(record)
                  setFormOpen(true)
                }}
              >
                {tCommon('编辑')}
              </Button>
              <Button type="link" size="small" onClick={() => void toggleStatus(record)}>
                {record.status === 'active' ? t('停用') : t('启用')}
              </Button>
              <Popconfirm title={t('确认删除该角色？')} onConfirm={() => void remove(record)}>
                <Button type="link" size="small" danger>
                  {tCommon('删除')}
                </Button>
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ]

  const pagination: TablePaginationConfig = {
    current: query.page,
    pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
    total,
    showSizeChanger: true,
    onChange: (page, pageSize) => setQuery({ page, pageSize }),
  }

  return (
    <Card
      title={t('角色管理')}
      extra={
        canWrite ? (
          <Button
            type="primary"
            icon={<Plus size={15} />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            {t('新建角色')}
          </Button>
        ) : null
      }
      styles={{ body: { paddingTop: 12 } }}
    >
      <Space style={{ marginBottom: 12 }}>
        <Select
          allowClear
          placeholder={t('状态筛选')}
          style={{ width: 140 }}
          value={query.status}
          onChange={(status) => setQuery({ status: status ?? undefined, page: 1 })}
          options={[
            { value: 'active', label: t('启用') },
            { value: 'disabled', label: t('停用') },
          ]}
        />
        <Select
          allowClear
          placeholder={t('排序')}
          style={{ width: 160 }}
          value={query.sort}
          onChange={(sort) => setQuery({ sort: sort ?? undefined, page: 1 })}
          options={ROLE_SORT_FIELDS.flatMap((field: RoleSortField) => [
            { value: field, label: `${t(ROLE_SORT_LABELS[field])} ↑` },
            { value: `-${field}`, label: `${t(ROLE_SORT_LABELS[field])} ↓` },
          ])}
        />
      </Space>
      <Table<RoleEntity> rowKey="id" size="middle" loading={loading} columns={columns} dataSource={items} pagination={pagination} />
      <RoleForm
        open={formOpen}
        role={editing}
        saving={saving}
        onOk={(values) => void handleFormOk(values)}
        onCancel={() => setFormOpen(false)}
      />
      <Drawer title={t('角色详情')} open={detailOpen} onClose={() => setDetailOpen(false)} width={420}>
        {detail ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <strong>{t('角色编码')}：</strong>
              {detail.code}
            </div>
            <div>
              <strong>{t('角色名称')}：</strong>
              {detail.name}
            </div>
            <div>
              <strong>{t('描述')}：</strong>
              {detail.description ?? '—'}
            </div>
            <div>
              <strong>{t('成员数')}：</strong>
              {detail.memberCount ?? '—'}
            </div>
            <div>
              <strong>{t('权限码')}：</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {(detail.permissionCodes ?? []).map((code) => (
                  <Tag key={code}>{code}</Tag>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </Card>
  )
}
