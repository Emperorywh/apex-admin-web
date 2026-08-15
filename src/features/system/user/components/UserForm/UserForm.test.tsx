/**
 * UserForm 测试（规格 §14.3 写入契约/§14.4 字段映射）：
 * 创建/编辑字段差异与初始回显、必填/密码策略/邮箱格式校验、提交载荷形态
 * （trim、空 phone 省略、编辑契约不含 username/password/roleIds）、
 * VALIDATION_FAILED.details 已知字段映射到表单项、未知字段与其他错误码显示页面级错误。
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { createApiError } from '@/services/request/envelope'
import type { Role } from '@/types/system/role/role.types'
import type { User } from '@/types/system/user/user.types'
import { renderWithProviders } from '@/test/componentTestHelpers'
import { UserForm } from './UserForm'
import type { UserFormSubmitPayload } from './UserForm.types'

const rolesFixture: Role[] = [
  {
    id: 'r-1',
    code: 'admin',
    name: '管理员',
    status: 'enabled',
    builtIn: true,
    permCodes: ['*'],
    createdAt: '2026-08-15T00:00:00+08:00',
    updatedAt: '2026-08-15T00:00:00+08:00',
  },
  {
    id: 'r-2',
    code: 'viewer',
    name: '访客',
    status: 'enabled',
    builtIn: true,
    permCodes: ['dashboard:view'],
    createdAt: '2026-08-15T00:00:00+08:00',
    updatedAt: '2026-08-15T00:00:00+08:00',
  },
]

const editUserFixture: User = {
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

const submitSpy = vi.fn<(payload: UserFormSubmitPayload) => Promise<void>>()
const cancelSpy = vi.fn()

beforeEach(() => {
  submitSpy.mockReset()
  submitSpy.mockResolvedValue(undefined)
  cancelSpy.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

/** 创建模式填入合法字段并提交 */
async function fillCreateAndSubmit(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByPlaceholderText('请输入用户名'), '  newuser  ')
  await user.type(screen.getByPlaceholderText('密码最少 8 位且必须同时包含字母和数字'), 'abc12345')
  await user.type(screen.getByPlaceholderText('请输入显示名称'), '  新用户  ')
  await user.type(screen.getByPlaceholderText('请输入邮箱'), ' new@e.com ')
  await user.click(screen.getByRole('button', { name: /保\s*存/ }))
}

