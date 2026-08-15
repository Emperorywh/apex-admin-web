/**
 * 回跳参数五步同源校验测试（规格 §4.3/§17.21）：
 * 四类恶意样例（https://evil.example、//evil.example、/\evil.example、控制字符）全部回退 /dashboard；
 * 站内路径通过 URL 规范化后只返回 pathname+search+hash。
 */
import { describe, expect, it } from 'vitest'
import { ROUTE_FALLBACK_PATH, REDIRECT_QUERY_KEY } from '@/constants/route.constants'
import { readSanitizedRedirectTarget, sanitizeRedirectTarget } from './redirect'

const ORIGIN = 'http://localhost:5173'

describe('sanitizeRedirectTarget（规格 §4.3 第 ②-⑤ 步）', () => {
  it('站内路径返回 pathname + search + hash 原样', () => {
    expect(sanitizeRedirectTarget('/dashboard', ORIGIN)).toBe('/dashboard')
    expect(sanitizeRedirectTarget('/system/user?id=1', ORIGIN)).toBe('/system/user?id=1')
    expect(sanitizeRedirectTarget('/demo/nested/level1#section', ORIGIN)).toBe('/demo/nested/level1#section')
  })

  it('URL 规范化：相对段被消除后仍限定同源站内地址', () => {
    expect(sanitizeRedirectTarget('/a/../dashboard', ORIGIN)).toBe('/dashboard')
  })

  it('空值与相对路径回退 /dashboard', () => {
    expect(sanitizeRedirectTarget(null, ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    expect(sanitizeRedirectTarget('', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    expect(sanitizeRedirectTarget('dashboard', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    expect(sanitizeRedirectTarget('./dashboard', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
  })

  it('四类恶意样例全部回退 /dashboard（规格 §17.21）', () => {
    // ① 绝对外站 URL：不以 / 开头直接拒绝
    expect(sanitizeRedirectTarget('https://evil.example', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    expect(sanitizeRedirectTarget('http://evil.example/path', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    // ② 协议相对地址：拒绝 //
    expect(sanitizeRedirectTarget('//evil.example', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    // ③ 反斜杠路径：会被浏览器规范化为协议相对地址，拒绝包含 \\ 的值
    expect(sanitizeRedirectTarget('/\\evil.example', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    expect(sanitizeRedirectTarget('/foo\\bar', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    // ④ 控制字符（换行/制表/C0/DEL）：拒绝
    expect(sanitizeRedirectTarget('/foo\nbar', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    expect(sanitizeRedirectTarget('/foo\tbar', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    expect(sanitizeRedirectTarget(`/foo${String.fromCharCode(0)}bar`, ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    expect(sanitizeRedirectTarget(`/foo${String.fromCharCode(127)}`, ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
  })
})

describe('readSanitizedRedirectTarget（规格 §4.3 第 ①-⑤ 步完整入口）', () => {
  it('第 ① 步经 URLSearchParams#get 解码一次：预编码的站内路径正确还原', () => {
    const params = new URLSearchParams()
    params.set(REDIRECT_QUERY_KEY, '/system/user?id=1#top')
    const target = readSanitizedRedirectTarget(`?${params.toString()}`, ORIGIN)
    expect(target).toBe('/system/user?id=1#top')
  })

  it('预编码的恶意样例同样被拒绝：解码后的形态进入第 ②-⑤ 步校验', () => {
    for (const malicious of ['https://evil.example', '//evil.example', '/\\evil.example', '/foo\nbar']) {
      const params = new URLSearchParams()
      params.set(REDIRECT_QUERY_KEY, malicious)
      expect(readSanitizedRedirectTarget(`?${params.toString()}`, ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    }
  })

  it('参数缺失或空串回退 /dashboard', () => {
    expect(readSanitizedRedirectTarget('', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    expect(readSanitizedRedirectTarget('?other=1', ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
    expect(readSanitizedRedirectTarget(`?${REDIRECT_QUERY_KEY}=`, ORIGIN)).toBe(ROUTE_FALLBACK_PATH)
  })
})
