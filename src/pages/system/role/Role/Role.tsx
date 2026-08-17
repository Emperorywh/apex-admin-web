/**
 * 角色管理页面（规格 §14.2/§14.3）：路由 /system/role，页面权限 system:role:list。
 * keyword 查询（去空白、不区分大小写包含 code/name）+ sortBy/sortOrder 白名单排序
 * + 分页（默认 10、最大 100、未传 sortBy 按 createdAt desc）由 useRoleList 承担（§17.24 竞态防护）；
 * 表格 + Drawer CRUD（code 创建后不可改、编辑仅 name/description?/status 见 RoleForm）、
 * 分配权限独立 Drawer（权限树勾选，PUT /roles/:id/permissions）；builtIn 角色禁删（按钮不渲染，
 * 后端同样返回 RESOURCE_CONFLICT）；新增/编辑/删除/分配权限按钮由 <Auth> 按钮级门控（规格 §5.2），
 * viewer 下隐藏，权限码一律引用 PERMISSIONS 常量，页面不出现权限魔法字符串。
 */
import { useEffect, useState } from 'react'
import { App, Button, Drawer, Input, Select, Space, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { SORT_ORDERS } from '@/constants/request.constants'
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
import { usePageRequest } from '@/hooks/usePageRequest'
import {
  assignRolePermissions,
  createRole,
  deleteRole,
  getPermissionTree,
  updateRole,
} from '@/services/system/role/role.service'
import type { PermissionNode, Role as RoleEntity } from '@/types/system/role/role.types'

/** 列表创建时间列展示格式（dayjs）；页面私有常量（规格 §3.6） */
const ROLE_TABLE_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm'

/** 每页条数可选项：全部不超过分页上限（规格 §14.3 size 最大 100） */
const ROLE_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100']

/** 排序字段选项文案 key：与 ROLE_SORT_FIELDS 白名单一一对应（规格 §14.3） */
const SORT_FIELD_LABEL_KEYS: Record<RoleSortField, string> = {
  code: '角色标识',
  name: '角色名称',
  status: '状态',
  createdAt: '创建时间',
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
  const pageRequest = usePageRequest()
  const list = useRoleList()
  const [keywordDraft, setKeywordDraft] = useState('')
  const [formDrawer, setFormDrawer] = useState<FormDrawerState>(FORM_DRAWER_CLOSED)
  const [permissionDrawerRole, setPermissionDrawerRole] = useState<RoleEntity | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [permissionSubmitting, setPermissionSubmitting] = useState(false)
  // 权限树懒加载：分配权限抽屉首次打开时请求并缓存（会话内权限码集合不变）；
  // 失败保持 null，下次打开重试（提示由请求层统一弹出）
  const [permissionTree, setPermissionTree] = useState<PermissionNode[] | null>(null)
  const [treeLoading, setTreeLoading] = useState(false)

  useEffect(() => {
    if (permissionDrawerRole === null || permissionTree !== null) {
      return
    }
    let alive = true
    setTreeLoading(true)
    void getPermissionTree(pageRequest)
      .then((nodes) => {
        if (alive) {
          setPermissionTree(nodes)
        }
      })
      .catch(() => {
        // 权限树加载失败的提示由请求层统一弹出；树保持未加载，下次打开重试
      })
      .finally(() => {
        if (alive) {
          setTreeLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [permissionDrawerRole, permissionTree, pageRequest])

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

  const handleAssignPermissions = async (permCodes: string[]): Promise<void> => {
    const target = permissionDrawerRole
    if (target === null) {
      return
    }
    setPermissionSubmitting(true)
    try {
      await assignRolePermissions(target.id, { permCodes }, { silent: true })
      message.success(t('保存成功'))
      setPermissionDrawerRole(null)
      list.reload()
    } finally {
      setPermissionSubmitting(false)
    }
  }

  const confirmDelete = (target: RoleEntity): void => {
    modal.confirm({
      title: t('删除角色'),
      content: t('确定要删除角色「{{name}}」吗？删除后不可恢复。', { name: target.name }),
      okText: t('确认删除'),
      okButtonProps: { danger: true },
      cancelText: t('取消'),
      onOk: async () => {
        try {
          // 非 silent：删除失败（如被引用冲突）由请求层统一弹出错误提示
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
          {/* builtIn 角色标识（规格 §14.1）：禁改 code、禁删的可视提示 */}
          {record.builtIn && <Tag>{t('内置')}</Tag>}
        </Space>
      ),
    },
    { title: t('角色名称'), dataIndex: 'name', key: 'name' },
    {
      title: t('描述'),
      dataIndex: 'description',
      key: 'description',
      render: (description: string | undefined) => description ?? '-',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (status: RoleEntity['status']) => (
        <Tag color={status === 'enabled' ? 'success' : 'error'}>
          {status === 'enabled' ? t('启用', { context: 'status' }) : t('禁用', { context: 'status' })}
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
          <Auth code={PERMISSIONS.SYSTEM_ROLE_ASSIGN_PERMISSION}>
            <Button type="link" icon={<ShieldCheck size={14} />} onClick={() => setPermissionDrawerRole(record)}>
              {t('分配权限')}
            </Button>
          </Auth>
          {/* builtIn 角色禁止删除（规格 §14.1）：删除入口不渲染；后端同样拒绝 */}
          {!record.builtIn && (
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
            <Input.Search
              allowClear
              placeholder={t('搜索角色标识或名称')}
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
              onSearch={(value) => list.searchKeyword(value)}
              style={{ width: 240 }}
            />
            <Select<RoleSortField | undefined>
              allowClear
              placeholder={t('默认排序（创建时间倒序）')}
              value={list.query.sortBy}
              onChange={(value) => list.changeSort(value, list.query.sortOrder)}
              style={{ width: 180 }}
              options={ROLE_SORT_FIELDS.map((field) => ({ label: t(SORT_FIELD_LABEL_KEYS[field]), value: field }))}
            />
            <Select<ListSortOrder>
              placeholder={t('排序方向')}
              value={list.query.sortBy === undefined ? undefined : list.query.sortOrder}
              disabled={list.query.sortBy === undefined}
              onChange={(value) => list.changeSort(list.query.sortBy, value)}
              style={{ width: 120 }}
              options={[
                { label: t('升序'), value: SORT_ORDERS.ASC },
                { label: t('降序'), value: SORT_ORDERS.DESC },
              ]}
            />
            <Button
              onClick={() => {
                setKeywordDraft('')
                list.searchKeyword('')
                list.changeSort(undefined, list.query.sortOrder)
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
            pageSize: list.query.size,
            total: list.total,
            showSizeChanger: true,
            pageSizeOptions: ROLE_PAGE_SIZE_OPTIONS,
            onChange: (page, size) => list.changePagination(page, size),
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
      {/* key 按目标角色重建抽屉组件：勾选初始值随目标角色的 permCodes 重置 */}
      <RolePermissionDrawer
        key={permissionDrawerRole?.id ?? 'closed'}
        open={permissionDrawerRole !== null}
        role={permissionDrawerRole}
        tree={permissionTree ?? []}
        treeLoading={treeLoading}
        submitting={permissionSubmitting}
        onSubmit={handleAssignPermissions}
        onClose={() => setPermissionDrawerRole(null)}
      />
    </div>
  )
}
