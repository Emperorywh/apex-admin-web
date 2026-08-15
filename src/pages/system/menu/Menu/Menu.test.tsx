/**
 * 菜单管理页面测试（规格 §14.2/§14.3/§5.2）：
 * 树表展示（type/name/routeId/path/permCode/sort/visible/status，含嵌套子节点）、
 * 「不动态改变前端静态路由」固定说明文案、仅列表权限（viewer 语义）下写按钮全部隐藏
 * （<Auth> 门控）、admin 创建/编辑/删除关键交互（删除冲突 rejection 被吞掉由请求层提示）。
 * service 模块以 mock 替换；页面经 antd App + RequestScopeProvider + Redux/i18n Provider 渲染。
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntdApp } from 'antd'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSIONS } from '@/constants/permission.constants'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { RequestScopeProvider } from '@/components/RequestScopeProvider/RequestScopeProvider'
import { createComponentTestStore, renderWithProviders } from '@/test/componentTestHelpers'
import { createApiError } from '@/services/request/envelope'
import { profileLoaded } from '@/store/slices/user.slice'
import type { MenuItem } from '@/types/system/menu/menu.types'
import type { User } from '@/types/system/user/user.types'
import { Menu as MenuPage } from './Menu'

const serviceMocks = vi.hoisted(() => ({
  getMenuTree: vi.fn(),
  createMenu: vi.fn(),
  updateMenu: vi.fn(),
  deleteMenu: vi.fn(),
}))

vi.mock('@/services/system/menu/menu.service', () => ({
  getMenuTree: serviceMocks.getMenuTree,
  createMenu: serviceMocks.createMenu,
  updateMenu: serviceMocks.updateMenu,
  deleteMenu: serviceMocks.deleteMenu,
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

/** 树表 fixture：覆盖 page/directory/button 三类型与各列展示形态 */
const menuTreeFixture: MenuItem[] = [
  {
    id: 'm-dashboard',
    parentId: null,
    type: 'page',
    name: '仪表盘',
    routeId: 'dashboard',
    path: '/dashboard',
    sort: 1,
    visible: false,
    status: 'enabled',
  },
  {
    id: 'm-system',
    parentId: null,
    type: 'directory',
    name: '系统管理',
    sort: 2,
    visible: true,
    status: 'enabled',
    children: [
      {
        id: 'm-user',
        parentId: 'm-system',
        type: 'page',
        name: '用户管理',
        routeId: 'system-user',
        path: '/system/user',
        sort: 1,
        visible: true,
        status: 'enabled',
        children: [
          {
            id: 'm-user-create',
            parentId: 'm-user',
            type: 'button',
            name: '新增用户',
            permCode: PERMISSIONS.SYSTEM_USER_CREATE,
            sort: 1,
            visible: true,
            status: 'disabled',
          },
        ],
      },
    ],
  },
]

/** 页面 Provider 外壳：antd App（App.useApp）+ 页签请求作用域（usePageRequest） */
function pageWrapper({ children }: { children: ReactNode }) {
  return (
    <AntdApp>
      <RequestScopeProvider scopeId="menu-page-test">{children}</RequestScopeProvider>
    </AntdApp>
  )
}

/** 按权限码集合渲染页面并播种权限快照 */
function renderMenuPage(permCodes: string[]) {
  const store = createComponentTestStore()
  store.dispatch(
    profileLoaded({
      user: authUserFixture,
      roles: [],
      permCodes,
      permissionVersion: 'v1',
    }),
  )
  return renderWithProviders(<MenuPage />, { store, wrapper: pageWrapper })
}

/** 行内操作按钮点击：antd css-in-js 样式注入时机下 userEvent 的 pointer-events 检查不稳定，统一走 fireEvent */
function clickRowAction(rowText: string, name: RegExp): void {
  const row = screen.getByText(rowText).closest('tr')
  const button = within(row as HTMLElement).getByRole('button', { name })
  fireEvent.click(button)
}

