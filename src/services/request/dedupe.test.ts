/**
 * 去重 key 与稳定序列化单元测试（规格 §7.4-5）：
 * 递归排序对象 key、保序数组与同名查询参数、拒绝函数/循环引用；
 * key 覆盖 method、规范化 baseURL/url、params、responseType、Accept、scopeId、sessionEpoch。
 */
import { describe, expect, it } from 'vitest'
import { buildDedupeKey, stableSerializeParams } from './dedupe'

describe('stableSerializeParams（规格 §7.4-5）', () => {
  it('对象递归排序 key：key 顺序不影响序列化结果', () => {
    expect(stableSerializeParams({ a: 1, b: { y: 2, x: 3 } })).toBe(stableSerializeParams({ b: { x: 3, y: 2 }, a: 1 }))
  })

  it('数组与同名查询参数保持原顺序：顺序不同则序列化不同', () => {
    expect(stableSerializeParams({ ids: [1, 2] })).not.toBe(stableSerializeParams({ ids: [2, 1] }))
    const q1 = new URLSearchParams([['id', '1'], ['id', '2']])
    const q2 = new URLSearchParams([['id', '2'], ['id', '1']])
    expect(stableSerializeParams(q1)).not.toBe(stableSerializeParams(q2))
    // 同名参数完全同序则一致
    expect(stableSerializeParams(new URLSearchParams([['id', '1'], ['id', '2']]))).toBe(stableSerializeParams(q1))
  })

  it('不同类型与字面量值不互相碰撞；null/undefined/bigint/Date 可序列化', () => {
    expect(stableSerializeParams('1')).not.toBe(stableSerializeParams(1))
    expect(stableSerializeParams(true)).not.toBe(stableSerializeParams('true'))
    expect(stableSerializeParams(null)).toBe('null')
    expect(stableSerializeParams(undefined)).toBe('undefined')
    expect(stableSerializeParams(10n)).toBe('bigint:10')
    expect(stableSerializeParams(new Date('2026-08-15T00:00:00Z'))).toBe(
      stableSerializeParams(new Date('2026-08-15T00:00:00Z')),
    )
    // undefined 字段被省略，不参与 key
    expect(stableSerializeParams({ a: 1, b: undefined })).toBe(stableSerializeParams({ a: 1 }))
  })

  it('函数与 Symbol 抛出 ApiError', () => {
    expect(() => stableSerializeParams({ fn: () => 1 })).toThrowError('请求参数包含函数或循环引用')
    expect(() => stableSerializeParams(Symbol('x'))).toThrowError('请求参数包含函数或循环引用')
    expect(() => stableSerializeParams([{ fn: () => 1 }])).toThrowError('请求参数包含函数或循环引用')
  })

  it('循环引用抛出 ApiError；非循环的同形状对象不误判', () => {
    const circular: Record<string, unknown> = { name: 'a' }
    circular.self = circular
    expect(() => stableSerializeParams(circular)).toThrowError('请求参数包含函数或循环引用')
    const a: Record<string, unknown> = { name: 'a' }
    const b: Record<string, unknown> = { name: 'a' }
    b.peer = a
    a.peer = b
    expect(() => stableSerializeParams(a)).toThrowError('请求参数包含函数或循环引用')
    // 同一对象在非循环位置重复出现（DAG）允许序列化
    const shared = { x: 1 }
    expect(stableSerializeParams({ p: shared, q: shared })).toContain('object')
  })
})

describe('buildDedupeKey（规格 §7.4-5）', () => {
  it('method 大小写归一；默认 responseType 归一为 json', () => {
    const base = { url: '/users', sessionEpoch: 0 }
    expect(buildDedupeKey({ ...base, method: 'get' })).toBe(buildDedupeKey({ ...base, method: 'GET' }))
    expect(buildDedupeKey({ ...base, method: 'get', responseType: 'json' })).toBe(buildDedupeKey({ ...base, method: 'get' }))
  })

  it('规范化 baseURL/url：拼接等价的形式产生相同 key', () => {
    expect(buildDedupeKey({ method: 'GET', baseURL: '/api/', url: '/users', sessionEpoch: 0 })).toBe(
      buildDedupeKey({ method: 'GET', baseURL: '/api', url: 'users', sessionEpoch: 0 }),
    )
    // 绝对地址不再叠加 baseURL，但等价绝对地址与 base+相对拼接应区分
    const absolute = buildDedupeKey({ method: 'GET', baseURL: '/api', url: 'https://cdn.example/users', sessionEpoch: 0 })
    const relative = buildDedupeKey({ method: 'GET', baseURL: '/api', url: '/users', sessionEpoch: 0 })
    expect(absolute).not.toBe(relative)
  })

  it('url 查询串参与 key：同名参数顺序不同则 key 不同', () => {
    expect(buildDedupeKey({ method: 'GET', url: '/users?id=1&id=2', sessionEpoch: 0 })).not.toBe(
      buildDedupeKey({ method: 'GET', url: '/users?id=2&id=1', sessionEpoch: 0 }),
    )
    // 等价编码归一后一致
    expect(buildDedupeKey({ method: 'GET', url: '/users?name=a%20b', sessionEpoch: 0 })).toBe(
      buildDedupeKey({ method: 'GET', url: '/users?name=a+b', sessionEpoch: 0 }),
    )
  })

  it('scopeId、sessionEpoch、params、Accept 任一不同则 key 不同', () => {
    const base = { method: 'GET', url: '/users' }
    const key = buildDedupeKey({ ...base, scopeId: 'tab-1', sessionEpoch: 1, params: { page: 1 } })
    expect(key).not.toBe(buildDedupeKey({ ...base, scopeId: 'tab-2', sessionEpoch: 1, params: { page: 1 } }))
    expect(key).not.toBe(buildDedupeKey({ ...base, scopeId: 'tab-1', sessionEpoch: 2, params: { page: 1 } }))
    expect(key).not.toBe(buildDedupeKey({ ...base, scopeId: 'tab-1', sessionEpoch: 1, params: { page: 2 } }))
    expect(key).not.toBe(
      buildDedupeKey({
        ...base,
        scopeId: 'tab-1',
        sessionEpoch: 1,
        params: { page: 1 },
        headers: { Accept: 'text/csv' },
      }),
    )
  })

  it('headers 兼容 AxiosHeaders 与普通对象两种读取形态', () => {
    const fromObject = buildDedupeKey({ method: 'GET', url: '/users', sessionEpoch: 0, headers: { Accept: 'text/csv' } })
    const fromGet = buildDedupeKey({
      method: 'GET',
      url: '/users',
      sessionEpoch: 0,
      headers: { get: (name: string) => (name === 'Accept' ? 'text/csv' : undefined) },
    })
    expect(fromObject).toBe(fromGet)
  })
})
