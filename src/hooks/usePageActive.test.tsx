/**
 * usePageActive 测试（规格 §9.2）：激活态读取与激活变化通知，
 * 含不在 PageCacheHost 内的默认激活语义。
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PageActiveContext, usePageActive, usePageActiveChange } from '@/hooks/usePageActive'

function ActiveProbe() {
  const isActive = usePageActive()
  return <span data-testid="active">{isActive ? 'visible' : 'hidden'}</span>
}

function ChangeProbe({ onActiveChange }: { onActiveChange: (active: boolean) => void }) {
  usePageActiveChange(onActiveChange)
  return null
}

describe('usePageActive（规格 §9.2）', () => {
  it('不在缓存宿主内默认激活', () => {
    render(<ActiveProbe />)
    expect(screen.getByTestId('active')).toHaveTextContent('visible')
  })

  it('读取宿主供给的激活态并随供给翻转', () => {
    const { rerender } = render(
      <PageActiveContext.Provider value={false}>
        <ActiveProbe />
      </PageActiveContext.Provider>,
    )
    expect(screen.getByTestId('active')).toHaveTextContent('hidden')
    rerender(
      <PageActiveContext.Provider value={true}>
        <ActiveProbe />
      </PageActiveContext.Provider>,
    )
    expect(screen.getByTestId('active')).toHaveTextContent('visible')
  })

  it('usePageActiveChange 首挂载与每次翻转各回调一次，handler 引用变化不影响订阅', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(
      <PageActiveContext.Provider value={true}>
        <ChangeProbe onActiveChange={first} />
      </PageActiveContext.Provider>,
    )
    expect(first).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenLastCalledWith(true)

    // 隐藏 → 回调 false
    rerender(
      <PageActiveContext.Provider value={false}>
        <ChangeProbe onActiveChange={first} />
      </PageActiveContext.Provider>,
    )
    expect(first).toHaveBeenCalledTimes(2)
    expect(first).toHaveBeenLastCalledWith(false)

    // 重新激活 + 换 handler 引用（无需稳定）
    rerender(
      <PageActiveContext.Provider value={true}>
        <ChangeProbe onActiveChange={second} />
      </PageActiveContext.Provider>,
    )
    expect(first).toHaveBeenCalledTimes(2)
    expect(second).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenLastCalledWith(true)
  })

  it('同值供给翻转不触发重复回调', () => {
    const handler = vi.fn()
    const { rerender } = render(
      <PageActiveContext.Provider value={true}>
        <ChangeProbe onActiveChange={handler} />
      </PageActiveContext.Provider>,
    )
    rerender(
      <PageActiveContext.Provider value={true}>
        <ChangeProbe onActiveChange={handler} />
      </PageActiveContext.Provider>,
    )
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
