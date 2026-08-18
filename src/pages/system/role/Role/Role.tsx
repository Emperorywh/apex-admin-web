/**
 * 角色管理页面（对齐真实后端 rbac 接口）：路由 /system/role，页面权限 rbac:role:read。
 * status 筛选 + sort 白名单排序 + 分页（默认 20、最大 100、前端显式 createdAt desc）由 useRoleList
 * 承担（§17.24 竞态防护）；表格 + Drawer CRUD（code 创建后不可改、编辑仅
 * displayName/description?/sortOrder 见 RoleForm，状态变更走 POST /roles/:id/enable|disable）；
 * 查看权限独立 Drawer（GET /roles/:id 详情，只读展示权限码全集；分配操作待后端补齐
 * 权限目录端点后接入）；isBuiltin 角色禁删与禁停（按钮不渲染，后端同样返回 409）；
 * 新增/编辑/启停用/删除/查看权限按钮由 <Auth> 按钮级门控（规格 §5.2），viewer 下隐藏，
 * 权限码一律引用 PERMISSIONS 常量，页面不出现权限魔法字符串。
 */
import { useState } from 'react'
import { App, Button, Drawer, Select, Space, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { CircleCheck, CircleSlash, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { DEFAULT_SORT_BY, DEFAULT_SORT_ORDER, SORT_ORDERS } from '@/constants/request.constants'
import type { SortOrder as ListSortOrder } from '@/constants/request.constants'
import { PERMISSIONS } from '@/constants/permission.constants'
import { ROLE_I18N_NAMESPACE, ROLE_SORT_FIELDS } from '@/constants/system/role/role.constants'
import type { RoleSortField } from '@/constants/system/role/role.constants'
import { Auth } from '@/components/Auth/Auth'
import { PageCard } from '@/components/PageCard/PageCard'
import { RoleForm } from '@/features/system/role/components/RoleForm/RoleForm'
import type { RoleFormMode, RoleFormSubmitPayload } from '@/features/system/role/components/RoleForm/RoleForm.types'
import { RolePermissionDrawer } from '@/features/system/role/components/RolePermissionDrawer/RolePermissionDrawer'
import { useRoleList } from '@/features/system/role/hooks/useRoleList'
import {
  createRole,
  deleteRole,
  disableRole,
  enableRole,
  updateRole,
} from '@/services/system/role/role.service'
import type { Role as RoleEntity, RoleStatus } from '@/types/system/role/role.types'

/** 列表创建时间列展示格式（dayjs）；页面私有常量（规格 §3.6） */
const ROLE_TABLE_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm'

/** 每页条数可选项：全部不超过分页上限（后端 pageSize 最大 100） */
const ROLE_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100']

/** 排序字段选项文案 key：与 ROLE_SORT_FIELDS 白名单一一对应 */
const SORT_FIELD_LABEL_KEYS: Record<RoleSortField, string> = {
  code: '角色标识',
  displayName: '角色名称',
  createdAt: '创建时间',
  updatedAt: '更新时间',
}

/** 状态筛选选项：值即后端稳定编码 */
const STATUS_OPTIONS: Array<{ label: string; value: RoleStatus }> = [
  { label: '启用', value: 'active' },
  { label: '禁用', value: 'disabled' },
]

/** 表单 Drawer 开合状态：mode + 编辑目标（创建模式 role 为 null） */
interface FormDrawerState {
  open: boolean
  mode: RoleFormMode
  role: RoleEntity | null
}

const FORM_DRAWER_CLOSED: FormDrawerState = { open: false, mode: 'create', role: null }

export function Role() {
  const { t } = useTranslation(ROLE_I18N_NAMESPACE)
  const { message, modal } = App.useApp()
  const list = useRoleList()
  const [formDrawer, setFormDrawer] = useState<FormDrawerState>(FORM_DRAWER_CLOSED)
  const [permissionDrawerRole, setPermissionDrawerRole] = useState<RoleEntity | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const closeFormDrawer = (): void => {
    setFormDrawer(FORM_DRAWER_CLOSED)
  }

  const handleFormSubmit = async (payload: RoleFormSubmitPayload): Promise<void> => {
    setSubmitting(true)
    try {
      if (payload.mode === 'create') {
        // silent：字段映射与页面级错误由 RoleForm 呈现（规格 §7.4-3/§14.4）
        await createRole(payload.dto, { silent: true })
        message.success(t('创建角色成功'))
      } else {
        const target = formDrawer.role
        if (target !== null) {
          await updateRole(target.id, payload.dto, { silent: true })
          message.success(t('保存成功'))
        }
      }
      closeFormDrawer()
      list.reload()
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = (target: RoleEntity): void => {
    // 非 silent：启停用失败（如内置角色保护 409）由请求层统一弹出错误提示
    const action =
      target.status === 'active'
        ? disableRole(target.id).then(() => t('禁用成功'))
        : enableRole(target.id).then(() => t('启用成功'))
    void action
      .then((successText) => {
        message.success(successText)
        list.reload()
      })
      .catch(() => {
        // 吞掉 rejection；失败提示已由请求层弹出
      })
  }

  const confirmDelete = (target: RoleEntity): void => {
    modal.confirm({
      title: t('删除角色'),
      content: t('确定要删除角色「{{name}}」吗？删除后不可恢复。', { name: target.displayName }),
      okText: t('确认删除'),
      okButtonProps: { danger: true },
      cancelText: t('取消'),
      onOk: async () => {
        try {
          // 非 silent：删除失败（如内置/被引用冲突）由请求层统一弹出错误提示
          await deleteRole(target.id)
          message.success(t('删除成功'))
          list.reload()
        } catch {
          // 吞掉 rejection 使确认框正常关闭；失败提示已由请求层弹出
        }
      },
    })
  }

  const columns: TableProps<RoleEntity>['columns'] = [
    {
      title: t('角色标识'),
      dataIndex: 'code',
      key: 'code',
      render: (code: string, record) => (
        <Space size={4}>
          <span>{code}</span>
          {/* isBuiltin 角色标识：禁改 code、禁删、禁停用的可视提示 */}
          {record.isBuiltin && <Tag>{t('内置')}</Tag>}
        </Space>
      ),
    },
    { title: t('角色名称'), dataIndex: 'displayName', key: 'displayName' },
    {
      title: t('描述'),
      dataIndex: 'description',
      key: 'description',
      render: (description: string | null) => description ?? '-',
    },
    { title: t('排序值'), dataIndex: 'sortOrder', key: 'sortOrder', width: 90 },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (status: RoleEntity['status']) => (
        <Tag color={status === 'active' ? 'success' : 'error'}>
          {status === 'active' ? t('启用', { context: 'status' }) : t('禁用', { context: 'status' })}
        </Tag>
      ),
    },
    {
      title: t('创建时间'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => dayjs(createdAt).format(ROLE_TABLE_DATETIME_FORMAT),
    },
    {
      title: t('操作'),
      key: 'actions',
      render: (_, record) => (
        <Space size={0}>
          <Auth code={PERMISSIONS.SYSTEM_ROLE_UPDATE}>
            <Button type="link" icon={<Pencil size={14} />} onClick={() => setFormDrawer({ open: true, mode: 'edit', role: record })}>
              {t('编辑')}
            </Button>
          </Auth>
          {/* isBuiltin 角色受后端保护不可启停（RBAC.BUILTIN_ROLE_PROTECTED）：入口不渲染 */}
          {!record.isBuiltin && (
            <Auth code={PERMISSIONS.SYSTEM_ROLE_UPDATE}>
              <Button
                type="link"
                icon={record.status === 'active' ? <CircleSlash size={14} /> : <CircleCheck size={14} />}
                onClick={() => toggleStatus(record)}
              >
                {record.status === 'active' ? t('禁用', { context: 'button' }) : t('启用', { context: 'button' })}
              </Button>
            </Auth>
          )}
          <Auth code={PERMISSIONS.SYSTEM_ROLE_ASSIGN_PERMISSION}>
            <Button type="link" icon={<Eye size={14} />} onClick={() => setPermissionDrawerRole(record)}>
              {t('查看权限')}
            </Button>
          </Auth>
          {/* isBuiltin 角色禁止删除：删除入口不渲染；后端同样拒绝 */}
          {!record.isBuiltin && (
            <Auth code={PERMISSIONS.SYSTEM_ROLE_DELETE}>
              <Button type="link" danger icon={<Trash2 size={14} />} onClick={() => confirmDelete(record)}>
                {t('删除')}
              </Button>
            </Auth>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 单卡片合并（SPEC_UI2 §7）：搜索区 + 工具栏 + 表格进同一张纸面白卡 */}
      <PageCard
        search={
          <Space wrap>
            <Select<RoleStatus | undefined>
              allowClear
              placeholder={t('全部状态')}
              value={list.query.status}
              onChange={(value) => list.changeStatus(value)}
              style={{ width: 140 }}
              options={STATUS_OPTIONS.map((option) => ({ label: t(option.label, { context: 'status' }), value: option.value }))}
            />
            <Select<RoleSortField>
              placeholder={t('排序字段')}
              value={list.query.sortBy}
              onChange={(value) => list.changeSort(value, list.query.sortOrder)}
              style={{ width: 160 }}
              options={ROLE_SORT_FIELDS.map((field) => ({ label: t(SORT_FIELD_LABEL_KEYS[field]), value: field }))}
            />
            <Select<ListSortOrder>
              placeholder={t('排序方向')}
              value={list.query.sortOrder}
              onChange={(value) => list.changeSort(list.query.sortBy, value)}
              style={{ width: 120 }}
              options={[
                { label: t('升序'), value: SORT_ORDERS.ASC },
                { label: t('降序'), value: SORT_ORDERS.DESC },
              ]}
            />
            <Button
              onClick={() => {
                list.changeStatus(undefined)
                list.changeSort(DEFAULT_SORT_BY as RoleSortField, DEFAULT_SORT_ORDER)
              }}
            >
              {t('重置')}
            </Button>
            <Auth code={PERMISSIONS.SYSTEM_ROLE_CREATE}>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setFormDrawer({ open: true, mode: 'create', role: null })}>
                {t('新增角色')}
              </Button>
            </Auth>
          </Space>
        }
      >
        <Table<RoleEntity>
          rowKey="id"
          columns={columns}
          dataSource={list.roles}
          loading={list.loading}
          pagination={{
            current: list.query.page,
            pageSize: list.query.pageSize,
            total: list.total,
            showSizeChanger: true,
            pageSizeOptions: ROLE_PAGE_SIZE_OPTIONS,
            onChange: (page, pageSize) => list.changePagination(page, pageSize),
          }}
        />
      </PageCard>
      <Drawer
        title={formDrawer.mode === 'create' ? t('新增角色') : t('编辑角色')}
        placement="right"
        width={440}
        open={formDrawer.open}
        onClose={closeFormDrawer}
        destroyOnHidden
      >
        <RoleForm
          mode={formDrawer.mode}
          role={formDrawer.role}
          submitting={submitting}
          onSubmit={handleFormSubmit}
          onCancel={closeFormDrawer}
        />
      </Drawer>
      {/* key 按目标角色重建抽屉组件：权限详情随目标角色重新拉取 */}
      <RolePermissionDrawer
        key={permissionDrawerRole?.id ?? 'closed'}
        open={permissionDrawerRole !== null}
        role={permissionDrawerRole}
        onClose={() => setPermissionDrawerRole(null)}
      />
    </div>
  )
}
