/**
 * LoginForm 测试（规格 §14.2）：字段校验、提交走登录状态机、
 * 已知 errorCode 的行内错误呈现与回跳目标展示。
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { createApiError } from '@/services/request/envelope'
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm'
import { renderWithProviders } from '@/test/componentTestHelpers'

const { loginSpy } = vi.hoisted(() => ({ loginSpy: vi.fn() }))

vi.mock('@/services/auth/auth.session', () => ({
  getDefaultAuthSessionRuntime: () => ({ loginWithCredentials: loginSpy }),
}))

afterEach(() => {
  loginSpy.mockReset()
  window.history.replaceState({}, '', '/')
})

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByPlaceholderText('用户名'), 'admin')
  await user.type(screen.getByPlaceholderText('密码'), 'secret')
  await user.click(screen.getByRole('button', { name: /登\s*录/ }))
}

describe('LoginForm（规格 §14.2）', () => {
  it('空提交触发行内必填校验，不调用登录状态机', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)
    await user.click(screen.getByRole('button', { name: /登\s*录/ }))
    expect(await screen.findByText('请输入用户名')).toBeInTheDocument()
    expect(await screen.findByText('请输入密码')).toBeInTheDocument()
    expect(loginSpy).not.toHaveBeenCalled()
  })

  it('用户名纯空白同样触发必填校验', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)
    await user.type(screen.getByPlaceholderText('用户名'), '   ')
    await user.click(screen.getByRole('button', { name: /登\s*录/ }))
    expect(await screen.findByText('请输入用户名')).toBeInTheDocument()
    expect(loginSpy).not.toHaveBeenCalled()
  })

  it('合法输入提交：以表单值调用登录状态机', async () => {
    loginSpy.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)
    await fillAndSubmit(user)
    await waitFor(() => expect(loginSpy).toHaveBeenCalledWith({ username: 'admin', password: 'secret' }))
  })

  it('登录失败：已知 errorCode 映射为本地化行内错误（AUTH_INVALID_CREDENTIALS）', async () => {
    loginSpy.mockRejectedValue(
      createApiError({ httpStatus: 401, errorCode: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, message: '后端原始文案' }),
    )
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)
    await fillAndSubmit(user)
    // 已知 errorCode 映射为前端 i18n 文案，不透出后端 message（规格 §7.4-3）
    expect(await screen.findByText('用户名或密码错误')).toBeInTheDocument()
    expect(screen.queryByText('后端原始文案')).not.toBeInTheDocument()
  })

  it('登录失败：未知错误显示固定兜底文案', async () => {
    loginSpy.mockRejectedValue(new Error('突发异常'))
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)
    await fillAndSubmit(user)
    expect(await screen.findByText('请求失败，请稍后重试')).toBeInTheDocument()
  })

  it('携带回跳参数时展示登录后的去向', () => {
    window.history.replaceState({}, '', '/login?redirect=%2Fsystem%2Fuser')
    renderWithProviders(<LoginForm />)
    expect(screen.getByText('登录后将前往：', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('/system/user')).toBeInTheDocument()
  })

  it('无回跳参数时不展示去向提示', () => {
    renderWithProviders(<LoginForm />)
    expect(screen.queryByText(/登录后将前往/)).not.toBeInTheDocument()
  })
})
