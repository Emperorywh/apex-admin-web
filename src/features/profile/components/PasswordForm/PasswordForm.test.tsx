/**
 * PasswordForm 测试（规格 §14.3 修改密码契约/§14.4 字段映射）：
 * 必填/密码策略/两次一致校验、提交载荷只含 oldPassword/newPassword、
 * 成功后表单清空、旧密码错误（AUTH_INVALID_CREDENTIALS）映射到 oldPassword 表单项、
 * VALIDATION_FAILED 已知字段映射与未知错误页面级呈现。
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { createApiError } from '@/services/request/envelope'
import { renderWithProviders } from '@/test/componentTestHelpers'
import { PasswordForm } from './PasswordForm'
import type { PasswordFormSubmitPayload } from './PasswordForm.types'

const submitSpy = vi.fn<(payload: PasswordFormSubmitPayload) => Promise<void>>()

beforeEach(() => {
  submitSpy.mockReset()
  submitSpy.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

/** 填入合法新旧密码并提交 */
async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByPlaceholderText('请输入原密码'), 'old-pass-1')
  await user.type(screen.getByPlaceholderText('密码最少 8 位且必须同时包含字母和数字'), 'fresh12345')
  await user.type(screen.getByPlaceholderText('请再次输入新密码'), 'fresh12345')
  await user.click(screen.getByRole('button', { name: '修改密码' }))
}

describe('PasswordForm 修改密码（规格 §14.3 契约）', () => {
  it('空提交触发三项必填校验，不调用提交', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderWithProviders(<PasswordForm submitting={false} onSubmit={submitSpy} />)
    await user.click(screen.getByRole('button', { name: '修改密码' }))
    expect(await screen.findByText('请输入原密码')).toBeInTheDocument()
    expect(await screen.findByText('请输入新密码')).toBeInTheDocument()
    expect(await screen.findByText('请再次输入新密码')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('新密码不满足密码策略时拒绝提交', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderWithProviders(<PasswordForm submitting={false} onSubmit={submitSpy} />)
    await user.type(screen.getByPlaceholderText('请输入原密码'), 'old-pass-1')
    await user.type(screen.getByPlaceholderText('密码最少 8 位且必须同时包含字母和数字'), 'onlyletters')
    await user.type(screen.getByPlaceholderText('请再次输入新密码'), 'onlyletters')
    await user.click(screen.getByRole('button', { name: '修改密码' }))
    expect(await screen.findByText('密码最少 8 位且必须同时包含字母和数字')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('两次输入不一致时拒绝提交', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderWithProviders(<PasswordForm submitting={false} onSubmit={submitSpy} />)
    await user.type(screen.getByPlaceholderText('请输入原密码'), 'old-pass-1')
    await user.type(screen.getByPlaceholderText('密码最少 8 位且必须同时包含字母和数字'), 'fresh12345')
    await user.type(screen.getByPlaceholderText('请再次输入新密码'), 'fresh99999')
    await user.click(screen.getByRole('button', { name: '修改密码' }))
    expect(await screen.findByText('两次输入的密码不一致')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('提交载荷只含 oldPassword/newPassword（confirmPassword 不进入契约）', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderWithProviders(<PasswordForm submitting={false} onSubmit={submitSpy} />)
    await fillAndSubmit(user)
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy).toHaveBeenCalledWith({ oldPassword: 'old-pass-1', newPassword: 'fresh12345' })
  })

  it('提交成功后表单清空', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    renderWithProviders(<PasswordForm submitting={false} onSubmit={submitSpy} />)
    await fillAndSubmit(user)
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByPlaceholderText('请输入原密码')).toHaveValue(''))
    expect(screen.getByPlaceholderText('密码最少 8 位且必须同时包含字母和数字')).toHaveValue('')
  })

  it('旧密码错误（AUTH_INVALID_CREDENTIALS）映射到 oldPassword 表单项', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    submitSpy.mockRejectedValue(
      createApiError({ errorCode: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, httpStatus: 401, message: '用户名或密码错误' }),
    )
    renderWithProviders(<PasswordForm submitting={false} onSubmit={submitSpy} />)
    await fillAndSubmit(user)
    expect(await screen.findByText('原密码不正确')).toBeInTheDocument()
  })

  it('VALIDATION_FAILED 已知字段映射到表单项；未知错误码显示页面级错误', { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    submitSpy.mockRejectedValueOnce(
      createApiError({
        errorCode: API_ERROR_CODES.VALIDATION_FAILED,
        httpStatus: 400,
        message: '请求参数校验失败',
        details: { fields: [{ field: 'newPassword', message: '新密码不满足密码策略' }] },
      }),
    )
    renderWithProviders(<PasswordForm submitting={false} onSubmit={submitSpy} />)
    await fillAndSubmit(user)
    expect(await screen.findByText('新密码不满足密码策略')).toBeInTheDocument()

    submitSpy.mockRejectedValueOnce(
      createApiError({ errorCode: API_ERROR_CODES.INTERNAL_ERROR, httpStatus: 500, message: '服务器内部错误' }),
    )
    await fillAndSubmit(user)
    expect(await screen.findByText('服务器内部错误，请稍后重试')).toBeInTheDocument()
  })
})
