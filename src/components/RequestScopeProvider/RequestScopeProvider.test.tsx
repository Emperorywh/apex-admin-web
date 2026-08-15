/**
 * RequestScopeProvider 组件测试（规格 §7.4-6）：
 * 提供当前页签 scopeId 的上下文供给、usePageRequest 自动附加 scopeId，
 * 以及卸载（页签关闭/缓存淘汰）时统一 abort 该 scope（TASK-011 的 PageCacheHost
 * 负责每个缓存实例挂载 Provider，本测试渲染 Provider 验证作用域契约）。
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { usePageRequest, useRequestScopeId } from '@/hooks/usePageRequest'
import { configureRequestAdapter } from '@/services/request/request'
import { abortRequestScope, hasActiveScopeRequests } from '@/services/request/requestScope'
import { createMockAdapter, deferred, successEnvelope, waitForMicrotaskCondition } from '@/test/requestTestHelpers'
import { RequestScopeProvider } from './RequestScopeProvider'

describe('RequestScopeProvider（规格 §7.4-6）', () => {
  let adapter: ReturnType<typeof createMockAdapter>

  beforeEach(() => {
    adapter = createMockAdapter()
    configureRequestAdapter(() => adapter.adapter)
    adapter.respondWith(() => ({ status: 200, data: successEnvelope('ok') }))
  })

  afterEach(() => {
    configureRequestAdapter(null)
  })

  it('提供 scopeId 上下文：useRequestScopeId 读取当前页签作用域', () => {
    let observed: string | null = 'unset'
    function Probe() {
      observed = useRequestScopeId()
      return <span>{observed}</span>
    }
    render(
      <RequestScopeProvider scopeId="tab-scope-1">
        <Probe />
      </RequestScopeProvider>,
    )
    expect(screen.getByText('tab-scope-1')).toBeInTheDocument()
    expect(observed).toBe('tab-scope-1')
  })

  it('usePageRequest 经 Provider 自动附加页签 scopeId（作用域供给验证）', async () => {
    const gate = deferred<void>()
    adapter.respondWith(() => gate.promise.then(() => ({ status: 200, data: successEnvelope('ok') })))
    function Page() {
      const pageRequest = usePageRequest()
      return (
        <button type="button" onClick={() => void pageRequest({ url: '/scoped-data' }).catch(() => undefined)}>
          load
        </button>
      )
    }
    render(
      <RequestScopeProvider scopeId="tab-scope-2">
        <Page />
      </RequestScopeProvider>,
    )
    await act(async () => {
      screen.getByRole('button', { name: 'load' }).click()
    })
    await waitForMicrotaskCondition(() => adapter.countCalls('/scoped-data') === 1)
    // 请求被派发且携带页签 scopeId，并登记进作用域注册表
    expect(adapter.calls[0]?.scopeId).toBe('tab-scope-2')
    expect(hasActiveScopeRequests('tab-scope-2')).toBe(true)
    gate.resolve()
  })

  it('Provider 卸载（页签关闭/缓存淘汰）时统一 abort 该 scope，请求转 canceled 不弹错', async () => {
    const gate = deferred<void>()
    adapter.respondWith(() => gate.promise.then(() => ({ status: 200, data: successEnvelope('late') })))
    const caught: unknown[] = []
    function Page() {
      const pageRequest = usePageRequest()
      return (
        <button type="button" onClick={() => void pageRequest({ url: '/held' }).catch((error) => caught.push(error))}>
          load
        </button>
      )
    }
    const view = render(
      <RequestScopeProvider scopeId="tab-scope-3">
        <Page />
      </RequestScopeProvider>,
    )
    await act(async () => {
      screen.getByRole('button', { name: 'load' }).click()
    })
    await waitForMicrotaskCondition(() => adapter.countCalls('/held') === 1)
    expect(hasActiveScopeRequests('tab-scope-3')).toBe(true)
    view.unmount()
    // 卸载触发统一 abort：请求以 canceled ApiError 结束，作用域登记清理
    await waitForMicrotaskCondition(() => caught.length === 1)
    expect(caught[0]).toMatchObject({ name: 'ApiError', canceled: true })
    expect(hasActiveScopeRequests('tab-scope-3')).toBe(false)
    gate.resolve()
  })

  it('不同缓存实例的作用域互不影响：相邻 Provider 各自供给自己的 scopeId', async () => {
    const gate = deferred<void>()
    adapter.respondWith(() => gate.promise.then(() => ({ status: 200, data: successEnvelope('ok') })))
    function Page({ label }: { label: string }) {
      const pageRequest = usePageRequest()
      return (
        <button type="button" onClick={() => void pageRequest({ url: '/multi' }).catch(() => undefined)}>
          {label}
        </button>
      )
    }
    render(
      <div>
        <RequestScopeProvider scopeId="cache-a">
          <Page label="a" />
        </RequestScopeProvider>
        <RequestScopeProvider scopeId="cache-b">
          <Page label="b" />
        </RequestScopeProvider>
      </div>,
    )
    await act(async () => {
      screen.getByRole('button', { name: 'a' }).click()
    })
    await act(async () => {
      screen.getByRole('button', { name: 'b' }).click()
    })
    await waitForMicrotaskCondition(() => adapter.countCalls('/multi') === 2)
    expect(adapter.calls[0]?.scopeId).toBe('cache-a')
    expect(adapter.calls[1]?.scopeId).toBe('cache-b')
    // 只 abort 一个缓存实例的作用域，另一个不受影响
    abortRequestScope('cache-a')
    expect(hasActiveScopeRequests('cache-b')).toBe(true)
    gate.resolve()
  })
})
