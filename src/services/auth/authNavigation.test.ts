/**
 * 认证导航意图通道测试：注册消费、未注册静默丢弃与清空注册。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emitAuthNavigation, registerAuthNavigator } from './authNavigation'

afterEach(() => {
  registerAuthNavigator(null)
})

describe('认证导航意图通道', () => {
  it('未注册消费方时静默丢弃意图，不抛错', () => {
    expect(() => emitAuthNavigation({ kind: 'post-login', target: '/dashboard' })).not.toThrow()
    expect(() => emitAuthNavigation({ kind: 'route-forbidden', target: '/403' })).not.toThrow()
  })

  it('注册后消费方按原样收到意图', () => {
    const navigator = vi.fn()
    registerAuthNavigator(navigator)
    const intent = { kind: 'post-logout' as const, target: '/login' }
    emitAuthNavigation(intent)
    expect(navigator).toHaveBeenCalledTimes(1)
    expect(navigator).toHaveBeenCalledWith(intent)
  })

  it('清空注册后不再接收意图', () => {
    const navigator = vi.fn()
    registerAuthNavigator(navigator)
    registerAuthNavigator(null)
    emitAuthNavigation({ kind: 'post-login', target: '/dashboard' })
    expect(navigator).not.toHaveBeenCalled()
  })
})
