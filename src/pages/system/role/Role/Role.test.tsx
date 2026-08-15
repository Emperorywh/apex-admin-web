/**
 * 角色管理页面测试（规格 §14.2/§14.3/§5.2）：
 * 初始加载渲染表格、仅列表权限（viewer 语义）下写操作按钮全部隐藏（<Auth> 门控）、
 * admin 创建/编辑（code 禁改）/删除/builtIn 禁删/分配权限关键交互。
 * service 模块以 mock 替换；页面经 antd App + RequestScopeProvider + Redux/i18n Provider 渲染。
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntdApp } from 'antd'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSIONS, PERMISSION_WILDCARD } from '@/constants/permission.constants'
import { RequestScopeProvider } from '@/components/RequestScopeProvider/RequestScopeProvider'
import { createComponentTestStore, renderWithProviders } from '@/test/componentTestHelpers'
import { profileLoaded } from '@/store/slices/user.slice'
import type { PermissionNode, Role } from '@/types/system/role/role.types'
import type { User } from '@/types/system/user/user.types'
import { Role as RolePage } from './Role'

const serviceMocks = vi.hoisted(() => ({
  listRoles: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  assignRolePermissions: vi.fn(),
  getPermissionTree: vi.fn(),
}))

vi.mock('@/services/system/role/role.service', () => ({
  listRoles: serviceMocks.listRoles,
  createRole: serviceMocks.createRole,
  updateRole: serviceMocks.updateRole,
  deleteRole: serviceMocks.deleteRole,
  assignRolePermissions: serviceMocks.assignRolePermissions,
  getPermissionTree: serviceMocks.getPermissionTree,
}))

const authUserFixture: User = {
  id: 'u-1',
  username: 'admin',
  displayName: '管理员',
  email: 'admin@example.com',
  status: 'enabled',
  roleIds: ['r-1'],
  createdAt: '2026-08-15T00:00:00+08:00',
  updatedAt: '2026-08-15T00:00:00+08:00',
}

const rolesFixture: Role[] = [
  {
    id: 'r-1',
    code: 'admin',
    name: '管理员',
    description: '通配权限',
    status: 'enabled',
    builtIn: true,
    permCodes: [PERMISSION_WILDCARD],
    createdAt: '2026-08-15T00:00:00+08:00',
    updatedAt: '2026-08-15T00:00:00+08:00',
  },
  {
    id: 'r-2',
    code: 'viewer',
    name: '访客',
    status: 'enabled',
    builtIn: true,
    permCodes: [PERMISSIONS.DASHBOARD_VIEW],
    createdAt: '2026-08-15T00:00:00+08:00',
    updatedAt: '2026-08-15T00:00:00+08:00',
  },
  {
    id: 'r-3',
    code: 'operator',
    name: '运营',
    status: 'disabled',
    builtIn: false,
    permCodes: [],
    createdAt: '2026-08-15T00:00:00+08:00',
    updatedAt: '2026-08-15T00:00:00+08:00',
  },
]

const treeFixture: PermissionNode[] = [
  {
    key: 'dashboard',
    title: '仪表盘',
    children: [{ key: PERMISSIONS.DASHBOARD_VIEW, title: '查看', permCode: PERMISSIONS.DASHBOARD_VIEW }],
  },
  {
    key: 'system:user',
    title: '用户管理',
    children: [
      { key: PERMISSIONS.SYSTEM_USER_LIST, title: '查询', permCode: PERMISSIONS.SYSTEM_USER_LIST },
      { key: PERMISSIONS.SYSTEM_USER_CREATE, title: '新增', permCode: PERMISSIONS.SYSTEM_USER_CREATE },
    ],
  },
]

/** 按节点标题定位对应树节点的复选框元素 */
function checkboxForTitle(title: string): HTMLElement {
  const wrappers = Array.from(document.querySelectorAll('.ant-tree-node-content-wrapper'))
  const wrapper = wrappers.find((element) => element.textContent === title)
  expect(wrapper, `缺少标题为 ${title} 的树节点`).toBeDefined()
  const node = wrapper!.closest('.ant-tree-treenode')
  const checkbox = node!.querySelector<HTMLElement>('.ant-tree-checkbox')
  expect(checkbox, `标题 ${title} 的节点缺少复选框`).toBeDefined()
  return checkbox!
}

