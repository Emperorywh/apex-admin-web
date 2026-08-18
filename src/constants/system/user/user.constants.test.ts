import { describe, expect, test } from 'vitest'
import { USER_EMAIL_PATTERN, USER_KEYWORD_FIELDS, USER_SORT_FIELDS } from './user.constants'

describe('user.constants', () => {
  test('sortBy 白名单恰为 username/displayName/status/createdAt 且无重复（§14.3）', () => {
    expect(USER_SORT_FIELDS).toEqual(['username', 'displayName', 'status', 'createdAt'])
    expect(new Set(USER_SORT_FIELDS).size).toBe(USER_SORT_FIELDS.length)
  })

  test('keyword 匹配字段恰为 username/displayName（§14.3）', () => {
    expect(USER_KEYWORD_FIELDS).toEqual(['username', 'displayName'])
  })

  test('邮箱格式正则接受常规地址并拒绝空白与缺段（§14.3）', () => {
    expect(USER_EMAIL_PATTERN.test('user@example.com')).toBe(true)
    expect(USER_EMAIL_PATTERN.test('a.b+c@sub.example.co')).toBe(true)
    expect(USER_EMAIL_PATTERN.test('user@example.c n')).toBe(false)
    expect(USER_EMAIL_PATTERN.test('user@localhost')).toBe(false)
    expect(USER_EMAIL_PATTERN.test('user example.com')).toBe(false)
    expect(USER_EMAIL_PATTERN.test('@example.com')).toBe(false)
    expect(USER_EMAIL_PATTERN.test('user@')).toBe(false)
  })
})
