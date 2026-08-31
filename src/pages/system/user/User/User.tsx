/**
 * 用户管理页面（纯前端模式）：路由 /system/user，页面权限 system:user:read。
 * 数据来自 user.demoData.ts 的确定性演示数据，页面在内存集合上完成
 * 关键词/状态筛选 + 白名单排序 + 分页与 CRUD（创建/编辑/启停用/删除）与角色分配，
 * 刷新页面后重置回演示数据；接入真实后端时以 user service 替换数据落地层，
 * 页面交互结构不需调整。
 * 新增/编辑/启停用/删除/分配角色按钮由 <Auth> 按钮级门控（规格 §5.2），
 * 权限码一律引用 PERMISSIONS 常量，页面不出现权限魔法字符串。
 */
import { useMemo, useState } from 'react'
import { App, Button, Drawer, Input, Select, Space, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { CircleCheck, CircleSlash, Pencil, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { PERMISSIONS } from '@/constants/permission.constants'
import { USER_I18N_NAMESPACE, USER_SORT_FIELDS } from '@/constants/system/user/user.constants'
import type { UserSortField } from '@/constants/system/user/user.constants'
import { ROLE_DEMO_LIST } from '@/constants/system/role/role.demoData'
import { USER_DEMO_LIST, USER_DEMO_ROLE_CODES } from '@/constants/system/user/user.demoData'
import { Auth } from '@/components/Auth/Auth'
import { PageCard } from '@/components/PageCard/PageCard'
import { UserForm } from '@/features/system/user/components/UserForm/UserForm'
import type { UserFormMode, UserFormSubmitPayload } from '@/features/system/user/components/UserForm/UserForm.types'
import { UserRoleDrawer } from '@/features/system/user/components/UserRoleDrawer/UserRoleDrawer'
import type { User as UserEntity, UserStatus } from '@/types/system/user/user.types'

/** 列表时间列展示格式（dayjs）；页面私有常量（规格 §3.6） */
const USER_TABLE_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm'

/** 每页条数可选项与默认值：演示数据 20 条，默认每页 10 条以呈现分页形态 */
const USER_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100']
const USER_PAGE_SIZE_DEFAULT = 10

/** 排序方向稳定编码（原请求层 SortOrder 语义，纯前端模式页面自持） */
type ListSortOrder = 'asc' | 'desc'
const SORT_ORDER_ASC: ListSortOrder = 'asc'
const SORT_ORDER_DESC: ListSortOrder = 'desc'

/** 排序字段选项文案 key：与 USER_SORT_FIELDS 白名单一一对应 */
const SORT_FIELD_LABEL_KEYS: Record<UserSortField, string> = {
  username: '用户名',
  displayName: '显示名称',
  createdAt: '创建时间',
  updatedAt: '更新时间',
}

/** 各排序字段的比较器（升序基准；时间字段按时间戳比较，文本字段按中文拼音） */
const USER_FIELD_COMPARATORS: Record<UserSortField, (a: UserEntity, b: UserEntity) => number> = {
  username: (a, b) => a.username.localeCompare(b.username, 'zh-Hans-CN'),
  displayName: (a, b) => a.displayName.localeCompare(b.displayName, 'zh-Hans-CN'),
  createdAt: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  updatedAt: (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
}

/** 状态筛选选项：值即状态稳定编码 */
const STATUS_OPTIONS: Array<{ label: string; value: UserStatus }> = [
  { label: '启用', value: 'active' },
  { label: '禁用', value: 'disabled' },
]

/** 列表查询条件：keyword 即时过滤用户名/显示名称/邮箱；status 为 undefined 表示全部 */
interface UserListQuery {
  keyword: string
  status: UserStatus | undefined
  sortBy: UserSortField
  sortOrder: ListSortOrder
  page: number
  pageSize: number
}

const INITIAL_USER_LIST_QUERY: UserListQuery = {
  keyword: '',
  status: undefined,
  sortBy: 'createdAt',
  sortOrder: SORT_ORDER_DESC,
  page: 1,
  pageSize: USER_PAGE_SIZE_DEFAULT,
}

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
  // 内存数据集：演示数据初始化，全部写操作仅落在页面状态（刷新重置）
  const [users, setUsers] = useState<UserEntity[]>(USER_DEMO_LIST)
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string[]>>(USER_DEMO_ROLE_CODES)
  const [query, setQuery] = useState<UserListQuery>(INITIAL_USER_LIST_QUERY)
  const [formDrawer, setFormDrawer] = useState<FormDrawerState>(FORM_DRAWER_CLOSED)
  const [roleDrawerUser, setRoleDrawerUser] = useState<UserEntity | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /** 筛选 + 排序后的全集（不含分页） */
  const filteredUsers = useMemo(() => {
    const keyword = query.keyword.trim().toLowerCase()
    let items = users
    if (query.status !== undefined) {
      items = items.filter((user) => user.status === query.status)
    }
    if (keyword.length > 0) {
      items = items.filter((user) =>
        [user.username, user.displayName, user.email ?? ''].some((value) => value.toLowerCase().includes(keyword)),
      )
    }
    const direction = query.sortOrder === SORT_ORDER_ASC ? 1 : -1
    const compare = USER_FIELD_COMPARATORS[query.sortBy]
    return [...items].sort((a, b) => compare(a, b) * direction)
  }, [users, query])

  /** 分页：删除/筛选导致当前页越界时回退到最后一页 */
  const total = filteredUsers.length
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  const safePage = Math.min(query.page, totalPages)
  const pageUsers = useMemo(
    () => filteredUsers.slice((safePage - 1) * query.pageSize, safePage * query.pageSize),
    [filteredUsers, safePage, query.pageSize],
  )

  const patchQuery = (patch: Partial<UserListQuery>): void => {
    setQuery((prev) => ({ ...prev, ...patch }))
  }

  const closeFormDrawer = (): void => {
    setFormDrawer(FORM_DRAWER_CLOSED)
  }

  const handleFormSubmit = async (payload: UserFormSubmitPayload): Promise<void> => {
    setSubmitting(true)
    try {
      const nowIso = new Date().toISOString()
      if (payload.mode === 'create') {
        const draft = payload.draft
        const created: UserEntity = {
          id: crypto.randomUUID(),
          username: draft.username,
          displayName: draft.displayName,
          status: 'active',
          phone: draft.phone ?? null,
          email: draft.email ?? null,
          lastLoginAt: null,
          passwordUpdatedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
          department: null,
          posts: [],
        }
        setUsers((prev) => [created, ...prev])
        setRoleAssignments((prev) => ({ ...prev, [created.id]: [] }))
        message.success(t('创建用户成功'))
      } else {
        const target = formDrawer.user
        if (target !== null) {
          const draft = payload.draft
          setUsers((prev) =>
            prev.map((user) =>
              user.id === target.id ? { ...user, ...draft, updatedAt: nowIso } : user,
            ),
          )
          message.success(t('保存成功'))
        }
      }
      closeFormDrawer()
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = (target: UserEntity): void => {
    const nextStatus: UserStatus = target.status === 'active' ? 'disabled' : 'active'
    setUsers((prev) =>
      prev.map((user) => (user.id === target.id ? { ...user, status: nextStatus, updatedAt: new Date().toISOString() } : user)),
    )
    message.success(nextStatus === 'active' ? t('启用成功') : t('禁用成功'))
  }

  const confirmDelete = (target: UserEntity): void => {
    modal.confirm({
      title: t('删除用户'),
      content: t('确定要删除用户「{{name}}」吗？删除后不可恢复。', { name: target.displayName }),
      okText: t('确认删除'),
      okButtonProps: { danger: true },
      cancelText: t('取消'),
      onOk: async () => {
        setUsers((prev) => prev.filter((user) => user.id !== target.id))
        setRoleAssignments((prev) => {
          const next = { ...prev }
          delete next[target.id]
          return next
        })
        message.success(t('删除成功'))
      },
    })
  }

  const handleAssignRoles = async (roleCodes: string[]): Promise<void> => {
    const target = roleDrawerUser
    if (target === null) {
      return
    }
    setSubmitting(true)
    try {
      setRoleAssignments((prev) => ({ ...prev, [target.id]: [...roleCodes] }))
      message.success(t('保存成功'))
      setRoleDrawerUser(null)
    } finally {
      setSubmitting(false)
    }
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
            <Button
              type="link"
              size="small"
              icon={<Pencil size={14} />}
              onClick={() => setFormDrawer({ open: true, mode: 'edit', user: record })}
            >
              {t('编辑')}
            </Button>
          </Auth>
          <Auth code={PERMISSIONS.SYSTEM_USER_UPDATE}>
            <Button
              type="link"
              size="small"
              icon={record.status === 'active' ? <CircleSlash size={14} /> : <CircleCheck size={14} />}
              onClick={() => toggleStatus(record)}
            >
              {record.status === 'active' ? t('禁用', { context: 'button' }) : t('启用', { context: 'button' })}
            </Button>
          </Auth>
          <Auth code={PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE}>
            <Button type="link" size="small" icon={<ShieldCheck size={14} />} onClick={() => setRoleDrawerUser(record)}>
              {t('分配角色')}
            </Button>
          </Auth>
          <Auth code={PERMISSIONS.SYSTEM_USER_DELETE}>
            <Button type="link" size="small" danger icon={<Trash2 size={14} />} onClick={() => confirmDelete(record)}>
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
            <Input
              allowClear
              prefix={<Search size={14} />}
              placeholder={t('搜索用户名、显示名称或邮箱')}
              value={query.keyword}
              onChange={(event) => patchQuery({ keyword: event.target.value, page: 1 })}
              style={{ width: 240 }}
            />
            <Select<UserStatus | undefined>
              allowClear
              placeholder={t('全部状态')}
              value={query.status}
              onChange={(value) => patchQuery({ status: value, page: 1 })}
              style={{ width: 140 }}
              options={STATUS_OPTIONS.map((option) => ({
                label: t(option.label, { context: 'status' }),
                value: option.value,
              }))}
            />
            <Select<UserSortField>
              placeholder={t('排序字段')}
              value={query.sortBy}
              onChange={(value) => patchQuery({ sortBy: value, page: 1 })}
              style={{ width: 160 }}
              options={USER_SORT_FIELDS.map((field) => ({ label: t(SORT_FIELD_LABEL_KEYS[field]), value: field }))}
            />
            <Select<ListSortOrder>
              placeholder={t('排序方向')}
              value={query.sortOrder}
              onChange={(value) => patchQuery({ sortOrder: value, page: 1 })}
              style={{ width: 120 }}
              options={[
                { label: t('升序'), value: SORT_ORDER_ASC },
                { label: t('降序'), value: SORT_ORDER_DESC },
              ]}
            />
            <Button onClick={() => setQuery(INITIAL_USER_LIST_QUERY)}>{t('重置')}</Button>
            <Auth code={PERMISSIONS.SYSTEM_USER_CREATE}>
              <Button
                type="primary"
                icon={<Plus size={14} />}
                onClick={() => setFormDrawer({ open: true, mode: 'create', user: null })}
              >
                {t('新增用户')}
              </Button>
            </Auth>
          </Space>
        }
      >
        <Table<UserEntity>
          rowKey="id"
          columns={columns}
          dataSource={pageUsers}
          pagination={{
            current: safePage,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: USER_PAGE_SIZE_OPTIONS,
            onChange: (page, pageSize) => patchQuery({ page, pageSize }),
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
        roles={ROLE_DEMO_LIST}
        assignedRoleCodes={roleDrawerUser !== null ? (roleAssignments[roleDrawerUser.id] ?? []) : []}
        submitting={submitting}
        onSubmit={handleAssignRoles}
        onClose={() => setRoleDrawerUser(null)}
      />
    </div>
  )
}
