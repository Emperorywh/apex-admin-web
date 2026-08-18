import { describe, expect, test } from 'vitest'
import { PASSWORD_MIN_LENGTH, SESSION_SOURCES } from './auth.constants'

describe('auth.constants', () => {
  test('会话来源枚举为 real | demo（§6.1）', () => {
    expect(SESSION_SOURCES).toEqual({ REAL: 'real', DEMO: 'demo' })
  })

  test('密码最小长度为 8 位（§14.3）', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })
})
