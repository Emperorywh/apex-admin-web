/**
 * 登录页演示账号提示测试（SPEC-UI §6）：展示 demo 常量中的两个账号与「密码任意」说明，
 * 账号不硬编码（随 demo.constants 演进）。
 */
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/componentTestHelpers'
import { DemoLoginHint } from './DemoLoginHint'

describe('DemoLoginHint（SPEC-UI §6）', () => {
  it('展示演示账号标签与 admin/viewer（密码任意）', () => {
    renderWithProviders(<DemoLoginHint />)
    expect(screen.getByText('演示账号')).toBeInTheDocument()
    expect(screen.getByText(/admin \/ viewer/)).toHaveTextContent('admin / viewer · 密码任意')
  })
})
