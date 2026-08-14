/**
 * §20 技术闸门 ②：Activity 生命周期。
 *
 * 验证 React 19.2 <Activity> 作为页面保活容器（§9.1）：
 * - 隐藏时保留受控/非受控输入状态与滚动容器的 scrollTop；
 * - 隐藏时执行 Effect 清理，重新显示时重建 Effect，且组件不重新初始化；
 * - 关闭页签与 LRU 淘汰后组件真正卸载（DOM 移除、状态归零），再激活是全新挂载。
 *
 * 本文件是 §20 允许的验证性 PoC：PageCacheHost 为内联最小 harness，
 * 不引用 src/ 内任何实现；生产实现由后续任务承担。
 */
import { Activity, useEffect, useRef, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

interface PageLifecycle {
  effectRuns: number
  effectCleanups: number
}

const lifecycles = new Map<string, PageLifecycle>()

function lifecycleOf(pageKey: string): PageLifecycle {
  let lifecycle = lifecycles.get(pageKey)
  if (!lifecycle) {
    lifecycle = { effectRuns: 0, effectCleanups: 0 }
    lifecycles.set(pageKey, lifecycle)
  }
  return lifecycle
}

/** 受缓存页面探针：受控输入 + 非受控输入 + 独立滚动容器 + 可清理 Effect */
function ProbePage({ pageKey }: { pageKey: string }) {
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const lifecycle = lifecycleOf(pageKey)
    lifecycle.effectRuns += 1
    return () => {
      lifecycle.effectCleanups += 1
    }
  }, [pageKey])
  return (
    <div data-testid={`page-${pageKey}`}>
      <input
        aria-label={`controlled-${pageKey}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <input aria-label={`uncontrolled-${pageKey}`} />
      {/* §9.2：每个 Activity 页面拥有独立滚动容器 */}
      <div ref={scrollRef} data-testid={`scroll-${pageKey}`} style={{ height: '120px', overflowY: 'auto' }}>
        <div style={{ height: '600px' }} />
      </div>
      <span data-testid={`state-${pageKey}`}>{text}</span>
    </div>
  )
}

/** PageCacheHost 的最小内联实现：为每个缓存页签保持稳定 key 的 Activity */
function PageCacheHost({ entries, activeKey }: { entries: string[]; activeKey: string }) {
  return (
    <div data-testid="cache-host">
      {entries.map((key) => (
        <Activity key={key} mode={key === activeKey ? 'visible' : 'hidden'}>
          <ProbePage pageKey={key} />
        </Activity>
      ))}
    </div>
  )
}

/** 容量受限的缓存宿主：entries 按最近激活优先排序，超出容量的尾部被 LRU 淘汰 */
function LruPageCacheHost({
  entries,
  activeKey,
  capacity,
}: {
  entries: string[]
  activeKey: string
  capacity: number
}) {
  const kept = entries.slice(0, capacity)
  return (
    <div data-testid="lru-cache-host">
      {kept.map((key) => (
        <Activity key={key} mode={key === activeKey ? 'visible' : 'hidden'}>
          <ProbePage pageKey={key} />
        </Activity>
      ))}
    </div>
  )
}

function inputValue(label: string): string {
  return (screen.getByLabelText(label) as HTMLInputElement).value
}

function scrollTopOf(pageKey: string): number {
  return (screen.getByTestId(`scroll-${pageKey}`) as HTMLDivElement).scrollTop
}

describe('§20 闸门 ②：Activity 生命周期', () => {
  beforeEach(() => {
    lifecycles.clear()
  })

  it('隐藏保留输入状态与 scrollTop 并清理 Effect，重新显示后恢复并重建 Effect', () => {
    const { rerender } = render(<PageCacheHost entries={['a']} activeKey="a" />)

    fireEvent.change(screen.getByLabelText('controlled-a'), { target: { value: '保留我' } })
    fireEvent.change(screen.getByLabelText('uncontrolled-a'), { target: { value: 'dom-value' } })
    ;(screen.getByTestId('scroll-a') as HTMLDivElement).scrollTop = 137
    expect(lifecycleOf('a')).toEqual({ effectRuns: 1, effectCleanups: 0 })

    // 隐藏：Effect 被清理，但受控/非受控输入与 scrollTop 全部保留
    rerender(<PageCacheHost entries={['a']} activeKey="other" />)
    expect(lifecycleOf('a')).toEqual({ effectRuns: 1, effectCleanups: 1 })
    expect(inputValue('controlled-a')).toBe('保留我')
    expect(inputValue('uncontrolled-a')).toBe('dom-value')
    expect(scrollTopOf('a')).toBe(137)
    expect(screen.getByTestId('state-a')).toHaveTextContent('保留我')

    // 重新显示：Effect 重建（runs+1），状态与滚动位置原样恢复
    rerender(<PageCacheHost entries={['a']} activeKey="a" />)
    expect(lifecycleOf('a')).toEqual({ effectRuns: 2, effectCleanups: 1 })
    expect(inputValue('controlled-a')).toBe('保留我')
    expect(inputValue('uncontrolled-a')).toBe('dom-value')
    expect(scrollTopOf('a')).toBe(137)
  })

  it('关闭页签后组件真正卸载，再次打开是全新状态而非僵尸缓存', () => {
    const { rerender } = render(<PageCacheHost entries={['a', 'b']} activeKey="a" />)
    fireEvent.change(screen.getByLabelText('controlled-a'), { target: { value: 'will-unmount' } })

    // 关闭页签 a
    rerender(<PageCacheHost entries={['b']} activeKey="b" />)
    expect(screen.queryByTestId('page-a')).toBeNull()
    expect(lifecycleOf('a')).toEqual({ effectRuns: 1, effectCleanups: 1 })

    // 重新打开 a：输入为空、scrollTop 归零、Effect 从 1 次重新开始，证明真实卸载
    rerender(<PageCacheHost entries={['a', 'b']} activeKey="a" />)
    expect(inputValue('controlled-a')).toBe('')
    expect(scrollTopOf('a')).toBe(0)
    expect(lifecycleOf('a')).toEqual({ effectRuns: 2, effectCleanups: 1 })
  })

  it('LRU 淘汰真正卸载被驱逐页签，幸存页签状态保留', () => {
    const { rerender } = render(<LruPageCacheHost entries={['a', 'b']} activeKey="a" capacity={2} />)
    fireEvent.change(screen.getByLabelText('controlled-b'), { target: { value: 'survivor' } })

    // 打开 c：最久未激活的 a 被淘汰，保留 b 与新页 c
    rerender(<LruPageCacheHost entries={['c', 'b']} activeKey="c" capacity={2} />)
    expect(screen.queryByTestId('page-a')).toBeNull()
    expect(inputValue('controlled-b')).toBe('survivor')

    // 再激活 a：重新挂载，全新状态；同批幸存的 c 仍然在缓存中
    rerender(<LruPageCacheHost entries={['a', 'c']} activeKey="a" capacity={2} />)
    expect(inputValue('controlled-a')).toBe('')
    expect(scrollTopOf('a')).toBe(0)
    expect(screen.getByTestId('page-c')).toBeTruthy()
    // a 被淘汰时清理一次，重新挂载后再运行一次 Effect；全新实例而非僵尸缓存
    expect(lifecycleOf('a')).toEqual({ effectRuns: 2, effectCleanups: 1 })
  })
})
