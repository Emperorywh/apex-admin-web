/**
 * 回跳目标同源安全校验测试（规格 §4.3/§17.21）：
 * 外站、协议相对地址、反斜杠路径与控制字符全部判为不安全。
 */
import { describe, expect, it } from 'vitest'
import { isSafeRedirectTarget } from './redirect'

describe('isSafeRedirectTarget（规格 §17.21）', () => {
  it('站内路径安全：普通路径、查询串与 hash 均通过', () => {
    expect(isSafeRedirectTarget('/dashboard')).toBe(true)
    expect(isSafeRedirectTarget('/system/user?id=1')).toBe(true)
    expect(isSafeRedirectTarget('/demo/nested/level1/level2/level3#section')).toBe(true)
  })

  it('空串与相对路径不安全', () => {
    expect(isSafeRedirectTarget('')).toBe(false)
    expect(isSafeRedirectTarget('dashboard')).toBe(false)
    expect(isSafeRedirectTarget('./dashboard')).toBe(false)
  })

  it('绝对外站 URL 与协议相对地址不安全', () => {
    expect(isSafeRedirectTarget('https://evil.example')).toBe(false)
    expect(isSafeRedirectTarget('http://evil.example/path')).toBe(false)
    expect(isSafeRedirectTarget('//evil.example')).toBe(false)
  })

  it('反斜杠路径不安全（会被浏览器规范化为协议相对地址）', () => {
    expect(isSafeRedirectTarget('/\\evil.example')).toBe(false)
    expect(isSafeRedirectTarget('/foo\\bar')).toBe(false)
  })

  it('控制字符（换行、制表、C0 与 DEL）不安全', () => {
    expect(isSafeRedirectTarget('/foo\nbar')).toBe(false)
    expect(isSafeRedirectTarget('/foo\tbar')).toBe(false)
    expect(isSafeRedirectTarget('/foo\rbar')).toBe(false)
    expect(isSafeRedirectTarget(`/foo${String.fromCharCode(0)}bar`)).toBe(false)
    expect(isSafeRedirectTarget(`/foo${String.fromCharCode(127)}`)).toBe(false)
  })
})
