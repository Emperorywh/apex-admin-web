/**
 * usePageRequest Hook 测试（规格 §7.4-6/§7.4-7）：
 * 自动附加页签 scopeId；不在 RequestScopeProvider 内使用时显式报错；
 * loader 语义（直接透传 request.signal）不进入页面 scope 由 request 层测试覆盖。
 */
import { act, render, screen } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RequestScopeProvider } from '@/components/RequestScopeProvider/RequestScopeProvider'
import { configureRequestAdapter } from '@/services/request/request'
import { hasActiveScopeRequests } from '@/services/request/requestScope'
import { createMockAdapter, successEnvelope, waitForMicrotaskCondition } from '@/test/requestTestHelpers'
import { usePageRequest } from './usePageRequest'

describe('usePageRequest（规格 §7.4-6）', () => {
  let adapter: ReturnType<typeof createMockAdapter>

  beforeEach(() => {
    adapter = createMockAdapter()
    configureRequestAdapter(() => adapter.adapter)
    adapter.respondWith(() => ({ status: 200, data: successEnvelope('ok') }))
  })

  afterEach(() => {
    configureRequestAdapter(null)
  })

  it('在 Provider 内返回附加 scopeId 的请求函数，调用后请求登记到该作用域', async () => {
    const { result } = renderHook(() => usePageRequest(), {
      wrapper: ({ children }) => <RequestScopeProvider scopeId="hook-scope">{children}</RequestScopeProvider>,
    })
    let resolved: unknown
    await act(async () => {
      resolved = await result.current({ url: '/hook-data' })
    })
    expect(resolved).toBe('ok')
    expect(adapter.calls[0]?.scopeId).toBe('hook-scope')
    // 请求已完成后作用域登记清理
    expect(hasActiveScopeRequests('hook-scope')).toBe(false)
  })

  it('不在 RequestScopeProvider 内使用时显式抛错（fail-fast 契约）', () => {
    expect(() => renderHook(() => usePageRequest())).toThrowError('usePageRequest 必须在 RequestScopeProvider 内使用')
  })

  it('不同页签（Provider scopeId 变化）自动跟随新作用域', async () => {
    function Page({ label }: { label: string }) {
      const pageRequest = usePageRequest()
      return (
        <button type="button" onClick={() => void pageRequest({ url: '/follow' }).catch(() => undefined)}>
          {label}
        </button>
      )
    }
    render(
      <RequestScopeProvider scopeId="tab-old">
        <Page label="go" />
      </RequestScopeProvider>,
    )
    await act(async () => {
      screen.getByRole('button', { name: 'go' }).click()
    })
    await waitForMicrotaskCondition(() => adapter.countCalls('/follow') === 1)
    expect(adapter.calls[0]?.scopeId).toBe('tab-old')
  })
})