/** 展开树表行：点击目标行上的展开图标使子节点进入 DOM（图标样式为 pointer-events:none，走 fireEvent） */
function expandRow(rowText: string): void {
  const row = screen.getByText(rowText).closest('tr')
  const icon = row?.querySelector<HTMLButtonElement>('.ant-table-row-expand-icon')
  expect(icon, `行 ${rowText} 缺少展开图标`).not.toBeNull()
  fireEvent.click(icon!)
}

beforeEach(() => {
  serviceMocks.getMenuTree.mockReset()
  serviceMocks.createMenu.mockReset()
  serviceMocks.updateMenu.mockReset()
  serviceMocks.deleteMenu.mockReset()
  serviceMocks.getMenuTree.mockResolvedValue(menuTreeFixture)
  serviceMocks.createMenu.mockResolvedValue(menuTreeFixture[0])
  serviceMocks.updateMenu.mockResolvedValue(menuTreeFixture[0])
  serviceMocks.deleteMenu.mockResolvedValue(null)
})

afterEach(() => {
  vi.clearAllMocks()
})

/** admin 全量菜单权限码（规格 §5.1） */
const ADMIN_PERM_CODES = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.SYSTEM_MENU_LIST,
  PERMISSIONS.SYSTEM_MENU_CREATE,
  PERMISSIONS.SYSTEM_MENU_UPDATE,
  PERMISSIONS.SYSTEM_MENU_DELETE,
]

/** 仅列表权限（viewer 语义：无 system:menu:* 写权限，页面对其本就不可达，此处验证按钮门控） */
const LIST_ONLY_PERM_CODES = [PERMISSIONS.SYSTEM_MENU_LIST]

