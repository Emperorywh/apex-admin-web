/**
 * 角色管理页面（纯前端模式）：路由 /system/role，页面权限 rbac:role:read。
 * 数据来自 role.demoData.ts 的确定性演示数据，页面在内存集合上完成
 * 关键词/状态筛选 + 白名单排序 + 分页与 CRUD（创建/编辑/启停用/删除）与权限分配，
 * 刷新页面后重置回演示数据；接入真实后端时以 role service 替换数据落地层，
 * 页面交互结构不需调整。
 * isBuiltin 角色禁删与禁停（按钮不渲染，与原后端 409 保护行为一致）；
 * 新增/编辑/启停用/删除/分配权限按钮由 <Auth> 按钮级门控（规格 §5.2），
 * 权限码一律引用 PERMISSIONS 常量，页面不出现权限魔法字符串。
 */
import { useMemo, useState } from 'react'
import { App, Button, Drawer, Input, Select, Space, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { CircleCheck, CircleSlash, Pencil, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { PERMISSIONS } from '@/constants/permission.constants'
import { ROLE_I18N_NAMESPACE, ROLE_SORT_FIELDS } from '@/constants/system/role/role.constants'
import type { RoleSortField } from '@/constants/system/role/role.constants'
import { ROLE_DEMO_LIST, ROLE_DEMO_MEMBER_COUNTS, ROLE_DEMO_PERMISSION_CODES } from '@/constants/system/role/role.demoData'
import { Auth } from '@/components/Auth/Auth'
import { PageCard } from '@/components/PageCard/PageCard'
import { RoleForm } from '@/features/system/role/components/RoleForm/RoleForm'
import type { RoleFormMode, RoleFormSubmitPayload } from '@/features/system/role/components/RoleForm/RoleForm.types'
import { RolePermissionDrawer } from '@/features/system/role/components/RolePermissionDrawer/RolePermissionDrawer'
import type { Role as RoleEntity, RoleStatus } from '@/types/system/role/role.types'

/** 列表创建时间列展示格式（dayjs）；页面私有常量（规格 §3.6） */
const ROLE_TABLE_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm'

/** 每页条数可选项与默认值：演示数据 5 条，默认每页 10 条单页呈现 */
const ROLE_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100']
const ROLE_PAGE_SIZE_DEFAULT = 10

/** 排序方向稳定编码（原请求层 SortOrder 语义，纯前端模式页面自持） */
type ListSortOrder = 'asc' | 'desc'
const SORT_ORDER_ASC: ListSortOrder = 'asc'
const SORT_ORDER_DESC: ListSortOrder = 'desc'

/** 排序字段选项文案 key：与 ROLE_SORT_FIELDS 白名单一一对应 */
const SORT_FIELD_LABEL_KEYS: Record<RoleSortField, string> = {
  code: '角色标识',
  displayName: '角色名称',
  createdAt: '创建时间',
  updatedAt: '更新时间',
}

/** 各排序字段的比较器（升序基准；时间字段按时间戳比较，文本字段按中文拼音） */
const ROLE_FIELD_COMPARATORS: Record<RoleSortField, (a: RoleEntity, b: RoleEntity) => number> = {
  code: (a, b) => a.code.localeCompare(b.code, 'zh-Hans-CN'),
  displayName: (a, b) => a.displayName.localeCompare(b.displayName, 'zh-Hans-CN'),
  createdAt: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  updatedAt: (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
}

/** 状态筛选选项：值即状态稳定编码 */
const STATUS_OPTIONS: Array<{ label: string; value: RoleStatus }> = [
  { label: '启用', value: 'active' },
  { label: '禁用', value: 'disabled' },
]

/** 排序字段选项：白名单字段之外补充「排序值」（角色列表的自然展示序） */
type RoleSortSelection = RoleSortField | 'sortOrder'

/** 列表查询条件：keyword 即时过滤角色标识/角色名称；status 为 undefined 表示全部 */
interface RoleListQuery {
  keyword: string
  status: RoleStatus | undefined
  sortBy: RoleSortSelection
  sortOrder: ListSortOrder
  page: number
  pageSize: number
}

const INITIAL_ROLE_LIST_QUERY: RoleListQuery = {
  keyword: '',
  status: undefined,
  sortBy: 'sortOrder',
  sortOrder: SORT_ORDER_ASC,
  page: 1,
  pageSize: ROLE_PAGE_SIZE_DEFAULT,
}

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
  // 内存数据集：演示数据初始化；权限分配表与成员数随写操作同步更新（刷新重置）
  const [roles, setRoles] = useState<RoleEntity[]>(ROLE_DEMO_LIST)
  const [permissionAssignments, setPermissionAssignments] = useState<Record<string, string[]>>(ROLE_DEMO_PERMISSION_CODES)
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>(ROLE_DEMO_MEMBER_COUNTS)
  const [query, setQuery] = useState<RoleListQuery>(INITIAL_ROLE_LIST_QUERY)
  const [formDrawer, setFormDrawer] = useState<FormDrawerState>(FORM_DRAWER_CLOSED)
  const [permissionDrawerRole, setPermissionDrawerRole] = useState<RoleEntity | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /** 筛选 + 排序后的全集（不含分页）；默认按 sortOrder 展示需在白名单外补充 */
  const filteredRoles = useMemo(() => {
    const keyword = query.keyword.trim().toLowerCase()
    let items = roles
    if (query.status !== undefined) {
      items = items.filter((role) => role.status === query.status)
    }
    if (keyword.length > 0) {
      items = items.filter((role) =>
        [role.code, role.displayName].some((value) => value.toLowerCase().includes(keyword)),
      )
    }
    if (query.sortBy === 'sortOrder') {
      return [...items].sort((a, b) =>
        query.sortOrder === SORT_ORDER_ASC ? a.sortOrder - b.sortOrder : b.sortOrder - a.sortOrder,
      )
    }
    const direction = query.sortOrder === SORT_ORDER_ASC ? 1 : -1
    const compare = ROLE_FIELD_COMPARATORS[query.sortBy]
    return [...items].sort((a, b) => compare(a, b) * direction)
  }, [roles, query])

  /** 分页：删除/筛选导致当前页越界时回退到最后一页 */
  const total = filteredRoles.length
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  const safePage = Math.min(query.page, totalPages)
  const pageRoles = useMemo(
    () => filteredRoles.slice((safePage - 1) * query.pageSize, safePage * query.pageSize),
    [filteredRoles, safePage, query.pageSize],
  )

  const patchQuery = (patch: Partial<RoleListQuery>): void => {
    setQuery((prev) => ({ ...prev, ...patch }))
  }

  const closeFormDrawer = (): void => {
    setFormDrawer(FORM_DRAWER_CLOSED)
  }

  const handleFormSubmit = async (payload: RoleFormSubmitPayload): Promise<void> => {
    setSubmitting(true)
    try {
      const nowIso = new Date().toISOString()
      if (payload.mode === 'create') {
        const draft = payload.draft
        const created: RoleEntity = {
          id: crypto.randomUUID(),
          code: draft.code,
          displayName: draft.displayName,
          description: draft.description ?? null,
          status: 'active',
          isBuiltin: false,
          sortOrder: draft.sortOrder,
          createdAt: nowIso,
          updatedAt: nowIso,
        }
        setRoles((prev) => [...prev, created])
        setPermissionAssignments((prev) => ({ ...prev, [created.id]: [] }))
        setMemberCounts((prev) => ({ ...prev, [created.id]: 0 }))
        message.success(t('创建角色成功'))
      } else {
        const target = formDrawer.role
        if (target !== null) {
          const draft = payload.draft
          setRoles((prev) =>
            prev.map((role) => (role.id === target.id ? { ...role, ...draft, updatedAt: nowIso } : role)),
          )
          message.success(t('保存成功'))
        }
      }
      closeFormDrawer()
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = (target: RoleEntity): void => {
    const nextStatus: RoleStatus = target.status === 'active' ? 'disabled' : 'active'
    setRoles((prev) =>
      prev.map((role) =>
        role.id === target.id ? { ...role, status: nextStatus, updatedAt: new Date().toISOString() } : role,
      ),
    )
    message.success(nextStatus === 'active' ? t('启用成功') : t('禁用成功'))
  }

  const confirmDelete = (target: RoleEntity): void => {
    modal.confirm({
      title: t('删除角色'),
      content: t('确定要删除角色「{{name}}」吗？删除后不可恢复。', { name: target.displayName }),
      okText: t('确认删除'),
      okButtonProps: { danger: true },
      cancelText: t('取消'),
      onOk: async () => {
        setRoles((prev) => prev.filter((role) => role.id !== target.id))
        setPermissionAssignments((prev) => {
          const next = { ...prev }
          delete next[target.id]
          return next
        })
        setMemberCounts((prev) => {
          const next = { ...prev }
          delete next[target.id]
          return next
        })
        message.success(t('删除成功'))
      },
    })
  }

  const handleAssignPermissions = async (permissionCodes: string[]): Promise<void> => {
    const target = permissionDrawerRole
    if (target === null) {
      return
    }
    setSubmitting(true)
    try {
      setPermissionAssignments((prev) => ({ ...prev, [target.id]: [...permissionCodes] }))
      message.success(t('保存成功'))
      setPermissionDrawerRole(null)
    } finally {
      setSubmitting(false)
    }
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
            <Button
              type="link"
              size="small"
              icon={<Pencil size={14} />}
              onClick={() => setFormDrawer({ open: true, mode: 'edit', role: record })}
            >
              {t('编辑')}
            </Button>
          </Auth>
          {/* isBuiltin 角色受保护不可启停（原后端 RBAC.BUILTIN_ROLE_PROTECTED）：入口不渲染 */}
          {!record.isBuiltin && (
            <Auth code={PERMISSIONS.SYSTEM_ROLE_UPDATE}>
              <Button
                type="link"
                size="small"
                icon={record.status === 'active' ? <CircleSlash size={14} /> : <CircleCheck size={14} />}
                onClick={() => toggleStatus(record)}
              >
                {record.status === 'active' ? t('禁用', { context: 'button' }) : t('启用', { context: 'button' })}
              </Button>
            </Auth>
          )}
          <Auth code={PERMISSIONS.SYSTEM_ROLE_ASSIGN_PERMISSION}>
            <Button
              type="link"
              size="small"
              icon={<ShieldCheck size={14} />}
              onClick={() => setPermissionDrawerRole(record)}
            >
              {t('分配权限')}
            </Button>
          </Auth>
          {/* isBuiltin 角色禁止删除：删除入口不渲染（与原后端 409 保护行为一致） */}
          {!record.isBuiltin && (
            <Auth code={PERMISSIONS.SYSTEM_ROLE_DELETE}>
              <Button type="link" size="small" danger icon={<Trash2 size={14} />} onClick={() => confirmDelete(record)}>
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
            <Input
              allowClear
              prefix={<Search size={14} />}
              placeholder={t('搜索角色标识或角色名称')}
              value={query.keyword}
              onChange={(event) => patchQuery({ keyword: event.target.value, page: 1 })}
              style={{ width: 220 }}
            />
            <Select<RoleStatus | undefined>
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
            <Select<RoleSortSelection>
              placeholder={t('排序字段')}
              value={query.sortBy}
              onChange={(value) => patchQuery({ sortBy: value, page: 1 })}
              style={{ width: 160 }}
              options={[
                { label: t('排序值'), value: 'sortOrder' },
                ...ROLE_SORT_FIELDS.map((field) => ({ label: t(SORT_FIELD_LABEL_KEYS[field]), value: field })),
              ]}
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
            <Button onClick={() => setQuery(INITIAL_ROLE_LIST_QUERY)}>{t('重置')}</Button>
            <Auth code={PERMISSIONS.SYSTEM_ROLE_CREATE}>
              <Button
                type="primary"
                icon={<Plus size={14} />}
                onClick={() => setFormDrawer({ open: true, mode: 'create', role: null })}
              >
                {t('新增角色')}
              </Button>
            </Auth>
          </Space>
        }
      >
        <Table<RoleEntity>
          rowKey="id"
          columns={columns}
          dataSource={pageRoles}
          pagination={{
            current: safePage,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ROLE_PAGE_SIZE_OPTIONS,
            onChange: (page, pageSize) => patchQuery({ page, pageSize }),
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
      {/* key 按目标角色重建抽屉组件：初始勾选随目标角色当前权限重置 */}
      <RolePermissionDrawer
        key={permissionDrawerRole?.id ?? 'closed'}
        open={permissionDrawerRole !== null}
        role={permissionDrawerRole}
        assignedCodes={permissionDrawerRole !== null ? (permissionAssignments[permissionDrawerRole.id] ?? []) : []}
        memberCount={permissionDrawerRole !== null ? (memberCounts[permissionDrawerRole.id] ?? 0) : 0}
        submitting={submitting}
        onSubmit={handleAssignPermissions}
        onClose={() => setPermissionDrawerRole(null)}
      />
    </div>
  )
}
