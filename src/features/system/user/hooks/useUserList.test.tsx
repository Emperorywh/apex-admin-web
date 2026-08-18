/**
 * useUserList 测试（规格 §14.3、§17.24）：
 * 初始加载（默认分页、未传 sortBy）、keyword 去空白、排序与分页参数、页签作用域注入、
 * 快速查询/分页时前请求被取消（调用方 signal abort）且陈旧响应不覆盖后请求结果、
 * 失败收敛与 reload。
 * 请求层 request 以 mock 替换、user.service 保持真实实现：
 * Hook 注入的页签作用域发送函数最终经 request 发出，url/params/scopeId/signal 全程可观测。
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestScopeProvider } from '@/components/RequestScopeProvider/RequestScopeProvider'
import type { PageResult, User } from '@/types/system/user/user.types'
import { useUserList } from './useUserList'

const { requestSpy } = vi.hoisted(() => ({ requestSpy: vi.fn() }))

vi.mock('@/services/request/request', () => ({ request: requestSpy }))

/** 测试页签作用域标识：经 RequestScopeProvider 注入后应出现在请求配置中 */
const TEST_SCOPE_ID = 'user-list-test-tab'

function userFixture(id: string, username: string): User {
  return {
    id,
    username,
    displayName: `${username} 显示名`,
    email: `${username}@example.com`,
    status: 'enabled',
    roleIds: [],
    createdAt: '2026-08-15T00:00:00+08:00',
    updatedAt: '2026-08-15T00:00:00+08:00',
  }
}

