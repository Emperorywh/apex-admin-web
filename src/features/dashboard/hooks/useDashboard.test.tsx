/**
 * useDashboard 测试（规格 §14.2/§7.4-6/§7.4-9）：
 * 数据统一来自 GET /dashboard/overview；请求经页签作用域注入；成功/失败/取消与手动刷新。
 * service 模块以 mock 替换，专注 Hook 的状态收敛。
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiError } from '@/services/request/envelope'
import type { ApiError } from '@/services/request/request.types'
import { RequestScopeProvider } from '@/components/RequestScopeProvider/RequestScopeProvider'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'
import { useDashboard } from './useDashboard'

const { overviewSpy } = vi.hoisted(() => ({ overviewSpy: vi.fn() }))

vi.mock('@/services/dashboard/dashboard.service', () => ({
  getDashboardOverview: overviewSpy,
}))

const overviewFixture: DashboardOverview = {
  stats: { userCount: 12, enabledUserCount: 10, roleCount: 2, todayLoginCount: 7 },
  loginTrend: [{ date: '2026-08-09', count: 3 }],
  userGrowth: [{ date: '2026-08-09', count: 12 }],
  roleDistribution: [{ roleName: '演示管理员角色', count: 1, percent: 25 }],
}

function wrapper({ children }: { children: ReactNode }) {
  // usePageRequest 要求处于页签请求作用域内（规格 §7.4-6）
  return <RequestScopeProvider scopeId="test-tab">{children}</RequestScopeProvider>
}

beforeEach(() => {
  overviewSpy.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useDashboard（规格 §14.2）', () => {
  it('挂载即加载：成功后写入 overview 并结束 loading，请求经页签作用域函数发出', async () => {
    overviewSpy.mockResolvedValue(overviewFixture)
    const { result } = renderHook(() => useDashboard(), { wrapper })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.overview).toEqual(overviewFixture))
    expect(result.current.loading).toBe(false)
    // service 收到的是 usePageRequest 注入的请求函数（自动附加 scopeId）
    expect(overviewSpy).toHaveBeenCalledTimes(1)
    expect(typeof overviewSpy.mock.calls[0][0]).toBe('function')
  })

  it('真实失败：overview 保持 null、loading 收敛为 false（提示由请求层负责）', async () => {
    overviewSpy.mockRejectedValue(
      createApiError({ httpStatus: 500, message: '服务端异常' }) as ApiError,
    )
    const { result } = renderHook(() => useDashboard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.overview).toBeNull()
  })

  it('取消（canceled）同样收敛 loading，不视为数据就绪', async () => {
    overviewSpy.mockRejectedValue(createApiError({ message: '已取消', canceled: true }) as ApiError)
    const { result } = renderHook(() => useDashboard(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.overview).toBeNull()
  })

  it('refresh 再次发起请求并更新数据', async () => {
    overviewSpy.mockResolvedValueOnce(overviewFixture)
    const { result } = renderHook(() => useDashboard(), { wrapper })
    await waitFor(() => expect(result.current.overview).toEqual(overviewFixture))

    const refreshed: DashboardOverview = { ...overviewFixture, stats: { ...overviewFixture.stats, userCount: 13 } }
    overviewSpy.mockResolvedValueOnce(refreshed)
    await act(async () => {
      await result.current.refresh()
    })
    expect(overviewSpy).toHaveBeenCalledTimes(2)
    expect(result.current.overview).toEqual(refreshed)
  })
})
