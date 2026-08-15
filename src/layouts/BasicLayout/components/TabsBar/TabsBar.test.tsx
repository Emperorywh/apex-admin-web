/**
 * TabsBar 组件级测试（规格 §9.3/§11.3、§17.14）：
 * PoC harness 风格临时测试路由 + 桩 store，覆盖页签交互全量行为：
 * - 结构与可访问性：tablist/tab/aria-selected/aria-controls、
 *   含页签名可访问名称的关闭按钮、affix 不可关闭；
 * - 点击激活导航与页面切换后焦点进入主容器；
 * - 关闭当前后继顺序：右侧最近 → 左侧最近 → /dashboard，焦点移到新激活页签；
 * - 右键菜单四项（刷新当前/关闭其他/关闭右侧/关闭全部）与 Shift+F10 键盘等价触发；
 * - 刷新当前：revision 递增、取消 scope、新 React key 重建；
 * - 键盘操作与 dnd-kit 键盘拖拽排序、固定区边界忽略越界落点；
 * - 溢出滚动箭头与激活页签自动进入可视区。
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PAGE_CONTAINER_ID } from '@/layouts/BasicLayout/tabsModel'
import { registerScopeController } from '@/services/request/requestScope'
import {
  pageObservation,
  renderTabsHarness,
  resetPageObservations,
  type TabsHarnessResult,
} from '@/test/tabsTestHarness'

/** 依 data-tab-key 获取页签节点 */
function tabOf(result: TabsHarnessResult, key: string): HTMLElement {
  const node = result.container.querySelector(`[data-tab-key="${key}"]`)
  expect(node).not.toBeNull()
  return node as HTMLElement
}

/** 打开某页签的右键菜单并等待菜单项出现（右键事件落在 Dropdown 内层触发元素上） */
async function openContextMenu(result: TabsHarnessResult, key: string): Promise<void> {
  const tab = tabOf(result, key)
  const trigger = (tab.querySelector(':scope > div') as HTMLElement | null) ?? tab
  fireEvent.contextMenu(trigger)
  await screen.findByText('刷新当前')
}

/** 顺序导航打开多个页签（最后一个为当前激活） */
async function openTabs(result: TabsHarnessResult, paths: string[]): Promise<void> {
  for (const path of paths) {
    await result.navigate(path)
  }
}

/** 断言 store 页签 key 顺序与激活 key */
async function expectTabsState(result: TabsHarnessResult, keys: string[], activeKey: string): Promise<void> {
  await waitFor(() => {
    expect(result.store.getState().tabs.items.map((tab) => tab.key)).toEqual(keys)
    expect(result.store.getState().tabs.activeKey).toBe(activeKey)
  })
}

beforeEach(() => {
  resetPageObservations()
})

describe('页签结构与可访问性（规格 §11.3）', () => {
  it('tablist/tab/aria-selected/aria-controls 就位；affix 无关闭按钮，普通页签关闭按钮含页签名可访问名称', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/p1')
    const tablist = screen.getByRole('tablist', { name: '页签' })
    expect(within(tablist).getAllByRole('tab')).toHaveLength(2)
    const active = within(tablist).getByRole('tab', { selected: true })
    expect(active).toHaveTextContent('第 1 页')
    expect(active).toHaveAttribute('aria-controls', PAGE_CONTAINER_ID)
    expect(result.container.querySelector(`#${PAGE_CONTAINER_ID}`)).not.toBeNull()
    // affix 页签带固定标记且不可关闭；普通页签关闭按钮可访问名称包含页签名
    expect(tabOf(result, '/dashboard')).toHaveAttribute('data-affix', 'true')
    expect(screen.queryByRole('button', { name: '关闭 仪表盘' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '关闭 第 1 页' })).toBeInTheDocument()
    // 溢出滚动箭头随页签栏渲染（jsdom 无布局，箭头不可见但不缺席）
    expect(screen.getByRole('button', { name: '向左滚动' })).toHaveAttribute('data-visible', 'false')
    expect(screen.getByRole('button', { name: '向右滚动' })).toHaveAttribute('data-visible', 'false')
  })
})

describe('点击激活与焦点（规格 §11.3）', () => {
  it('点击页签导航激活；页面切换后焦点进入主容器', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1'])
    await user.click(screen.getByText('仪表盘'))
    await expectTabsState(result, ['/dashboard', '/p1'], '/dashboard')
    expect(document.activeElement).toBe(result.container.querySelector(`#${PAGE_CONTAINER_ID}`))
  })
})

describe('关闭当前的后继顺序（规格 §9.3/§17.14：右→左→/dashboard）', () => {
  it('优先激活右侧最近页签，焦点移到新激活页签', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    // 当前激活第 1 页，右侧最近为第 2 页
    await openTabs(result, ['/p1', '/p2', '/p1'])
    await user.click(screen.getByRole('button', { name: '关闭 第 1 页' }))
    await expectTabsState(result, ['/dashboard', '/p2'], '/p2')
    expect(document.activeElement?.getAttribute('data-tab-key')).toBe('/p2')
  })

  it('没有右侧则激活左侧最近页签', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1', '/p2'])
    await user.click(screen.getByRole('button', { name: '关闭 第 2 页' }))
    await expectTabsState(result, ['/dashboard', '/p1'], '/p1')
    expect(document.activeElement?.getAttribute('data-tab-key')).toBe('/p1')
  })

  it('两侧普通页签均已关闭则回 Dashboard 并激活', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1'])
    await user.click(screen.getByRole('button', { name: '关闭 第 1 页' }))
    await expectTabsState(result, ['/dashboard'], '/dashboard')
    expect(document.activeElement?.getAttribute('data-tab-key')).toBe('/dashboard')
    // 内容切换到 Dashboard
    await waitFor(() => {
      expect(result.container.querySelector('[data-page="/dashboard"] [data-probe-active]')?.getAttribute('data-probe-active')).toBe('active')
    })
  })

  it('关闭非激活页签不改变激活页签', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1', '/p2'])
    await user.click(screen.getByRole('button', { name: '关闭 第 1 页' }))
    await expectTabsState(result, ['/dashboard', '/p2'], '/p2')
  })
})

