/**
 * 个人中心页面测试（规格 §14.2）：/profile 仅登录无 permCode。
 * 基本资料与修改密码两张卡片（复用 auth.service 端点）、资料保存成功后
 * 经 profileLoaded 把最新用户写回会话切片（Header 显示名随之同步、
 * 角色与权限快照原样透传）、修改密码成功提示。service 以 mock 替换。
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntdApp } from 'antd'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestScopeProvider } from '@/components/RequestScopeProvider/RequestScopeProvider'
import { createComponentTestStore, renderWithProviders } from '@/test/componentTestHelpers'
import { profileLoaded } from '@/store/slices/user.slice'
import type { User } from '@/types/system/user/user.types'
import { Profile as ProfilePage } from './Profile'

const serviceMocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
}))

vi.mock('@/services/auth/auth.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth/auth.service')>()),
  updateProfile: serviceMocks.updateProfile,
  changePassword: serviceMocks.changePassword,
}))

const authUserFixture: User = {
  id: 'u-1',
  username: 'admin',
  displayName: '管理员',
  email: 'admin@example.com',
  phone: '13800000000',
  status: 'enabled',
  roleIds: ['r-1'],
  createdAt: '2026-08-15T00:00:00+08:00',
  updatedAt: '2026-08-15T00:00:00+08:00',
}

/** 页面 Provider 外壳：antd App（App.useApp）+ 页签请求作用域（usePageRequest） */
function pageWrapper({ children }: { children: ReactNode }) {
  return (
    <AntdApp>
      <RequestScopeProvider scopeId="profile-page-test">{children}</RequestScopeProvider>
    </AntdApp>
  )
}

/** 渲染页面并播种会话用户与权限快照 */
function renderProfilePage() {
  const store = createComponentTestStore()
  store.dispatch(
    profileLoaded({
      user: authUserFixture,
      roles: ['admin'],
      permCodes: ['*'],
      permissionVersion: 'v1',
    }),
  )
  return { ...renderWithProviders(<ProfilePage />, { store, wrapper: pageWrapper }), store }
}

beforeEach(() => {
  serviceMocks.updateProfile.mockReset()
  serviceMocks.changePassword.mockReset()
})

/** 修改密码卡片：以卡片头标题定位（标题与表单提交按钮同名，getByText 会歧义） */
function getPasswordCard(): HTMLElement | null {
  return Array.from(document.querySelectorAll('.ant-card-head-title')).find(
    (element) => element.textContent === '修改密码',
  )?.closest('.ant-card') as HTMLElement | null
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('Profile 个人中心页（规格 §14.2）', () => {
  it('渲染基本资料与修改密码卡片，回显当前会话用户', () => {
    renderProfilePage()
    expect(screen.getByText('基本资料')).toBeInTheDocument()
    // 「修改密码」同时是卡片标题与表单提交按钮文案：标题经卡片头查询，按钮经角色查询
    expect(getPasswordCard()).not.toBeNull()
    expect(screen.getByRole('button', { name: '修改密码' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('admin')).toBeDisabled()
    expect(screen.getByDisplayValue('管理员')).toBeInTheDocument()
    expect(screen.getByDisplayValue('admin@example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('13800000000')).toBeInTheDocument()
  })

  it('保存资料：调用 PUT /auth/profile（silent）并把最新用户写回会话切片', { timeout: 20_000 }, async () => {
    const updatedUser: User = { ...authUserFixture, displayName: '新名称', updatedAt: '2026-08-15T01:00:00+08:00' }
    serviceMocks.updateProfile.mockResolvedValue(updatedUser)
    const user = userEvent.setup()
    const { store } = renderProfilePage()

    const profileInput = screen.getByPlaceholderText('请输入显示名称')
    await user.clear(profileInput)
    await user.type(profileInput, '新名称')
    await user.click(screen.getAllByRole('button', { name: /保\s*存/ })[0])

    await waitFor(() => expect(serviceMocks.updateProfile).toHaveBeenCalledTimes(1))
    expect(serviceMocks.updateProfile).toHaveBeenCalledWith(
      { displayName: '新名称', email: 'admin@example.com', phone: '13800000000' },
      { silent: true },
    )
    // 成功提示 + 会话切片用户同步（角色与权限快照原样透传，不改 auth 状态机）
    expect(await screen.findByText('资料已更新')).toBeInTheDocument()
    await waitFor(() => expect(store.getState().user.user).toEqual(updatedUser))
    expect(store.getState().user.roles).toEqual(['admin'])
    expect(store.getState().user.permissionVersion).toBe('v1')
  })

  it('资料保存失败：错误由表单呈现，会话切片不更新', { timeout: 20_000 }, async () => {
    serviceMocks.updateProfile.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    const { store } = renderProfilePage()

    const profileInput = screen.getByPlaceholderText('请输入显示名称')
    await user.clear(profileInput)
    await user.type(profileInput, '新名称')
    await user.click(screen.getAllByRole('button', { name: /保\s*存/ })[0])

    // 未知错误显示固定兜底文案（规格 §7.4-3）
    expect(await screen.findByText('请求失败，请稍后重试')).toBeInTheDocument()
    expect(store.getState().user.user).toEqual(authUserFixture)
  })

  it('修改密码：调用 PUT /auth/password（silent）并提示成功', { timeout: 20_000 }, async () => {
    serviceMocks.changePassword.mockResolvedValue(null)
    const user = userEvent.setup()
    renderProfilePage()

    await user.type(screen.getByPlaceholderText('请输入原密码'), 'old-pass-1')
    await user.type(screen.getByPlaceholderText('密码最少 8 位且必须同时包含字母和数字'), 'fresh12345')
    await user.type(screen.getByPlaceholderText('请再次输入新密码'), 'fresh12345')
    await user.click(screen.getByRole('button', { name: '修改密码' }))

    await waitFor(() => expect(serviceMocks.changePassword).toHaveBeenCalledTimes(1))
    expect(serviceMocks.changePassword).toHaveBeenCalledWith(
      { oldPassword: 'old-pass-1', newPassword: 'fresh12345' },
      { silent: true },
    )
    expect(await screen.findByText('密码修改成功')).toBeInTheDocument()
  })

  it('两张卡片互不串扰：密码表单校验失败不影响资料表单', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderProfilePage()
    const passwordCard = getPasswordCard()
    expect(passwordCard).not.toBeNull()
    const confirmPassword = within(passwordCard!).getByPlaceholderText('请再次输入新密码')
    await user.type(confirmPassword, 'fresh12345')
    await user.click(within(passwordCard!).getByRole('button', { name: '修改密码' }))
    expect(await within(passwordCard!).findByText('请输入原密码')).toBeInTheDocument()
    expect(serviceMocks.changePassword).not.toHaveBeenCalled()
  })
})
