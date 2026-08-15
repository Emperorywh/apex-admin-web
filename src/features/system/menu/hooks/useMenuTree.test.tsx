/**
 * useMenuTree 测试（规格 §14.3、§17.24）：
 * 挂载加载（GET 菜单树 endpoint、无分页参数）、页签作用域注入、reload 重新加载、
 * 快速 reload 时前请求被取消（调用方 signal abort）且陈旧响应不覆盖后请求结果、
 * 失败收敛。
 * 请求层 request 以 mock 替换、menu.service 保持真实实现：
 * Hook 注入的页签作用域发送函数最终经 request 发出，url/scopeId/signal 全程可观测。
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestScopeProvider } from '@/components/RequestScopeProvider/RequestScopeProvider'
import { MENU_ENDPOINTS } from '@/constants/system/menu/menu.constants'
import type { MenuItem } from '@/types/system/menu/menu.types'
import { useMenuTree } from './useMenuTree'

const { requestSpy } = vi.hoisted(() => ({ requestSpy: vi.fn() }))

vi.mock('@/services/request/request', () => ({ request: requestSpy }))

/** 测试页签作用域标识：经 RequestScopeProvider 注入后应出现在请求配置中 */
const TEST_SCOPE_ID = 'menu-tree-test-tab'

function menuFixture(id: string, name: string): MenuItem {
  return { id, parentId: null, type: 'directory', name, sort: 1, visible: true, status: 'enabled' }
}

function wrapper({ children }: { children: ReactNode }) {
  // usePageRequest 要求处于页签请求作用域内（规格 §7.4-6）
  return <RequestScopeProvider scopeId={TEST_SCOPE_ID}>{children}</RequestScopeProvider>
}

/** 捕获一次 request 调用的请求配置 */
function capturedConfig(call = 0): { url?: string; method?: string; params?: unknown; scopeId?: string; signal?: AbortSignal } {
  return requestSpy.mock.calls[call][0]
}

beforeEach(() => {
  requestSpy.mockReset()
  requestSpy.mockResolvedValue([menuFixture('m-1', '系统管理')])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useMenuTree（规格 §14.3/§17.24）', () => {
  it('挂载即加载：GET menu 域树 endpoint、无分页参数、附页签作用域', async () => {
    const { result } = renderHook(() => useMenuTree(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.menus.map((menu) => menu.name)).toEqual(['系统管理'])
    const config = capturedConfig()
    expect(config.url).toBe(MENU_ENDPOINTS.TREE)
    expect(config.method).toBe('get')
    expect(config.params).toBeUndefined()
    // 请求绑定页签作用域：页签隐藏/关闭/淘汰时统一取消（规格 §7.4-6）
    expect(config.scopeId).toBe(TEST_SCOPE_ID)
  })

  it('reload：重新发起请求并更新数据', async () => {
    const { result } = renderHook(() => useMenuTree(), { wrapper })
    await waitFor(() => expect(result.current.menus).toHaveLength(1))

    requestSpy.mockResolvedValueOnce([menuFixture('m-1', '系统管理'), menuFixture('m-2', '演示')])
    await act(async () => {
      result.current.reload()
    })
    await waitFor(() => expect(result.current.menus).toHaveLength(2))
    expect(requestSpy).toHaveBeenCalledTimes(2)
  })

  it('§17.24：快速 reload 时前请求的调用方 signal 被 abort，后请求结果胜出', async () => {
    // 第一次请求挂起不决；第二次立即返回
    requestSpy.mockImplementationOnce(
      () =>
        new Promise<MenuItem[]>((resolve) => {
          setTimeout(() => resolve([menuFixture('stale', '陈旧')]), 50)
        }),
    )
    requestSpy.mockResolvedValueOnce([menuFixture('fresh', '最新')])

    const { result } = renderHook(() => useMenuTree(), { wrapper })
    const firstSignal = capturedConfig(0).signal
    expect(firstSignal).toBeInstanceOf(AbortSignal)

    // 发起 reload：Effect 清理 abort 第一次请求的调用方 signal（前请求被取消）
    await act(async () => {
      result.current.reload()
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(firstSignal?.aborted).toBe(true)
    expect(result.current.menus.map((menu) => menu.id)).toEqual(['fresh'])
  })

  it('§17.24：乱序返回的陈旧响应（未被取消）不覆盖后请求结果', async () => {
    let resolveFirst!: (tree: MenuItem[]) => void
    requestSpy.mockImplementationOnce(
      () =>
        new Promise<MenuItem[]>((resolve) => {
          resolveFirst = resolve
        }),
    )
    requestSpy.mockResolvedValueOnce([menuFixture('second', '第二次')])

    const { result } = renderHook(() => useMenuTree(), { wrapper })
    await act(async () => {
      result.current.reload()
    })
    await waitFor(() => expect(result.current.menus.map((menu) => menu.id)).toEqual(['second']))

    // 第一次（陈旧）请求此时才落定：不得覆盖第二次结果
    await act(async () => {
      resolveFirst([menuFixture('stale-first', '陈旧第一次')])
    })
    expect(result.current.menus.map((menu) => menu.id)).toEqual(['second'])
  })

  it('真实失败：loading 收敛为 false、保留现有数据态（提示由请求层负责）', async () => {
    requestSpy.mockRejectedValue(new Error('服务端异常'))
    const { result } = renderHook(() => useMenuTree(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.menus).toEqual([])
  })
})
