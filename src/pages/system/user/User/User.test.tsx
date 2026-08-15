/**
 * 用户管理页面测试（规格 §14.2/§14.3/§5.2）：
 * 初始加载渲染表格、viewer 按钮级权限隐藏（<Auth> 门控）、admin 创建/删除/分配角色关键交互。
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
import type { Role } from '@/types/system/role/role.types'
import type { User } from '@/types/system/user/user.types'
import { User as UserPage } from './User'

const serviceMocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  assignUserRoles: vi.fn(),
  listRoles: vi.fn(),
}))

vi.mock('@/services/system/user/user.service', () => ({
  createUser: serviceMocks.createUser,
  updateUser: serviceMocks.updateUser,
  deleteUser: serviceMocks.deleteUser,
  assignUserRoles: serviceMocks.assignUserRoles,
  listUsers: serviceMocks.listUsers,
}))
vi.mock('@/services/system/role/role.service', () => ({
  listRoles: serviceMocks.listRoles,
}))

const usersFixture: User[] = [
  {
    id: 'u-1',
    username: 'admin',
    displayName: '管理员',
    email: 'admin@example.com',
    phone: '13800000001',
    status: 'enabled',
    roleIds: ['r-1'],
    createdAt: '2026-08-15T00:00:00+08:00',
    updatedAt: '2026-08-15T00:00:00+08:00',
  },
  {
    id: 'u-2',
    username: 'viewer',
    displayName: '访客',
    email: 'viewer@example.com',
    status: 'disabled',
    roleIds: ['r-2'],
    createdAt: '2026-08-15T00:00:00+08:00',
    updatedAt: '2026-08-15T00:00:00+08:00',
  },
]

const rolesFixture: Role[] = [
  {
    id: 'r-1',
    code: 'admin',
    name: '管理员',
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
]

/** 页面 Provider 外壳：antd App（App.useApp）+ 页签请求作用域（usePageRequest） */
function pageWrapper({ children }: { children: ReactNode }) {
  return (
    <AntdApp>
      <RequestScopeProvider scopeId="user-page-test">{children}</RequestScopeProvider>
    </AntdApp>
  )
}

/** 按权限码集合渲染页面并播种权限快照 */
function renderUserPage(permCodes: string[]) {
  const store = createComponentTestStore()
  store.dispatch(
    profileLoaded({
      user: usersFixture[0],
      roles: [],
      permCodes,
      permissionVersion: 'v1',
    }),
  )
  return renderWithProviders(<UserPage />, { store, wrapper: pageWrapper })
}

beforeEach(() => {
  serviceMocks.listUsers.mockReset()
  serviceMocks.listRoles.mockReset()
  serviceMocks.createUser.mockReset()
  serviceMocks.deleteUser.mockReset()
  serviceMocks.assignUserRoles.mockReset()
  serviceMocks.listUsers.mockResolvedValue({ list: usersFixture, total: 2, page: 1, size: 10 })
  serviceMocks.listRoles.mockResolvedValue({ list: rolesFixture, total: 2, page: 1, size: 100 })
  serviceMocks.createUser.mockResolvedValue(usersFixture[0])
  serviceMocks.deleteUser.mockResolvedValue(null)
  serviceMocks.assignUserRoles.mockResolvedValue(usersFixture[0])
})

afterEach(() => {
  vi.clearAllMocks()
})

/** admin 全量权限码（含四个写操作权限，规格 §5.1） */
const ADMIN_PERM_CODES = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.SYSTEM_USER_LIST,
  PERMISSIONS.SYSTEM_USER_CREATE,
  PERMISSIONS.SYSTEM_USER_UPDATE,
  PERMISSIONS.SYSTEM_USER_DELETE,
  PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE,
]

/** viewer 最小权限码（规格 §5.3）：可见列表但无任何写操作权限 */
const VIEWER_PERM_CODES = [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SYSTEM_USER_LIST, PERMISSIONS.DEMO_NESTED_VIEW]