/** 页面 Provider 外壳：antd App（App.useApp）+ 页签请求作用域（usePageRequest） */
function pageWrapper({ children }: { children: ReactNode }) {
  return (
    <AntdApp>
      <RequestScopeProvider scopeId="role-page-test">{children}</RequestScopeProvider>
    </AntdApp>
  )
}

/** 按权限码集合渲染页面并播种权限快照 */
function renderRolePage(permCodes: string[]) {
  const store = createComponentTestStore()
  store.dispatch(
    profileLoaded({
      user: authUserFixture,
      roles: [],
      permCodes,
      permissionVersion: 'v1',
    }),
  )
  return renderWithProviders(<RolePage />, { store, wrapper: pageWrapper })
}

beforeEach(() => {
  serviceMocks.listRoles.mockReset()
  serviceMocks.createRole.mockReset()
  serviceMocks.updateRole.mockReset()
  serviceMocks.deleteRole.mockReset()
  serviceMocks.assignRolePermissions.mockReset()
  serviceMocks.getPermissionTree.mockReset()
  serviceMocks.listRoles.mockResolvedValue({ list: rolesFixture, total: 3, page: 1, size: 10 })
  serviceMocks.createRole.mockResolvedValue(rolesFixture[2])
  serviceMocks.updateRole.mockResolvedValue(rolesFixture[2])
  serviceMocks.deleteRole.mockResolvedValue(null)
  serviceMocks.assignRolePermissions.mockResolvedValue(rolesFixture[1])
  serviceMocks.getPermissionTree.mockResolvedValue(treeFixture)
})

afterEach(() => {
  vi.clearAllMocks()
})

/** admin 全量角色权限码（规格 §5.1） */
const ADMIN_PERM_CODES = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.SYSTEM_ROLE_LIST,
  PERMISSIONS.SYSTEM_ROLE_CREATE,
  PERMISSIONS.SYSTEM_ROLE_UPDATE,
  PERMISSIONS.SYSTEM_ROLE_DELETE,
  PERMISSIONS.SYSTEM_ROLE_ASSIGN_PERMISSION,
]

/** 仅列表权限（viewer 语义：无 system:role:* 写权限，页面对其本就不可达，此处验证按钮门控） */
const LIST_ONLY_PERM_CODES = [PERMISSIONS.SYSTEM_ROLE_LIST]

