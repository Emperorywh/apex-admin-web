import { describe, expect, test } from 'vitest'
import { AUTH_ENDPOINTS, PASSWORD_MIN_LENGTH, SESSION_SOURCES } from './auth.constants'

describe('auth.constants', () => {
  test('登录/刷新/登出路径与 §6.3 一致', () => {
    expect(AUTH_ENDPOINTS).toEqual({ LOGIN: '/auth/login', REFRESH: '/auth/refresh', LOGOUT: '/auth/logout' })
  })

  test('会话来源枚举为 real | demo（§6.1）', () => {
    expect(SESSION_SOURCES).toEqual({ REAL: 'real', DEMO: 'demo' })
  })

  test('密码最小长度为 8 位（§14.3）', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })
})
