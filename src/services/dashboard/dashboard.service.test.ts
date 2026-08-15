/**
 * Dashboard 概览接口测试（规格 §14.3/§7.1）：
 * GET /dashboard/overview 经 request<T>() 完成类型解包；endpoint 引用 dashboard 域常量；
 * 失败 envelope 转 ApiError；send 参数注入页签作用域请求函数（usePageRequest 形态）。
 * 经 configureRequestAdapter 注入 mock adapter 走默认请求运行时（与生产路径一致）。
 */
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DASHBOARD_ENDPOINTS } from '@/constants/dashboard/dashboard.constants'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { configureRequestAdapter } from '@/services/request/request'
import type { ApiError } from '@/services/request/request.types'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'
import { createMockAdapter, failureEnvelope, successEnvelope, type MockAdapter } from '@/test/requestTestHelpers'
import { getDashboardOverview, type SendRequest } from './dashboard.service'

const overviewFixture: DashboardOverview = {
  stats: { userCount: 12, enabledUserCount: 10, roleCount: 2, todayLoginCount: 7 },
  loginTrend: [
    { date: '2026-08-09', count: 3 },
    { date: '2026-08-10', count: 5 },
  ],
  userGrowth: [
    { date: '2026-08-09', count: 10 },
    { date: '2026-08-10', count: 12 },
  ],
  roleDistribution: [{ roleName: '演示管理员角色', count: 1, percent: 25 }],
}

let adapter: MockAdapter

beforeEach(() => {
  adapter = createMockAdapter()
  configureRequestAdapter(() => adapter.adapter)
})

afterEach(() => {
  configureRequestAdapter(null)
  window.localStorage.clear()
})

describe('GET /dashboard/overview（规格 §14.3）', () => {
  it('解包 envelope data 并以 GET 访问 dashboard 域常量 endpoint', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(overviewFixture) }))
    await expect(getDashboardOverview()).resolves.toEqual(overviewFixture)
    expect(adapter.calls.length).toBe(1)
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe(DASHBOARD_ENDPOINTS.OVERVIEW)
    expect(config.method).toBe('get')
  })

  it('失败 envelope 转为 ApiError（errorCode 透传）', async () => {
    adapter.respondWith(() => ({
      status: 500,
      data: failureEnvelope(500, API_ERROR_CODES.INTERNAL_ERROR, '服务端异常'),
    }))
    const error: ApiError = await getDashboardOverview().catch((e) => e)
    expect(error).toMatchObject({
      name: 'ApiError',
      httpStatus: 500,
      errorCode: API_ERROR_CODES.INTERNAL_ERROR,
    })
  })

  it('send 参数注入页签作用域请求函数：endpoint 仍由 service 组装', async () => {
    const sentConfigs: AxiosRequestConfig[] = []
    const send: SendRequest = <T,>(config: AxiosRequestConfig): Promise<T> => {
      sentConfigs.push(config)
      return Promise.resolve(config as unknown as T)
    }
    await getDashboardOverview(send)
    expect(sentConfigs).toHaveLength(1)
    expect(sentConfigs[0]).toMatchObject({ url: DASHBOARD_ENDPOINTS.OVERVIEW, method: 'get' })
    // 默认参数走真实 request 传输：上方两条用例已覆盖，此处不再经 mock adapter 发请求
    expect(adapter.calls.length).toBe(0)
  })
})