describe('角色管理页面（规格 §14.2/§14.3）', () => {
  it('初始加载：表格渲染角色行与 builtIn 标识', async () => {
    renderRolePage(LIST_ONLY_PERM_CODES)
    expect(await screen.findByText('admin')).toBeInTheDocument()
    expect(screen.getByText('viewer')).toBeInTheDocument()
    expect(screen.getByText('operator')).toBeInTheDocument()
    // builtIn 角色带「内置」标识（规格 §14.1）；禁用状态渲染为状态标签
    expect(screen.getAllByText('内置')).toHaveLength(2)
    expect(screen.getByText('禁用')).toBeInTheDocument()
    expect(serviceMocks.listRoles).toHaveBeenCalledTimes(1)
  })

  it('仅列表权限：新增/编辑/删除/分配权限按钮全部隐藏（<Auth> 门控，规格 §5.2）', async () => {
    renderRolePage(LIST_ONLY_PERM_CODES)
    await screen.findByText('admin')
    expect(screen.queryByRole('button', { name: /新\s*增\s*角\s*色/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /编\s*辑/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /删\s*除/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /分\s*配\s*权\s*限/ })).not.toBeInTheDocument()
  })

  it('admin：创建角色走 Drawer 表单并调用 createRole，成功后刷新列表', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderRolePage(ADMIN_PERM_CODES)
    await screen.findByText('admin')
    expect(screen.getByRole('button', { name: /新\s*增\s*角\s*色/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /新\s*增\s*角\s*色/ }))
    expect(await screen.findByPlaceholderText('请输入角色标识')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('请输入角色标识'), 'operator')
    await user.type(screen.getByPlaceholderText('请输入角色名称'), '运营')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(serviceMocks.createRole).toHaveBeenCalledTimes(1))
    expect(serviceMocks.createRole.mock.calls[0][0]).toMatchObject({
      code: 'operator',
      name: '运营',
      status: 'enabled',
    })
    // 成功后关闭 Drawer 并重新加载列表（silent 提交，规格 §7.4-3）
    await waitFor(() => expect(serviceMocks.listRoles.mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.queryByPlaceholderText('请输入角色标识')).not.toBeInTheDocument())
  })

  it('admin：编辑角色 code 禁用回显，提交编辑契约（仅 name/description?/status）', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderRolePage(ADMIN_PERM_CODES)
    await screen.findByText('operator')

    await user.click(screen.getAllByRole('button', { name: /编\s*辑/ })[2])
    const drawer = await screen.findByRole('dialog')
    // code 创建后不可改（规格 §14.3）：编辑模式仅禁用态回显
    expect(within(drawer).getByDisplayValue('operator')).toBeDisabled()
    await user.clear(within(drawer).getByDisplayValue('运营'))
    await user.type(within(drawer).getByPlaceholderText('请输入角色名称'), '运营专员')
    await user.click(within(drawer).getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(serviceMocks.updateRole).toHaveBeenCalledTimes(1))
    expect(serviceMocks.updateRole.mock.calls[0][0]).toBe('r-3')
    expect(serviceMocks.updateRole.mock.calls[0][1]).toEqual({ name: '运营专员', status: 'disabled' })
  })

  it('admin：删除非内置角色经确认框调用 deleteRole；builtIn 行无删除按钮（禁删）', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderRolePage(ADMIN_PERM_CODES)
    await screen.findByText('admin')

    // 三行中仅 operator（第 3 行，非内置）渲染删除按钮
    const deleteButtons = screen.getAllByRole('button', { name: /删\s*除/ })
    expect(deleteButtons).toHaveLength(1)
    await user.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/确定要删除角色「运营」/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /确\s*认\s*删\s*除/ }))

    await waitFor(() => expect(serviceMocks.deleteRole).toHaveBeenCalledWith('r-3'))
    await waitFor(() => expect(serviceMocks.listRoles.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('admin：分配权限 Drawer 懒加载权限树、勾选由 permCodes 推导并提交叶子权限码', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderRolePage(ADMIN_PERM_CODES)
    await screen.findByText('admin')

    // viewer 行（r-2，permCodes 含 dashboard:view）打开分配权限抽屉
    await user.click(screen.getAllByRole('button', { name: /分\s*配\s*权\s*限/ })[1])
    // 权限树首次打开时懒加载
    await waitFor(() => expect(serviceMocks.getPermissionTree).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(document.querySelectorAll('.ant-tree-checkbox').length).toBeGreaterThan(0))
    // 初始勾选由 permCodes 推导：dashboard:view 叶子选中，父节点全选
    expect(checkboxForTitle('查看')).toHaveClass('ant-tree-checkbox-checked')
    // 追加勾选「用户管理」父节点 → 子叶子全部选中
    await user.click(checkboxForTitle('用户管理'))
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(serviceMocks.assignRolePermissions).toHaveBeenCalledTimes(1))
    expect(serviceMocks.assignRolePermissions.mock.calls[0][0]).toBe('r-2')
    // 提交载荷仅含选中叶子 permCodes（dashboard:view 初始 + 两个用户叶子）
    expect(serviceMocks.assignRolePermissions.mock.calls[0][1]).toEqual({
      permCodes: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.SYSTEM_USER_LIST,
        PERMISSIONS.SYSTEM_USER_CREATE,
      ],
    })
    expect(serviceMocks.assignRolePermissions.mock.calls[0][2]).toEqual({ silent: true })
    await waitFor(() => expect(serviceMocks.listRoles.mock.calls.length).toBeGreaterThanOrEqual(2))
  })
})
