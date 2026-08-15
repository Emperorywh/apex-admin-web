/**
 * MenuForm 测试（规格 §14.3 写入契约的按类型条件校验，验收核心）：
 * - directory：不渲染也不得提交 routeId/path/permCode（类型切换后条件字段被清除）；
 * - page：必须设置 routeId（缺失时拦截提交），可识别全集即 routeId 下拉选项集合
 *   （MENU_PAGE_ROUTE_IDS，对照 route.constants 登记的路由 ID）；
 * - button：必须设置 permCode（缺失时拦截提交），提交 DTO 不携带 routeId/path；
 * - VALIDATION_FAILED.details 已知字段映射到表单项（§14.4，服务端不可识别 routeId 的呈现路径）；
 * - 编辑模式回显初始值并提交编辑契约。
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { ROUTE_IDS } from '@/constants/route.constants'
import { PERMISSIONS } from '@/constants/permission.constants'
import { MENU_PAGE_ROUTE_IDS, MENU_TYPES } from '@/constants/system/menu/menu.constants'
import { createApiError } from '@/services/request/envelope'
import { renderWithProviders } from '@/test/componentTestHelpers'
import type { MenuItem } from '@/types/system/menu/menu.types'
import { MenuForm } from './MenuForm'
import type { MenuFormSubmitPayload } from './MenuForm.types'

const treeFixture: MenuItem[] = [
  {
    id: 'm-dir',
    parentId: null,
    type: MENU_TYPES.DIRECTORY,
    name: '系统管理',
    sort: 1,
    visible: true,
    status: 'enabled',
    children: [
      {
        id: 'm-page',
        parentId: 'm-dir',
        type: MENU_TYPES.PAGE,
        name: '用户管理',
        routeId: ROUTE_IDS.SYSTEM_USER,
        path: '/system/user',
        sort: 1,
        visible: true,
        status: 'enabled',
      },
    ],
  },
]

const submitSpy = vi.fn()
const cancelSpy = vi.fn()

function renderMenuForm(options: { mode?: 'create' | 'edit'; menu?: MenuItem | null } = {}) {
  return renderWithProviders(
    <MenuForm
      mode={options.mode ?? 'create'}
      menu={options.menu ?? null}
      tree={treeFixture}
      submitting={false}
      onSubmit={submitSpy}
      onCancel={cancelSpy}
    />,
  )
}

/** 切换菜单类型（Radio.Group 选项以类型文案渲染） */
async function switchType(user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> {
  await user.click(screen.getByRole('radio', { name: label }))
}

/** 在第 index 个下拉中选择 title 对应选项（0 为上级菜单 TreeSelect，条件字段从 1 起） */
async function pickOption(user: ReturnType<typeof userEvent.setup>, index: number, title: string): Promise<void> {
  await user.click(screen.getAllByRole('combobox')[index])
  await user.click(await screen.findByTitle(title))
}

beforeEach(() => {
  submitSpy.mockReset()
  submitSpy.mockResolvedValue(undefined)
  cancelSpy.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('MenuForm 按类型条件校验（规格 §14.3 写入契约）', () => {
  it('directory：提交 DTO 不携带 routeId/path/permCode，条件字段不渲染', async () => {
    const user = userEvent.setup()
    renderMenuForm()
    // directory 为默认类型：routeId/path/permCode 表单项均不渲染
    expect(screen.queryByText('路由 ID')).not.toBeInTheDocument()
    expect(screen.queryByText('权限码')).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('请输入菜单名称'), '系统管理')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    const payload = submitSpy.mock.calls[0][0] as MenuFormSubmitPayload
    expect(payload.mode).toBe('create')
    expect(payload.dto).toEqual({
      parentId: null,
      type: MENU_TYPES.DIRECTORY,
      name: '系统管理',
      sort: 1,
      visible: true,
      status: 'enabled',
    })
  })

  it('page：缺 routeId 拦截提交并提示；补选后携带 routeId/path 提交', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderMenuForm()
    await switchType(user, '页面')
    await user.type(screen.getByPlaceholderText('请输入菜单名称'), '用户管理')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    // page 类型必须设置 routeId（规格 §14.3）：表单级拦截，不发起提交
    expect(await screen.findByText('page 类型必须设置路由 ID')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()

    await pickOption(user, 1, ROUTE_IDS.DASHBOARD)
    await user.type(screen.getByPlaceholderText('选填：默认展示路由路径'), '/dashboard')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    const payload = submitSpy.mock.calls[0][0] as MenuFormSubmitPayload
    expect(payload.dto).toEqual({
      parentId: null,
      type: MENU_TYPES.PAGE,
      name: '用户管理',
      routeId: ROUTE_IDS.DASHBOARD,
      path: '/dashboard',
      sort: 1,
      visible: true,
      status: 'enabled',
    })
  })

  it('page：routeId 下拉选项集合即可识别全集（MENU_PAGE_ROUTE_IDS，对照 route.constants）', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderMenuForm()
    await switchType(user, '页面')
    await user.click(screen.getAllByRole('combobox')[1])
    // 下拉仅提供已注册路由 ID：任何可提交的 routeId 都在可识别全集内
    const optionTitles = Array.from(document.querySelectorAll('.ant-select-item-option')).map(
      (option) => option.textContent ?? '',
    )
    expect(optionTitles.sort()).toEqual([...MENU_PAGE_ROUTE_IDS].sort())
  })

  it('类型切换清除条件字段：page 选择 routeId 后切回 directory，提交不携带 routeId/path', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderMenuForm()
    await switchType(user, '页面')
    await pickOption(user, 1, ROUTE_IDS.DASHBOARD)
    await user.type(screen.getByPlaceholderText('选填：默认展示路由路径'), '/dashboard')
    // 切回 directory：preserve=false 移除条件字段，提交 DTO 不外泄隐藏值
    await switchType(user, '目录')
    await user.type(screen.getByPlaceholderText('请输入菜单名称'), '系统管理')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    const payload = submitSpy.mock.calls[0][0] as MenuFormSubmitPayload
    expect(payload.dto.type).toBe(MENU_TYPES.DIRECTORY)
    expect('routeId' in payload.dto).toBe(false)
    expect('path' in payload.dto).toBe(false)
    expect('permCode' in payload.dto).toBe(false)
  })

  it('button：缺 permCode 拦截提交并提示；选择后提交 DTO 不携带 routeId/path', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderMenuForm()
    await switchType(user, '按钮')
    await user.type(screen.getByPlaceholderText('请输入菜单名称'), '新增用户')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    // button 类型必须设置 permCode（规格 §14.3）：表单级拦截，不发起提交
    expect(await screen.findByText('button 类型必须设置权限码')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()

    await pickOption(user, 1, PERMISSIONS.SYSTEM_USER_CREATE)
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    const payload = submitSpy.mock.calls[0][0] as MenuFormSubmitPayload
    expect(payload.dto).toEqual({
      parentId: null,
      type: MENU_TYPES.BUTTON,
      name: '新增用户',
      permCode: PERMISSIONS.SYSTEM_USER_CREATE,
      sort: 1,
      visible: true,
      status: 'enabled',
    })
  })

  it('VALIDATION_FAILED：已知字段（routeId）映射到表单项错误（§14.4）', { timeout: 20_000 }, async () => {
    submitSpy.mockRejectedValue(
      createApiError({
        httpStatus: 400,
        errorCode: API_ERROR_CODES.VALIDATION_FAILED,
        message: '请求参数校验失败',
        details: { fields: [{ field: 'routeId', message: 'routeId 必须是已注册的路由 ID' }] },
      }),
    )
    const user = userEvent.setup()
    renderMenuForm()
    await switchType(user, '页面')
    await user.type(screen.getByPlaceholderText('请输入菜单名称'), '用户管理')
    await pickOption(user, 1, ROUTE_IDS.DASHBOARD)
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    // 服务端按类型条件契约拒绝（如不可识别 routeId）：字段错误回显到 routeId 表单项
    expect(await screen.findByText('routeId 必须是已注册的路由 ID')).toBeInTheDocument()
    expect(submitSpy).toHaveBeenCalledTimes(1)
  })

  it('编辑模式：回显目标菜单初始值并提交编辑契约', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    const target = treeFixture[0].children![0]
    renderMenuForm({ mode: 'edit', menu: target })
    expect(screen.getByDisplayValue('用户管理')).toBeInTheDocument()
    expect(screen.getByTitle(ROUTE_IDS.SYSTEM_USER)).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('请输入菜单名称'))
    await user.type(screen.getByPlaceholderText('请输入菜单名称'), '用户管理（新）')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    const payload = submitSpy.mock.calls[0][0] as MenuFormSubmitPayload
    expect(payload.mode).toBe('edit')
    expect(payload.dto).toEqual({
      parentId: 'm-dir',
      type: MENU_TYPES.PAGE,
      name: '用户管理（新）',
      routeId: ROUTE_IDS.SYSTEM_USER,
      path: '/system/user',
      sort: 1,
      visible: true,
      status: 'enabled',
    })
  })
})