describe('用户管理页面（规格 §14.2/§14.3）', () => {
  it('初始加载：表格渲染用户行与角色选项请求', async () => {
    renderUserPage(VIEWER_PERM_CODES)
    // 表格行：用户名与显示名称出现（viewer 也有 system:user:list）
    expect(await screen.findByText('admin')).toBeInTheDocument()
    expect(screen.getByText('viewer')).toBeInTheDocument()
    expect(screen.getByText('管理员')).toBeInTheDocument()
    // 禁用状态渲染为状态标签（规格 §14.1 status）
    expect(screen.getByText('禁用')).toBeInTheDocument()
    await waitFor(() => expect(serviceMocks.listRoles).toHaveBeenCalledTimes(1))
  })

  it('viewer（§5.3 矩阵）：新增/编辑/删除/分配角色按钮全部隐藏', async () => {
    renderUserPage(VIEWER_PERM_CODES)
    await screen.findByText('admin')
    expect(screen.queryByRole('button', { name: /新\s*增\s*用\s*户/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /编\s*辑/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /删\s*除/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /分\s*配\s*角\s*色/ })).not.toBeInTheDocument()
  })

  it('admin：创建用户走 Drawer 表单并调用 createUser，成功后刷新列表', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderUserPage(ADMIN_PERM_CODES)
    await screen.findByText('admin')
    expect(screen.getByRole('button', { name: /新\s*增\s*用\s*户/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /新\s*增\s*用\s*户/ }))
    // Drawer 打开：创建表单含 username/password 字段
    expect(await screen.findByText('密码')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('请输入用户名'), 'newuser')
    await user.type(screen.getByPlaceholderText('密码最少 8 位且必须同时包含字母和数字'), 'abc12345')
    await user.type(screen.getByPlaceholderText('请输入显示名称'), '新用户')
    await user.type(screen.getByPlaceholderText('请输入邮箱'), 'new@e.com')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(serviceMocks.createUser).toHaveBeenCalledTimes(1))
    expect(serviceMocks.createUser.mock.calls[0][0]).toMatchObject({
      username: 'newuser',
      password: 'abc12345',
      displayName: '新用户',
      email: 'new@e.com',
      status: 'enabled',
      roleIds: [],
    })
    // 成功后关闭 Drawer 并重新加载列表（silent 提交，规格 §7.4-3）
    await waitFor(() => expect(serviceMocks.listUsers.mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.queryByPlaceholderText('请输入用户名')).not.toBeInTheDocument())
  })

  it('admin：删除用户经确认框调用 deleteUser', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderUserPage(ADMIN_PERM_CODES)
    await screen.findByText('admin')

    await user.click(screen.getAllByRole('button', { name: /删\s*除/ })[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/确定要删除用户「管理员」/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /确\s*认\s*删\s*除/ }))

    await waitFor(() => expect(serviceMocks.deleteUser).toHaveBeenCalledWith('u-1'))
    await waitFor(() => expect(serviceMocks.listUsers.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('admin：分配角色独立 Drawer 以当前角色初始勾选并调用 assignUserRoles', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderUserPage(ADMIN_PERM_CODES)
    await screen.findByText('admin')

    await user.click(screen.getAllByRole('button', { name: /分\s*配\s*角\s*色/ })[0])
    // Drawer 打开：目标用户与角色复选框出现；admin 用户初始勾选管理员角色
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText(/目标用户/)).toBeInTheDocument()
    const adminCheckbox = within(drawer).getByRole('checkbox', { name: /管理员（admin）/ })
    expect(adminCheckbox).toBeChecked()
    // 勾选访客角色后提交
    await user.click(within(drawer).getByRole('checkbox', { name: /访客（viewer）/ }))
    await user.click(within(drawer).getByRole('button', { name: /保\s*存/ }))

    await waitFor(() =>
      expect(serviceMocks.assignUserRoles).toHaveBeenCalledWith('u-1', { roleIds: ['r-1', 'r-2'] }, { silent: true }),
    )
    await waitFor(() => expect(serviceMocks.listUsers.mock.calls.length).toBeGreaterThanOrEqual(2))
  })
})
