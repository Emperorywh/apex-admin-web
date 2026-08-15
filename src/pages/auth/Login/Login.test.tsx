/**
 * 登录页测试（规格 §14.2 /login）：页面入口编排 LoginForm、品牌区与回跳提示；
 * 登录提交链路由 LoginForm/useLogin 各自测试覆盖，本页只验证组合渲染。
 */
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Login } from '@/pages/auth/Login/Login'
import { renderWithProviders } from '@/test/componentTestHelpers'

const { loginSpy } = vi.hoisted(() => ({ loginSpy: vi.fn() }))

vi.mock('@/services/auth/auth.session', () => ({
  getDefaultAuthSessionRuntime: () => ({ loginWithCredentials: loginSpy }),
}))

afterEach(() => {
  loginSpy.mockReset()
  window.history.replaceState({}, '', '/')
})

describe('登录页 /login（规格 §14.2）', () => {
  it('渲染品牌区与 LoginForm 的用户名/密码/登录按钮', () => {
    renderWithProviders(<Login />)
    expect(screen.getByText('Apex Admin')).toBeInTheDocument()
    expect(screen.getByText('通用后台管理模板')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /登\s*录/ })).toBeInTheDocument()
  })

  it('地址携带合法回跳参数时页面呈现去向提示', () => {
    window.history.replaceState({}, '', '/login?redirect=%2Fdashboard')
    renderWithProviders(<Login />)
    expect(screen.getByText('/dashboard')).toBeInTheDocument()
  })
})