describe('右键菜单（规格 §9.3：刷新当前/关闭其他/关闭右侧/关闭全部，批量不影响 affix）', () => {
  it('关闭其他：仅保留 affix 与锚点页签；激活页被移除时落到锚点并聚焦', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1', '/p2', '/p3'])
    await openContextMenu(result, '/p2')
    await user.click(screen.getByText('关闭其他'))
    await expectTabsState(result, ['/dashboard', '/p2'], '/p2')
    expect(document.activeElement?.getAttribute('data-tab-key')).toBe('/p2')
  })

  it('关闭右侧：移除锚点右侧普通页签，后继为锚点', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1', '/p2', '/p3'])
    await openContextMenu(result, '/p1')
    await user.click(screen.getByText('关闭右侧'))
    await expectTabsState(result, ['/dashboard', '/p1'], '/p1')
  })

  it('关闭全部：只保留 affix Dashboard 并激活它', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1', '/p2'])
    await openContextMenu(result, '/p2')
    await user.click(screen.getByText('关闭全部'))
    await expectTabsState(result, ['/dashboard'], '/dashboard')
    expect(result.store.getState().pageCache.lruOrder).toEqual(['/dashboard'])
  })

  it('Shift+F10 键盘等价触发右键菜单（规格 §11.3）', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1'])
    fireEvent.keyDown(tabOf(result, '/p1'), { key: 'F10', code: 'F10', shiftKey: true })
    await screen.findByText('刷新当前')
    expect(screen.getByText('关闭全部')).toBeInTheDocument()
  })
})

describe('刷新当前（规格 §9.3）', () => {
  it('revision 递增、取消该 scope、以新 React key 重建组件', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1'])
    fireEvent.change(screen.getByLabelText('输入框-/p1'), { target: { value: 'stale' } })
    const controller = new AbortController()
    registerScopeController('/p1', controller)

    await openContextMenu(result, '/p1')
    await user.click(screen.getByText('刷新当前'))

    await waitFor(() => {
      expect(result.store.getState().pageCache.revisions['/p1']).toBe(1)
    })
    expect(controller.signal.aborted).toBe(true)
    // 新 React key 重建：全新挂载，输入状态重置，业务数据随重挂载重新请求
    expect((screen.getByLabelText('输入框-/p1') as HTMLInputElement).value).toBe('')
    expect(pageObservation('/p1').mounts).toBe(2)
    expect(result.store.getState().tabs.activeKey).toBe('/p1')
  })

  it('右键非激活页签刷新：先导航到该页签再刷新', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1', '/p2', '/p1'])
    await openContextMenu(result, '/p2')
    await user.click(screen.getByText('刷新当前'))
    await expectTabsState(result, ['/dashboard', '/p1', '/p2'], '/p2')
    await waitFor(() => {
      expect(result.store.getState().pageCache.revisions['/p2']).toBe(1)
    })
  })
})

describe('键盘操作与拖拽排序（规格 §9.3/§11.3）', () => {
  /** 为 jsdom 注入固定矩形，供 dnd-kit 测量（无布局环境下碰撞检测需要） */
  function patchTabRects(result: TabsHarnessResult): void {
    const nodes = [...result.container.querySelectorAll('[data-tab-key]')] as HTMLElement[]
    nodes.forEach((node, index) => {
      const left = index * 120
      node.getBoundingClientRect = (() => {
        const rect = {
          x: left,
          y: 0,
          top: 0,
          left,
          right: left + 120,
          bottom: 32,
          width: 120,
          height: 32,
          toJSON: () => ({}),
        }
        return () => rect as DOMRect
      })()
    })
  }

  it('Enter 激活页签', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1'])
    tabOf(result, '/dashboard').focus()
    await user.keyboard('{Enter}')
    await expectTabsState(result, ['/dashboard', '/p1'], '/dashboard')
  })

  it('键盘拖拽：Space 抬起、方向键移动、Space 落下完成普通页签排序', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1', '/p2'])
    patchTabRects(result)
    tabOf(result, '/p1').focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowRight}')
    await user.keyboard(' ')
    await waitFor(() => {
      expect(result.store.getState().tabs.items.map((tab) => tab.key)).toEqual(['/dashboard', '/p2', '/p1'])
    })
  })

  it('普通页签拖入固定区的越界落点被整体忽略（规格 §9.3）', async () => {
    const user = userEvent.setup()
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1', '/p2'])
    patchTabRects(result)
    tabOf(result, '/p1').focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowLeft}')
    await user.keyboard(' ')
    // 落点为 affix Dashboard：固定区边界校验拒绝，顺序不变
    await waitFor(() => {
      expect(result.store.getState().tabs.items.map((tab) => tab.key)).toEqual(['/dashboard', '/p1', '/p2'])
    })
  })
})

describe('溢出滚动（规格 §9.3）', () => {
  it('激活页签自动进入可视区（scrollIntoView nearest）', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await openTabs(result, ['/p1'])
    const intoView = vi.fn()
    tabOf(result, '/p1').scrollIntoView = intoView
    await result.navigate('/p2')
    await result.navigate('/p1')
    expect(intoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
  })
})
