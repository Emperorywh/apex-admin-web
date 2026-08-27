/**
 * 用户管理页：分页表格 + 状态筛选 + 新建/编辑/启停用/删除。
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Badge, Button, Card, Popconfirm, Select, Space, Table, Tag, type TablePaginationConfig } from 'antd'
import { Plus } from 'lucide-react'
import { usePageRequest } from '@/hooks/usePageRequest'
import { UserForm } from '@/features/system/user/components/UserForm/UserForm'
import { useUserList } from '@/features/system/user/hooks/useUserList'
import { DEFAULT_PAGE_SIZE } from '@/services/request/request.constants'
import { pageRoles } from '@/services/system/role/role.service'
import { createUser, deleteUser, disableUser, enableUser, updateUser } from '@/services/system/user/user.service'
import { apiErrorMessage } from '@/services/request/request'
import type { RoleOption } from '@/types/system/role/role.types'
import type { UserEntity } from '@/types/system/user/user.types'
import type { UserFormValues } from '@/features/system/user/components/UserForm/UserForm.types'

/** 列表 sort 白名单；后端协议为单参数、逗号分隔、'-' 前缀降序 */
const USER_SORT_FIELDS = ['username', 'displayName', 'createdAt', 'updatedAt'] as const

type UserSortField = (typeof USER_SORT_FIELDS)[number]

/** 排序字段 → 中文标签（作为 i18n key） */
const USER_SORT_LABELS: Record<UserSortField, string> = {
  username: '用户名',
  displayName: '显示名',
  createdAt: '创建时间',
  updatedAt: '更新时间',
}

export default function User() {
  const { t } = useTranslation('system')
  const { t: tCommon } = useTranslation('common')
  const { signal } = usePageRequest()
  const { message } = App.useApp()
  const { items, total, loading, error, query, setQuery, reload } = useUserList()

  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<UserEntity | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    pageRoles({ page: 1, pageSize: 100 }, { signal })
      .then((page) => {
        setRoleOptions(page.items.map((role) => ({ id: role.id, code: role.code, name: role.name })))
      })
      .catch(() => {
        // 角色选项加载失败不阻塞用户列表
      })
  }, [signal])

  const openEdit = (record: UserEntity) => {
    setEditing(record)
    setFormOpen(true)
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const toggleStatus = async (record: UserEntity) => {
    try {
      if (record.status === 'active') await disableUser(record.id)
      else await enableUser(record.id)
      void message.success(t('状态已更新'))
      reload()
    } catch (caught) {
      void message.error(apiErrorMessage(caught) || tCommon('操作失败，请稍后重试'))
    }
  }

  const remove = async (record: UserEntity) => {
    try {
      await deleteUser(record.id)
      void message.success(t('用户已删除'))
      reload()
    } catch (caught) {
      void message.error(apiErrorMessage(caught) || tCommon('操作失败，请稍后重试'))
    }
  }

  const columns = [
    { title: t('用户名'), dataIndex: 'username', width: 130 },
    { title: t('显示名'), dataIndex: 'displayName', width: 120 },
    {
      title: t('邮箱'),
      dataIndex: 'email',
      width: 200,
      render: (value: string | null) => value ?? '—',
    },
    {
      title: t('角色'),
      dataIndex: 'roleCodes',
      width: 180,
      render: (codes: string[]) =>
        codes.length > 0 ? (
          <>
            {codes.map((code) => (
              <Tag key={code}>{code}</Tag>
            ))}
          </>
        ) : (
          '—'
        ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 90,
      render: (status: UserEntity['status']) => (
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
      width: 200,
      render: (_: unknown, record: UserEntity) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            {tCommon('编辑')}
          </Button>
          <Button type="link" size="small" onClick={() => void toggleStatus(record)}>
            {record.status === 'active' ? t('停用') : t('启用')}
          </Button>
          <Popconfirm title={t('确认删除该用户？')} onConfirm={() => void remove(record)}>
            <Button type="link" size="small" danger>
              {tCommon('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const handleFormOk = useCallback(
    async (values: UserFormValues) => {
      setSaving(true)
      try {
        if (editing === null) {
          await createUser({
            username: values.username,
            password: values.password ?? '',
            displayName: values.displayName,
            email: values.email || null,
            roleCodes: values.roleCodes ?? [],
          })
          void message.success(t('用户已创建'))
        } else {
          await updateUser(editing.id, {
            displayName: values.displayName,
            email: values.email || null,
            roleCodes: values.roleCodes ?? [],
          })
          void message.success(t('用户已更新'))
        }
        setFormOpen(false)
        reload()
      } catch (caught) {
        void message.error(apiErrorMessage(caught) || tCommon('操作失败，请稍后重试'))
      } finally {
        setSaving(false)
      }
    },
    [editing, message, reload, t, tCommon],
  )

  const pagination: TablePaginationConfig = {
    current: query.page,
    pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
    total,
    showSizeChanger: true,
    onChange: (page, pageSize) => setQuery({ page, pageSize }),
  }

  return (
    <Card
      title={t('用户管理')}
      extra={
        <Button type="primary" icon={<Plus size={15} />} onClick={openCreate}>
          {t('新建用户')}
        </Button>
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
          options={USER_SORT_FIELDS.flatMap((field: UserSortField) => [
            { value: field, label: `${t(USER_SORT_LABELS[field])} ↑` },
            { value: `-${field}`, label: `${t(USER_SORT_LABELS[field])} ↓` },
          ])}
        />
      </Space>
      {error ? (
        <div style={{ marginBottom: 12 }}>
          <Button danger size="small" onClick={reload}>
            {tCommon('加载失败，点击重试')}
          </Button>
        </div>
      ) : null}
      <Table<UserEntity>
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={pagination}
      />
      <UserForm
        open={formOpen}
        user={editing}
        roleOptions={roleOptions}
        saving={saving}
        onOk={(values) => void handleFormOk(values)}
        onCancel={() => setFormOpen(false)}
      />
    </Card>
  )
}
