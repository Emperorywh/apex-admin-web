/**
 * 演示模式 Badge 测试（规格 §13.2）：demo 会话常驻显示「演示模式」，非 demo 会话渲染 null；
 * force 构建下无论来源如何均按 demo 会话标识（全部请求由 demo adapter 承载）。
 */
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokensStored } from '@/store/slices/user.slice'
import { renderWithProviders } from '@/test/componentTestHelpers'
import { DemoBadge } from './DemoBadge'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DemoBadge（规格 §13.2）', () => {
  it('sessionSource=demo 时常驻显示「演示模式」', async () => {
    const view = renderWithProviders(<DemoBadge />)
    view.store.dispatch(
      tokensStored({ accessToken: 'demo-at.admin.1', refreshToken: 'demo-rt.admin.2.1', sessionSource: 'demo' }),
    )
    expect(await screen.findByText('演示模式')).toBeInTheDocument()
  })

  it('sessionSource=real 或未登录时不渲染', async () => {
    const real = renderWithProviders(<DemoBadge />)
    real.store.dispatch(tokensStored({ accessToken: 'real-at', refreshToken: 'real-rt', sessionSource: 'real' }))
    // 等待一拍让 store 订阅重渲染落定，真实来源保持不渲染
    await Promise.resolve()
    expect(real.container.firstChild).toBeNull()
    real.unmount()

    const anonymous = renderWithProviders(<DemoBadge />)
    expect(anonymous.container.firstChild).toBeNull()
  })

  it('force 构建（VITE_DEMO_MODE=force）下 real 来源也按 demo 会话标识', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'force')
    const view = renderWithProviders(<DemoBadge />)
    view.store.dispatch(tokensStored({ accessToken: 'at', refreshToken: 'rt', sessionSource: 'real' }))
    expect(await screen.findByText('演示模式')).toBeInTheDocument()
  })

  it('off 构建（VITE_DEMO_MODE=off）下不渲染', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'off')
    const view = renderWithProviders(<DemoBadge />)
    view.store.dispatch(
      tokensStored({ accessToken: 'demo-at.admin.1', refreshToken: 'demo-rt.admin.2.1', sessionSource: 'demo' }),
    )
    expect(view.container.firstChild).toBeNull()
  })
})
