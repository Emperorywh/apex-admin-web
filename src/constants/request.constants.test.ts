import { describe, expect, test } from 'vitest'
import {
  API_ERROR_CODES,
  API_SUCCESS_CODE,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  GLOBAL_REQUEST_SCOPE,
  PAGE_DEFAULT,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  REQUEST_TIMEOUT_MS,
  SORT_ORDERS,
} from './request.constants'

/** 规格 §7.1/§14.4 固定的 10 个稳定错误码 */
const SPEC_ERROR_CODES = [
  'VALIDATION_FAILED',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_ACCOUNT_DISABLED',
  'AUTH_ACCESS_EXPIRED',
  'AUTH_REFRESH_EXPIRED',
  'AUTH_PERMISSION_CHANGED',
  'AUTH_FORBIDDEN',
  'RESOURCE_NOT_FOUND',
  'RESOURCE_CONFLICT',
  'INTERNAL_ERROR',
] as const

describe('request.constants', () => {
  test('请求超时固定为 15000 毫秒（§7.4）', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(15_000)
  })

  test('成功 envelope 业务码固定为 0（§7.1）', () => {
    expect(API_SUCCESS_CODE).toBe(0)
  })

  test('稳定错误码恰好包含 §7.1 的 10 个且无重复', () => {
    const values = Object.values(API_ERROR_CODES).sort()
    expect(values).toEqual([...SPEC_ERROR_CODES].sort())
    expect(new Set(values).size).toBe(values.length)
    // 键名与值一致，便于从 errorCode 反查语义
    for (const [key, value] of Object.entries(API_ERROR_CODES)) {
      expect(key).toBe(value)
    }
  })

  test('分页默认值与上限符合 §14.3：page 从 1 开始、size 默认 10、最大 100', () => {
    expect(PAGE_DEFAULT).toBe(1)
    expect(PAGE_SIZE_DEFAULT).toBe(10)
    expect(PAGE_SIZE_MAX).toBe(100)
  })

  test('排序枚举与默认排序符合 §14.3', () => {
    expect(SORT_ORDERS).toEqual({ ASC: 'asc', DESC: 'desc' })
    expect(DEFAULT_SORT_BY).toBe('createdAt')
    expect(DEFAULT_SORT_ORDER).toBe('desc')
  })

  test('全局请求作用域标识为 global（§7.3）', () => {
    expect(GLOBAL_REQUEST_SCOPE).toBe('global')
  })
})
