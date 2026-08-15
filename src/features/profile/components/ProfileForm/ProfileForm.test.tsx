/**
 * ProfileForm 测试（规格 §14.3 编辑资料契约/§14.4 字段映射）：
 * username 禁用回显与初始值、必填/邮箱格式校验、提交载荷形态（trim、空 phone 省略、
 * 不含 username/password/roleIds）、VALIDATION_FAILED.details 已知字段映射到表单项、
 * 未知字段与其他错误码显示页面级错误。
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { createApiError } from '@/services/request/envelope'
import type { User } from '@/types/system/user/user.types'
import { renderWithProviders } from '@/test/componentTestHelpers'
import { ProfileForm } from './ProfileForm'
import type { ProfileFormSubmitPayload } from './ProfileForm.types'

const userFixture: User = {
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

const submitSpy = vi.fn<(payload: ProfileFormSubmitPayload) => Promise<void>>()

beforeEach(() => {
  submitSpy.mockReset()
  submitSpy.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

/** 填入合法资料并提交 */
async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.clear(screen.getByPlaceholderText('请输入显示名称'))
  await user.type(screen.getByPlaceholderText('请输入显示名称'), '  新名称  ')
  await user.clear(screen.getByPlaceholderText('请输入邮箱'))
  await user.type(screen.getByPlaceholderText('请输入邮箱'), ' new@e.com ')
  await user.clear(screen.getByPlaceholderText('选填'))
  await user.type(screen.getByPlaceholderText('选填'), '  ')
  await user.click(screen.getByRole('button', { name: /保\s*存/ }))
}

describe('ProfileForm 编辑资料（规格 §14.3 契约）', () => {
  it('username 禁用回显，displayName/email/phone 回显当前资料', () => {
    renderWithProviders(
      <ProfileForm user={userFixture} submitting={false} onSubmit={submitSpy} />,
    )
    expect(screen.getByDisplayValue('admin')).toBeDisabled()
    expect(screen.getByDisplayValue('管理员')).toBeInTheDocument()
    expect(screen.getByDisplayValue('admin@example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('13800000000')).toBeInTheDocument()
  })

  it('空提交触发行内必填校验，不调用提交', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ProfileForm user={userFixture} submitting={false} onSubmit={submitSpy} />,
    )
    await user.clear(screen.getByPlaceholderText('请输入显示名称'))
    await user.clear(screen.getByPlaceholderText('请输入邮箱'))
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    expect(await screen.findByText('请输入显示名称')).toBeInTheDocument()
    expect(await screen.findByText('请输入邮箱')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('邮箱格式校验：非法邮箱拒绝提交', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ProfileForm user={userFixture} submitting={false} onSubmit={submitSpy} />,
    )
    await user.clear(screen.getByPlaceholderText('请输入邮箱'))
    await user.type(screen.getByPlaceholderText('请输入邮箱'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    expect(await screen.findByText('邮箱格式不正确')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('提交载荷 trim 且空 phone 省略，不含 username/password/roleIds', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ProfileForm user={userFixture} submitting={false} onSubmit={submitSpy} />,
    )
    await fillAndSubmit(user)
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy).toHaveBeenCalledWith({
      displayName: '新名称',
      email: 'new@e.com',
    })
  })

  it('VALIDATION_FAILED 已知字段映射到表单项，未知字段进页面级错误', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    submitSpy.mockRejectedValue(
      createApiError({
        errorCode: API_ERROR_CODES.VALIDATION_FAILED,
        httpStatus: 400,
        message: '请求参数校验失败',
        details: {
          fields: [
            { field: 'email', message: '邮箱已被占用' },
            { field: 'nickname', message: '未知字段' },
          ],
        },
      }),
    )
    renderWithProviders(
      <ProfileForm user={userFixture} submitting={false} onSubmit={submitSpy} />,
    )
    await fillAndSubmit(user)
    expect(await screen.findByText('邮箱已被占用')).toBeInTheDocument()
    expect(await screen.findByText(/nickname: 未知字段/)).toBeInTheDocument()
  })

  it('其他错误码映射为统一 i18n 文案的页面级错误', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    submitSpy.mockRejectedValue(
      createApiError({ errorCode: API_ERROR_CODES.RESOURCE_CONFLICT, httpStatus: 409, message: '冲突' }),
    )
    renderWithProviders(
      <ProfileForm user={userFixture} submitting={false} onSubmit={submitSpy} />,
    )
    await fillAndSubmit(user)
    expect(await screen.findByText('操作与当前状态冲突，请刷新后重试')).toBeInTheDocument()
  })
})
