/**
 * 用户管理页面（对齐真实后端 identity 接口）：路由 /system/user，页面权限 system:user:read。
 * status 筛选 + sort 白名单排序 + 分页（默认 20、最大 100、前端显式 createdAt desc）由 useUserList
 * 承担（§17.24 竞态防护）；表格 + Drawer CRUD（创建/编辑契约差异见 UserForm，状态变更走
 * POST /users/:id/enable|disable），分配角色独立 Drawer（PUT /users/:id/roles，roleCodes 全量替换）；
 * 新增/编辑/启停用/删除/分配角色按钮由 <Auth> 按钮级门控（规格 §5.2），viewer 下隐藏，
 * 权限码一律引用 PERMISSIONS 常量，页面不出现权限魔法字符串。
 */
import { useEffect, useState } from 'react'
import { App, Button, Drawer, Select, Space, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { CircleCheck, CircleSlash, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { DEFAULT_SORT_BY, DEFAULT_SORT_ORDER, PAGE_SIZE_MAX, SORT_ORDERS } from '@/constants/request.constants'
import type { SortOrder as ListSortOrder } from '@/constants/request.constants'
import { PERMISSIONS } from '@/constants/permission.constants'
import { USER_I18N_NAMESPACE, USER_SORT_FIELDS } from '@/constants/system/user/user.constants'
import type { UserSortField } from '@/constants/system/user/user.constants'
import { Auth } from '@/components/Auth/Auth'
import { PageCard } from '@/components/PageCard/PageCard'
import { UserForm } from '@/features/system/user/components/UserForm/UserForm'
import type { UserFormMode, UserFormSubmitPayload } from '@/features/system/user/components/UserForm/UserForm.types'
import { UserRoleDrawer } from '@/features/system/user/components/UserRoleDrawer/UserRoleDrawer'
import { useUserList } from '@/features/system/user/hooks/useUserList'
import { usePageRequest } from '@/hooks/usePageRequest'
import { listRoles } from '@/services/system/role/role.service'
import {
  assignUserRoles,
  createUser,
  deleteUser,
  disableUser,
  enableUser,
  updateUser,
} from '@/services/system/user/user.service'
import type { Role } from '@/types/system/role/role.types'
import type { User as UserEntity, UserStatus } from '@/types/system/user/user.types'

/** 列表时间列展示格式（dayjs）；页面私有常量（规格 §3.6） */
const USER_TABLE_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm'

/** 每页条数可选项：全部不超过分页上限（后端 pageSize 最大 100） */
const USER_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100']

/** 排序字段选项文案 key：与 USER_SORT_FIELDS 白名单一一对应 */
const SORT_FIELD_LABEL_KEYS: Record<UserSortField, string> = {
  username: '用户名',
  displayName: '显示名称',
  createdAt: '创建时间',
  updatedAt: '更新时间',
}

/** 状态筛选选项：值即后端稳定编码 */
const STATUS_OPTIONS: Array<{ label: string; value: UserStatus }> = [
  { label: '启用', value: 'active' },
  { label: '禁用', value: 'disabled' },
]

/** 表单 Drawer 开合状态：mode + 编辑目标（创建模式 user 为 null） */
interface FormDrawerState {
  open: boolean
  mode: UserFormMode
  user: UserEntity | null
}

const FORM_DRAWER_CLOSED: FormDrawerState = { open: false, mode: 'create', user: null }

export function User() {
  const { t } = useTranslation(USER_I18N_NAMESPACE)
  const { message, modal } = App.useApp()
  const pageRequest = usePageRequest()
  const list = useUserList()
  // 可选角色集合：分配角色 Drawer 共用；一次性加载（角色数量远小于分页上限）
  const [roles, setRoles] = useState<Role[]>([])
  const [formDrawer, setFormDrawer] = useState<FormDrawerState>(FORM_DRAWER_CLOSED)
  const [roleDrawerUser, setRoleDrawerUser] = useState<UserEntity | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [roleSubmitting, setRoleSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    void listRoles({ page: 1, pageSize: PAGE_SIZE_MAX }, pageRequest)
      .then((page) => {
        if (alive) {
          setRoles(page.items)
        }
      })
      .catch(() => {
        // 角色加载失败的提示由请求层统一弹出；角色选项保持为空，不阻塞用户列表
      })
    return () => {
      alive = false
    }
  }, [pageRequest])

  const closeFormDrawer = (): void => {
    setFormDrawer(FORM_DRAWER_CLOSED)
  }

  const handleFormSubmit = async (payload: UserFormSubmitPayload): Promise<void> => {
    setSubmitting(true)
    try {
      if (payload.mode === 'create') {
        // silent：字段映射与页面级错误由 UserForm 呈现（规格 §7.4-3/§14.4）
        await createUser(payload.dto, { silent: true })
        message.success(t('创建用户成功'))
      } else {
        const target = formDrawer.user
        if (target !== null) {
          await updateUser(target.id, payload.dto, { silent: true })
          message.success(t('保存成功'))
        }
      }
      closeFormDrawer()
      list.reload()
    } finally {
      setSubmitting(false)
    }
  }

  const handleAssignRoles = async (roleCodes: string[]): Promise<void> => {
    const target = roleDrawerUser
    if (target === null) {
      return
    }
    setRoleSubmitting(true)
    try {
      await assignUserRoles(target.id, { roleCodes }, { silent: true })
      message.success(t('保存成功'))
      setRoleDrawerUser(null)
      list.reload()
    } finally {
      setRoleSubmitting(false)
    }
  }

  const toggleStatus = (target: UserEntity): void => {
    // 非 silent：启停用失败（如重复启停 409）由请求层统一弹出错误提示
    const action =
      target.status === 'active'
        ? disableUser(target.id).then(() => t('禁用成功'))
        : enableUser(target.id).then(() => t('启用成功'))
    void action
      .then((successText) => {
        message.success(successText)
        list.reload()
      })
      .catch(() => {
        // 吞掉 rejection；失败提示已由请求层弹出
      })
  }

  const confirmDelete = (target: UserEntity): void => {
    modal.confirm({
      title: t('删除用户'),
      content: t('确定要删除用户「{{name}}」吗？删除后不可恢复。', { name: target.displayName }),
      okText: t('确认删除'),
      okButtonProps: { danger: true },
      cancelText: t('取消'),
      onOk: async () => {
        try {
          // 非 silent：删除失败由请求层统一弹出错误提示
          await deleteUser(target.id)
          message.success(t('删除成功'))
          list.reload()
        } catch {
          // 吞掉 rejection 使确认框正常关闭；失败提示已由请求层弹出
        }
      },
    })
  }

  const columns: TableProps<UserEntity>['columns'] = [
    { title: t('用户名'), dataIndex: 'username', key: 'username' },
    { title: t('显示名称'), dataIndex: 'displayName', key: 'displayName' },
    {
      title: t('邮箱'),
      dataIndex: 'email',
      key: 'email',
      render: (email: string | null) => email ?? '-',
    },
    {
      title: t('手机号'),
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string | null) => phone ?? '-',
    },
    {
      title: t('最近登录'),
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (lastLoginAt: string | null) =>
        lastLoginAt !== null ? dayjs(lastLoginAt).format(USER_TABLE_DATETIME_FORMAT) : '-',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (status: UserEntity['status']) => (
        <Tag color={status === 'active' ? 'success' : 'error'}>
          {status === 'active' ? t('启用', { context: 'status' }) : t('禁用', { context: 'status' })}
        </Tag>
      ),
    },
    {
      title: t('创建时间'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => dayjs(createdAt).format(USER_TABLE_DATETIME_FORMAT),
    },
    {
      title: t('操作'),
      key: 'actions',
      render: (_, record) => (
        <Space size={0}>
          <Auth code={PERMISSIONS.SYSTEM_USER_UPDATE}>
            <Button type="link" icon={<Pencil size={14} />} onClick={() => setFormDrawer({ open: true, mode: 'edit', user: record })}>
              {t('编辑')}
            </Button>
          </Auth>
          <Auth code={PERMISSIONS.SYSTEM_USER_UPDATE}>
            <Button
              type="link"
              icon={record.status === 'active' ? <CircleSlash size={14} /> : <CircleCheck size={14} />}
              onClick={() => toggleStatus(record)}
            >
              {record.status === 'active' ? t('禁用', { context: 'button' }) : t('启用', { context: 'button' })}
            </Button>
          </Auth>
          <Auth code={PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE}>
            <Button type="link" icon={<ShieldCheck size={14} />} onClick={() => setRoleDrawerUser(record)}>
              {t('分配角色')}
            </Button>
          </Auth>
          <Auth code={PERMISSIONS.SYSTEM_USER_DELETE}>
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
      {/* 单卡片合并（SPEC_UI2 §7）：搜索区 + 工具栏 + 表格进同一张纸面白卡 */}
      <PageCard
        search={
          <Space wrap>
            <Select<UserStatus | undefined>
              allowClear
              placeholder={t('全部状态')}
              value={list.query.status}
              onChange={(value) => list.changeStatus(value)}
              style={{ width: 140 }}
              options={STATUS_OPTIONS.map((option) => ({ label: t(option.label, { context: 'status' }), value: option.value }))}
            />
            <Select<UserSortField>
              placeholder={t('排序字段')}
              value={list.query.sortBy}
              onChange={(value) => list.changeSort(value, list.query.sortOrder)}
              style={{ width: 160 }}
              options={USER_SORT_FIELDS.map((field) => ({ label: t(SORT_FIELD_LABEL_KEYS[field]), value: field }))}
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
                list.changeSort(DEFAULT_SORT_BY as UserSortField, DEFAULT_SORT_ORDER)
              }}
            >
              {t('重置')}
            </Button>
            <Auth code={PERMISSIONS.SYSTEM_USER_CREATE}>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setFormDrawer({ open: true, mode: 'create', user: null })}>
                {t('新增用户')}
              </Button>
            </Auth>
          </Space>
        }
      >
        <Table<UserEntity>
          rowKey="id"
          columns={columns}
          dataSource={list.users}
          loading={list.loading}
          pagination={{
            current: list.query.page,
            pageSize: list.query.pageSize,
            total: list.total,
            showSizeChanger: true,
            pageSizeOptions: USER_PAGE_SIZE_OPTIONS,
            onChange: (page, pageSize) => list.changePagination(page, pageSize),
          }}
        />
      </PageCard>
      <Drawer
        title={formDrawer.mode === 'create' ? t('新增用户') : t('编辑用户')}
        placement="right"
        width={440}
        open={formDrawer.open}
        onClose={closeFormDrawer}
        destroyOnHidden
      >
        <UserForm
          mode={formDrawer.mode}
          user={formDrawer.user}
          submitting={submitting}
          onSubmit={handleFormSubmit}
          onCancel={closeFormDrawer}
        />
      </Drawer>
      {/* key 按目标用户重建抽屉组件：初始勾选随目标用户当前角色重置 */}
      <UserRoleDrawer
        key={roleDrawerUser?.id ?? 'closed'}
        open={roleDrawerUser !== null}
        user={roleDrawerUser}
        roles={roles}
        submitting={roleSubmitting}
        onSubmit={handleAssignRoles}
        onClose={() => setRoleDrawerUser(null)}
      />
    </div>
  )
}
