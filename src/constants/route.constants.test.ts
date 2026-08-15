import { describe, expect, test } from 'vitest'
import { REDIRECT_QUERY_KEY, ROUTE_FALLBACK_PATH, ROUTE_IDS, ROUTE_PATHS } from './route.constants'

describe('route.constants', () => {
  test('路由 ID 全局唯一且非空', () => {
    const ids = Object.values(ROUTE_IDS)
    expect(ids.every((id) => id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('路由路径全局唯一且均为以单个 / 开头的绝对路径', () => {
    const paths = Object.values(ROUTE_PATHS)
    expect(paths.every((p) => /^\/(?!\/)/.test(p))).toBe(true)
    expect(new Set(paths).size).toBe(paths.length)
  })

  test('稳定回退地址固定为 /dashboard（§4.3/§9.3）', () => {
    expect(ROUTE_FALLBACK_PATH).toBe('/dashboard')
    expect(ROUTE_FALLBACK_PATH).toBe(ROUTE_PATHS.DASHBOARD)
  })

  test('三级演示导航叶子路径与 §14.2 一致', () => {
    expect(ROUTE_PATHS.DEMO_NESTED_LEVEL3).toBe('/demo/nested/level1/level2/level3')
  })

  test('错误页路径为 /403、/404、/500（§4.2）', () => {
    expect(ROUTE_PATHS.FORBIDDEN).toBe('/403')
    expect(ROUTE_PATHS.NOT_FOUND).toBe('/404')
    expect(ROUTE_PATHS.SERVER_ERROR).toBe('/500')
  })

  test('登录回跳参数名已具名定义', () => {
    expect(typeof REDIRECT_QUERY_KEY).toBe('string')
    expect(REDIRECT_QUERY_KEY.length).toBeGreaterThan(0)
  })
})