function pageFixture(usernames: string[]): PageResult<User> {
  return {
    list: usernames.map((name, index) => userFixture(`u-${index + 1}`, name)),
    total: usernames.length,
    page: 1,
    size: 10,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  // usePageRequest 要求处于页签请求作用域内（规格 §7.4-6）
  return <RequestScopeProvider scopeId={TEST_SCOPE_ID}>{children}</RequestScopeProvider>
}

/** 捕获一次 request 调用的请求配置 */
function capturedConfig(call = 0): { url?: string; method?: string; params?: Record<string, unknown>; scopeId?: string; signal?: AbortSignal } {
  return requestSpy.mock.calls[call][0]
}

beforeEach(() => {
  requestSpy.mockReset()
  requestSpy.mockResolvedValue(pageFixture(['admin']))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useUserList（规格 §14.3/§17.24）', () => {
  it('挂载即加载：GET user 域 endpoint、默认第 1 页/size 10、未传 sortBy、附页签作用域', async () => {
    const { result } = renderHook(() => useUserList(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.users.map((user) => user.username)).toEqual(['admin'])
    expect(result.current.total).toBe(1)
    const config = capturedConfig()
    expect(config.url).toBe('/users')
    expect(config.method).toBe('get')
    expect(config.params).toEqual({ page: 1, size: 10, keyword: '' })
    expect('sortBy' in (config.params ?? {})).toBe(false)
    expect('sortOrder' in (config.params ?? {})).toBe(false)
    // 请求绑定页签作用域：页签隐藏/关闭/淘汰时统一取消（规格 §7.4-6）
    expect(config.scopeId).toBe(TEST_SCOPE_ID)
  })

  it('searchKeyword：keyword 去空白后发送并重置回第 1 页', async () => {
    const { result } = renderHook(() => useUserList(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.searchKeyword('  Admin  ')
    })
    await waitFor(() => expect(requestSpy).toHaveBeenCalledTimes(2))
    expect(capturedConfig(1).params).toMatchObject({ keyword: 'Admin', page: 1 })
    expect(result.current.query.keyword).toBe('  Admin  ')
  })

  it('changeSort：发送白名单 sortBy/sortOrder 并重置回第 1 页；undefined 恢复默认排序', async () => {
    const { result } = renderHook(() => useUserList(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.changePagination(3, 20)
    })
    await waitFor(() => expect(capturedConfig(1).params).toMatchObject({ page: 3, size: 20 }))

    await act(async () => {
      result.current.changeSort('username', 'desc')
    })
    await waitFor(() =>
      expect(capturedConfig(2).params).toMatchObject({ sortBy: 'username', sortOrder: 'desc', page: 1 }),
    )
    expect(result.current.query.sortBy).toBe('username')

    await act(async () => {
      result.current.changeSort(undefined, 'desc')
    })
    await waitFor(() => expect('sortBy' in (capturedConfig(3).params ?? {})).toBe(false))
    expect(result.current.query.sortBy).toBeUndefined()
  })

  it('changePagination：翻页与新每页条数随请求发送', async () => {
    const { result } = renderHook(() => useUserList(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.changePagination(2, 20)
    })
    await waitFor(() => expect(capturedConfig(1).params).toEqual({ page: 2, size: 20, keyword: '' }))
  })

  it('§17.24：快速连续查询时前请求的调用方 signal 被 abort，后请求结果胜出', async () => {
    // 第一次请求挂起不决；第二次立即返回
    requestSpy.mockImplementationOnce(
      () =>
        new Promise<PageResult<User>>((resolve) => {
          setTimeout(() => resolve(pageFixture(['stale'])), 50)
        }),
    )
    requestSpy.mockResolvedValueOnce(pageFixture(['fresh']))

    const { result } = renderHook(() => useUserList(), { wrapper })
    const firstSignal = capturedConfig(0).signal
    expect(firstSignal).toBeInstanceOf(AbortSignal)

    // 发起第二次查询：Effect 清理 abort 第一次请求的调用方 signal（前请求被取消）
    await act(async () => {
      result.current.searchKeyword('fresh')
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(firstSignal?.aborted).toBe(true)
    expect(result.current.users.map((user) => user.username)).toEqual(['fresh'])
  })

  it('§17.24：乱序返回的陈旧响应（未被取消）不覆盖后请求结果', async () => {
    let resolveFirst!: (page: PageResult<User>) => void
    requestSpy.mockImplementationOnce(
      () =>
        new Promise<PageResult<User>>((resolve) => {
          resolveFirst = resolve
        }),
    )
    requestSpy.mockResolvedValueOnce(pageFixture(['second']))

    const { result } = renderHook(() => useUserList(), { wrapper })
    await act(async () => {
      result.current.searchKeyword('second')
    })
    await waitFor(() => expect(result.current.users.map((user) => user.username)).toEqual(['second']))

    // 第一次（陈旧）请求此时才落定：不得覆盖第二次结果
    await act(async () => {
      resolveFirst(pageFixture(['stale-first']))
    })
    expect(result.current.users.map((user) => user.username)).toEqual(['second'])
  })

  it('真实失败：loading 收敛为 false、保留现有数据态（提示由请求层负责）', async () => {
    requestSpy.mockRejectedValue(new Error('服务端异常'))
    const { result } = renderHook(() => useUserList(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.users).toEqual([])
    expect(result.current.total).toBe(0)
  })

  it('reload：按当前条件重新发起请求并更新数据', async () => {
    const { result } = renderHook(() => useUserList(), { wrapper })
    await waitFor(() => expect(result.current.users).toHaveLength(1))

    requestSpy.mockResolvedValueOnce({ ...pageFixture(['admin', 'viewer']), total: 2 })
    await act(async () => {
      result.current.reload()
    })
    await waitFor(() => expect(result.current.users).toHaveLength(2))
    expect(requestSpy).toHaveBeenCalledTimes(2)
  })

  it('§17.24：被取消的请求以拒绝落定时同样静默，不覆盖后请求结果', async () => {
    // 第一次请求在 abort 后以拒绝落定（对应 catch 路径的 aborted 分支）
    requestSpy.mockImplementationOnce(
      () =>
        new Promise<PageResult<User>>((_resolve, reject) => {
          setTimeout(() => reject(new Error('canceled')), 30)
        }),
    )
    requestSpy.mockResolvedValueOnce(pageFixture(['fresh']))

    const { result } = renderHook(() => useUserList(), { wrapper })
    await act(async () => {
      result.current.searchKeyword('fresh')
    })
    await waitFor(() => expect(result.current.users.map((user) => user.username)).toEqual(['fresh']))
    // 等待被取消请求的延迟拒绝落定：静默处理，数据与 loading 均不受影响
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(result.current.users.map((user) => user.username)).toEqual(['fresh'])
    expect(result.current.loading).toBe(false)
  })

  it('条件未变化的重复调用不产生新请求（同值守卫）', async () => {
    const { result } = renderHook(() => useUserList(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(requestSpy).toHaveBeenCalledTimes(1)

    // 初始条件即第 1 页/空关键字/默认排序/默认分页：重复提交相同条件直接短路
    await act(async () => {
      result.current.searchKeyword('')
    })
    await act(async () => {
      result.current.changeSort(undefined, 'desc')
    })
    await act(async () => {
      result.current.changePagination(1, 10)
    })
    expect(requestSpy).toHaveBeenCalledTimes(1)
  })
})