describe('UserForm 创建/编辑字段差异（规格 §14.3 契约）', () => {
  it('创建模式渲染 username/password/roleIds；编辑模式不渲染且 username 禁用回显', () => {
    const createView = renderWithProviders(
      <UserForm mode="create" user={null} roles={rolesFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('密码最少 8 位且必须同时包含字母和数字')).toBeInTheDocument()
    // antd Select 的占位文案渲染为文本节点而非 input placeholder
    expect(screen.getByText('请选择角色')).toBeInTheDocument()
    createView.unmount()

    renderWithProviders(
      <UserForm mode="edit" user={editUserFixture} roles={rolesFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    expect(screen.queryByPlaceholderText('请输入用户名')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('密码最少 8 位且必须同时包含字母和数字')).not.toBeInTheDocument()
    expect(screen.queryByText('请选择角色')).not.toBeInTheDocument()
    // username 创建后不可改：编辑模式仅禁用态回显
    expect(screen.getByDisplayValue('admin')).toBeDisabled()
    // 编辑初始回显
    expect(screen.getByDisplayValue('管理员')).toBeInTheDocument()
    expect(screen.getByDisplayValue('admin@example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('13800000000')).toBeInTheDocument()
  })

  it('空提交触发行内必填校验，不调用提交', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <UserForm mode="create" user={null} roles={rolesFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    expect(await screen.findByText('请输入用户名')).toBeInTheDocument()
    expect(screen.getByText('请输入密码')).toBeInTheDocument()
    expect(screen.getByText('请输入显示名称')).toBeInTheDocument()
    expect(screen.getByText('请输入邮箱')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })
})

describe('UserForm 校验规则（规格 §14.3）', () => {
  async function fillExceptPassword(user: ReturnType<typeof userEvent.setup>, password: string): Promise<void> {
    await user.type(screen.getByPlaceholderText('请输入用户名'), 'newuser')
    await user.type(screen.getByPlaceholderText('密码最少 8 位且必须同时包含字母和数字'), password)
    await user.type(screen.getByPlaceholderText('请输入显示名称'), '新用户')
    await user.type(screen.getByPlaceholderText('请输入邮箱'), 'new@e.com')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
  }

  it('密码少于 8 位或不含数字/字母：行内提示策略', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <UserForm mode="create" user={null} roles={rolesFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await fillExceptPassword(user, 'abc')
    expect(await screen.findByText('密码最少 8 位且必须同时包含字母和数字')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('邮箱格式不正确：行内提示', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <UserForm mode="create" user={null} roles={rolesFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await user.type(screen.getByPlaceholderText('请输入用户名'), 'newuser')
    await user.type(screen.getByPlaceholderText('密码最少 8 位且必须同时包含字母和数字'), 'abc12345')
    await user.type(screen.getByPlaceholderText('请输入显示名称'), '新用户')
    await user.type(screen.getByPlaceholderText('请输入邮箱'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    expect(await screen.findByText('邮箱格式不正确')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })
})

describe('UserForm 提交载荷（规格 §14.3 写入契约）', () => {
  it('创建：字段 trim、空 phone 省略、roleIds 随契约提交', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <UserForm mode="create" user={null} roles={rolesFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await fillCreateAndSubmit(user)
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy).toHaveBeenCalledWith({
      mode: 'create',
      dto: {
        username: 'newuser',
        password: 'abc12345',
        displayName: '新用户',
        email: 'new@e.com',
        status: 'enabled',
        roleIds: [],
      },
    })
  })

  it('编辑：载荷仅 displayName/email/phone?/status，不含 username/password/roleIds', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <UserForm mode="edit" user={editUserFixture} roles={rolesFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await user.clear(screen.getByDisplayValue('13800000000'))
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy).toHaveBeenCalledWith({
      mode: 'edit',
      dto: {
        displayName: '管理员',
        email: 'admin@example.com',
        status: 'enabled',
      },
    })
  })
})

describe('VALIDATION_FAILED 字段映射与页面级错误（规格 §14.4）', () => {
  it('已知字段错误映射到对应表单项', async () => {
    submitSpy.mockRejectedValue(
      createApiError({
        httpStatus: 400,
        errorCode: API_ERROR_CODES.VALIDATION_FAILED,
        message: '请求参数校验失败',
        details: { fields: [{ field: 'email', message: '邮箱已被占用' }] },
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(
      <UserForm mode="create" user={null} roles={rolesFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await fillCreateAndSubmit(user)
    expect(await screen.findByText('邮箱已被占用')).toBeInTheDocument()
  })

  it('未知字段（编辑契约外的 roleIds）显示页面级错误', async () => {
    submitSpy.mockRejectedValue(
      createApiError({
        httpStatus: 400,
        errorCode: API_ERROR_CODES.VALIDATION_FAILED,
        message: '请求参数校验失败',
        details: { fields: [{ field: 'roleIds', message: '角色不存在' }] },
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(
      <UserForm mode="edit" user={editUserFixture} roles={rolesFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    expect(await screen.findByText(/roleIds: 角色不存在/)).toBeInTheDocument()
  })

  it('非校验类已知错误码（RESOURCE_CONFLICT）映射为页面级 i18n 文案', async () => {
    submitSpy.mockRejectedValue(
      createApiError({
        httpStatus: 409,
        errorCode: API_ERROR_CODES.RESOURCE_CONFLICT,
        message: '用户名已存在',
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(
      <UserForm mode="create" user={null} roles={rolesFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await fillCreateAndSubmit(user)
    // 已知 errorCode 映射为前端文案；不透出后端 message（规格 §7.4-3）
    expect(await screen.findByText('操作与当前状态冲突，请刷新后重试')).toBeInTheDocument()
    expect(screen.queryByText('用户名已存在')).not.toBeInTheDocument()
  })

  it('提交成功后不显示页面级错误', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <UserForm mode="create" user={null} roles={rolesFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await fillCreateAndSubmit(user)
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