describe('菜单管理页面（规格 §14.2/§14.3）', () => {
  it('初始加载：固定说明文案 + 树表渲染各类型行与全部列', async () => {
    renderMenuPage(LIST_ONLY_PERM_CODES)
    // 固定说明文案（规格 §14.1/§14.2）：菜单管理不动态改变前端静态路由
    expect(
      await screen.findByText('菜单管理仅维护后端菜单数据，不会动态改变前端静态路由'),
    ).toBeInTheDocument()

    // 根级行：page（仪表盘）与 directory（系统管理）；目录行 routeId/path/permCode 以 - 展示
    expect(screen.getByText('仪表盘')).toBeInTheDocument()
    expect(screen.getByText('系统管理')).toBeInTheDocument()
    expect(screen.getByText('dashboard')).toBeInTheDocument()
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(3)
    // 不可见行（visible false）与类型标签
    expect(screen.getByText('隐藏')).toBeInTheDocument()
    expect(screen.getAllByText('页面')).toHaveLength(1)
    expect(screen.getAllByText('目录')).toHaveLength(1)

    // 展开目录与子页面：page 子行携带 routeId/path，button 孙行携带 permCode
    expandRow('系统管理')
    expect(await screen.findByText('用户管理')).toBeInTheDocument()
    expect(screen.getByText('system-user')).toBeInTheDocument()
    expandRow('用户管理')
    expect(await screen.findByText('新增用户')).toBeInTheDocument()
    expect(screen.getByText(PERMISSIONS.SYSTEM_USER_CREATE)).toBeInTheDocument()
    expect(screen.getAllByText('按钮')).toHaveLength(1)
    expect(serviceMocks.getMenuTree).toHaveBeenCalledTimes(1)
  })

  it('仅列表权限：新增/编辑/删除按钮全部隐藏（<Auth> 门控，规格 §5.2）', async () => {
    renderMenuPage(LIST_ONLY_PERM_CODES)
    await screen.findByText('仪表盘')
    expect(screen.queryByRole('button', { name: /新\s*增\s*菜\s*单/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /编\s*辑/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /删\s*除/ })).not.toBeInTheDocument()
  })

  it('admin：创建目录菜单走 Drawer 表单并调用 createMenu（silent），成功后刷新树', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderMenuPage(ADMIN_PERM_CODES)
    await screen.findByText('仪表盘')

    await user.click(screen.getByRole('button', { name: /新\s*增\s*菜\s*单/ }))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByPlaceholderText('请输入菜单名称')).toBeInTheDocument()
    // directory 为默认类型：routeId/权限码条件字段不渲染（规格 §14.3；限定 Drawer 内排除表头列名）
    expect(within(drawer).queryByText('路由 ID')).not.toBeInTheDocument()
    expect(within(drawer).queryByText('权限码')).not.toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('请输入菜单名称'), '演示目录')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(serviceMocks.createMenu).toHaveBeenCalledTimes(1))
    expect(serviceMocks.createMenu.mock.calls[0][0]).toEqual({
      parentId: null,
      type: 'directory',
      name: '演示目录',
      sort: 1,
      visible: true,
      status: 'enabled',
    })
    expect(serviceMocks.createMenu.mock.calls[0][1]).toEqual({ silent: true })
    await waitFor(() => expect(serviceMocks.getMenuTree.mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.queryByPlaceholderText('请输入菜单名称')).not.toBeInTheDocument())
  })

  it('admin：编辑菜单回显初始值并提交编辑契约', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderMenuPage(ADMIN_PERM_CODES)
    await screen.findByText('仪表盘')

    clickRowAction('仪表盘', /编\s*辑/)
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByDisplayValue('仪表盘')).toBeInTheDocument()
    await user.clear(within(drawer).getByPlaceholderText('请输入菜单名称'))
    await user.type(within(drawer).getByPlaceholderText('请输入菜单名称'), '仪表盘（新）')
    await user.click(within(drawer).getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(serviceMocks.updateMenu).toHaveBeenCalledTimes(1))
    expect(serviceMocks.updateMenu.mock.calls[0][0]).toBe('m-dashboard')
    expect(serviceMocks.updateMenu.mock.calls[0][1]).toEqual({
      parentId: null,
      type: 'page',
      name: '仪表盘（新）',
      routeId: 'dashboard',
      path: '/dashboard',
      sort: 1,
      visible: false,
      status: 'enabled',
    })
    expect(serviceMocks.updateMenu.mock.calls[0][2]).toEqual({ silent: true })
  })

  it('admin：删除存在子节点的菜单返回冲突：rejection 被吞掉且不刷新树（提示由请求层统一弹出）', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderMenuPage(ADMIN_PERM_CODES)
    await screen.findByText('仪表盘')

    // 系统管理目录存在子节点：后端返回 RESOURCE_CONFLICT（规格 §14.3 菜单删除契约）
    serviceMocks.deleteMenu.mockRejectedValueOnce(
      createApiError({
        httpStatus: 409,
        errorCode: API_ERROR_CODES.RESOURCE_CONFLICT,
        message: '菜单存在子节点，不允许删除',
      }),
    )
    clickRowAction('系统管理', /删\s*除/)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/确定要删除菜单「系统管理」/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /确\s*认\s*删\s*除/ }))

    // 调用已发出、冲突 rejection 被页面吞掉（不刷新树；失败提示由请求层统一弹出）
    await waitFor(() => expect(serviceMocks.deleteMenu).toHaveBeenCalledWith('m-system'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(serviceMocks.getMenuTree).toHaveBeenCalledTimes(1)
  })

  it('admin：删除叶子菜单经确认框调用 deleteMenu，成功后刷新树', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderMenuPage(ADMIN_PERM_CODES)
    await screen.findByText('仪表盘')

    clickRowAction('仪表盘', /删\s*除/)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/确定要删除菜单「仪表盘」/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /确\s*认\s*删\s*除/ }))

    await waitFor(() => expect(serviceMocks.deleteMenu).toHaveBeenCalledWith('m-dashboard'))
    await waitFor(() => expect(serviceMocks.getMenuTree.mock.calls.length).toBeGreaterThanOrEqual(2))
  })
})
