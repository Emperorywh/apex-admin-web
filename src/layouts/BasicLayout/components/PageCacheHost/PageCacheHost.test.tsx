/**
 * PageCacheHost 组件级测试（规格 §4.5/§9.1/§9.2/§9.3、§17.9/§17.10/§17.12/§17.13）：
 * PoC harness 风格临时测试路由 + 桩 store（src/test/tabsTestHarness），覆盖：
 * - 浏览器刷新重建（Dashboard + 当前可生成页签，无重复 Dashboard，hideInTabs 不加入）；
 * - Activity 缓存宿主：同路由不同 query 独立上下文与状态、隐藏保留 scrollTop、
 *   noCache 页面离开即卸载；
 * - 页签 key 规范化：hash 复用、search 排序复用、tabKeyMode:'pathname'；
 * - LRU 容量淘汰：第 11 个普通缓存淘汰最久未激活，页签保留、再激活重新挂载；
 * - scope 取消：隐藏/关闭（含对接 TASK-007 权限收窄的 slice 调用）；
 * - 页面级错误边界：崩溃页显示 500 不影响其他缓存实例。
 * 页签交互（右键菜单/拖拽/关闭按钮/焦点）见 TabsBar.test.tsx。
 */
import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerScopeController } from '@/services/request/requestScope'
import { cacheEntriesRemoved } from '@/store/slices/pageCache.slice'
import { tabsRemoved } from '@/store/slices/tabs.slice'
import {
  HARNESS_LRU_PATHS,
  findProbe,
  pageObservation,
  renderTabsHarness,
  renderedPaneKeys,
  resetPageObservations,
  type TabsHarnessResult,
} from '@/test/tabsTestHarness'

/** 断言探针存在并返回其节点 */
function probeOf(result: TabsHarnessResult, pathWithSearch: string): HTMLElement {
  const probe = findProbe(result.container, pathWithSearch)
  expect(probe).not.toBeNull()
  return probe as HTMLElement
}

/** 探针滚动容器 */
function scrollBoxOf(probe: HTMLElement): HTMLElement {
  return probe.querySelector('[data-probe-scroll]') as HTMLElement
}

/** 探针激活态标记（active/hidden） */
function activeStateOf(probe: HTMLElement): string {
  return probe.querySelector('[data-probe-active]')?.getAttribute('data-probe-active') ?? ''
}

/** 在探针输入框输入文本 */
function typeInto(pathWithSearch: string, text: string): void {
  fireEvent.change(screen.getByLabelText(`输入框-${pathWithSearch}`), { target: { value: text } })
}

function inputText(pathWithSearch: string): string {
  return (screen.getByLabelText(`输入框-${pathWithSearch}`) as HTMLInputElement).value
}

/** 注册一个可控 AbortController 到指定页签 scope */
function registerScope(scopeId: string): AbortController {
  const controller = new AbortController()
  registerScopeController(scopeId, controller)
  return controller
}

beforeEach(() => {
  resetPageObservations()
})

describe('浏览器刷新重建（规格 §9.3）', () => {
  it('当前为可生成页签页面：重建为 Dashboard + 当前页签，affix 排最前', async () => {
    const result = renderTabsHarness({ initialPath: '/list' })
    await result.navigate('/list')
    const { tabs, pageCache } = result.store.getState()
    expect(tabs.items.map((tab) => tab.key)).toEqual(['/dashboard', '/list'])
    expect(tabs.items.map((tab) => tab.affix)).toEqual([true, false])
    expect(tabs.activeKey).toBe('/list')
    // Dashboard 尚未访问：页签存在但无缓存实例；当前页有缓存实例
    expect(renderedPaneKeys(result.container)).toEqual(['/list'])
    expect(pageCache.lruOrder).toEqual(['/list'])
    expect(activeStateOf(probeOf(result, '/list'))).toBe('active')
  })

  it('当前即 Dashboard：只保留一个页签，无重复 Dashboard', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/dashboard')
    const { tabs } = result.store.getState()
    expect(tabs.items).toHaveLength(1)
    expect(tabs.items[0]).toMatchObject({ key: '/dashboard', affix: true })
    expect(tabs.activeKey).toBe('/dashboard')
    expect(renderedPaneKeys(result.container)).toEqual(['/dashboard'])
  })

  it('hideInTabs 页面（错误页形态）不加入页签，渲染为 live 视图', async () => {
    const result = renderTabsHarness({ initialPath: '/hidden' })
    await result.navigate('/hidden')
    expect(result.store.getState().tabs.items.map((tab) => tab.key)).toEqual(['/dashboard'])
    // live 视图挂载且无缓存实例语义（data-live-pane）
    expect(result.container.querySelector('[data-live-pane]')).not.toBeNull()
    expect(activeStateOf(probeOf(result, '/hidden'))).toBe('active')
    await result.navigate('/list')
    expect(result.store.getState().tabs.items.map((tab) => tab.key)).toEqual(['/dashboard', '/list'])
    expect(findProbe(result.container, '/hidden')).toBeNull()
  })

  it('noCache 页面生成页签但不进入 Activity/LRU，离开即卸载', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/nocache')
    const { tabs, pageCache } = result.store.getState()
    expect(tabs.items.map((tab) => tab.key)).toEqual(['/dashboard', '/nocache'])
    expect(pageCache.lruOrder).toEqual(['/dashboard'])
    expect(result.container.querySelector('[data-live-pane]')).not.toBeNull()
    typeInto('/nocache', 'will-unload')

    await result.navigate('/p1')
    expect(findProbe(result.container, '/nocache')).toBeNull()
    expect(result.store.getState().tabs.items.map((tab) => tab.key)).toContain('/nocache')

    // 返回后全新挂载，输入状态不保留
    await result.navigate('/nocache')
    expect(inputText('/nocache')).toBe('')
    expect(pageObservation('/nocache').mounts).toBe(2)
  })
})

describe('独立路由上下文与状态保活（规格 §9.1/§9.2/§17.9）', () => {
  it('同路由不同 query 的双页签各自读取自己的 location/search 与组件状态', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/list?id=1')
    typeInto('/list?id=1', 'first')
    await result.navigate('/list?id=2')
    typeInto('/list?id=2', 'second')

    expect(result.store.getState().tabs.items.map((tab) => tab.key)).toEqual([
      '/dashboard',
      '/list?id=1',
      '/list?id=2',
    ])
    // 两个缓存实例同时挂载，各自渲染自己快照的 query
    expect(probeOf(result, '/list?id=1').querySelector('[data-probe-path]')).toHaveTextContent('/list?id=1')
    expect(probeOf(result, '/list?id=2').querySelector('[data-probe-path]')).toHaveTextContent('/list?id=2')
    expect(activeStateOf(probeOf(result, '/list?id=2'))).toBe('active')
    expect(activeStateOf(probeOf(result, '/list?id=1'))).toBe('hidden')

    // 回到 ?id=1：独立组件状态恢复
    await result.navigate('/list?id=1')
    expect(inputText('/list?id=1')).toBe('first')
    expect(inputText('/list?id=2')).toBe('second')
    expect(pageObservation('/list?id=1').mounts).toBe(1)
  })

  it('缓存页签隐藏保留输入状态与 scrollTop，重新激活恢复且不重挂载', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/p1')
    typeInto('/p1', 'keep')
    scrollBoxOf(probeOf(result, '/p1')).scrollTop = 137

    await result.navigate('/p2')
    expect(pageObservation('/p1').mounts).toBe(1)
    expect(activeStateOf(probeOf(result, '/p1'))).toBe('hidden')

    await result.navigate('/p1')
    expect(inputText('/p1')).toBe('keep')
    expect(scrollBoxOf(probeOf(result, '/p1')).scrollTop).toBe(137)
    expect(pageObservation('/p1').mounts).toBe(1)
    // 激活态轨迹：隐藏期间 Effect 已被 Activity 清理（不记录 hidden），重显时 Effect
    // 重建并再次记录 active（规格 §9.2「隐藏清理 Effect、显示重建」）
    expect(pageObservation('/p1').activeLog).toEqual([true, true])
  })
})

describe('页签 key 规范化（规格 §4.5/§17.10）', () => {
  it('hash 变化复用当前页签，仅更新 location 快照', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/list')
    await result.navigate('/list#top')
    const { tabs } = result.store.getState()
    expect(tabs.items.map((tab) => tab.key)).toEqual(['/dashboard', '/list'])
    expect(tabs.items[1].location.hash).toBe('#top')
    // 同实例更新快照，不重挂载
    expect(pageObservation('/list').mounts).toBe(1)
    expect(activeStateOf(probeOf(result, '/list'))).toBe('active')
  })

  it('search 规范化后决定复用：参数序不同的同页复用同一页签并替换快照', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/list?b=2&a=1')
    expect(result.store.getState().tabs.items.map((tab) => tab.key)).toEqual(['/dashboard', '/list?a=1&b=2'])
    await result.navigate('/list?a=1&b=2')
    const { tabs } = result.store.getState()
    expect(tabs.items).toHaveLength(2)
    expect(tabs.items[1].location.search).toBe('?a=1&b=2')
    // 同一实例（首次挂载于原始参数序 ?b=2&a=1）未被重挂载
    expect(pageObservation('/list?b=2&a=1').mounts).toBe(1)
  })

  it("tabKeyMode:'pathname' 复用页签并替换快照（query 只表示筛选条件）", async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/pathname?x=1')
    await result.navigate('/pathname?x=2')
    const { tabs } = result.store.getState()
    expect(tabs.items.map((tab) => tab.key)).toEqual(['/dashboard', '/pathname'])
    expect(tabs.items[1].location.search).toBe('?x=2')
    expect(probeOf(result, '/pathname?x=2').querySelector('[data-probe-query]')).toHaveTextContent('x=2')
  })
})

describe('LRU 容量淘汰（规格 §9.1/§17.13）', () => {
  it('第 11 个普通缓存淘汰最久未激活且非当前页；页签保留，再激活重新挂载状态重置', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/p1')
    typeInto('/p1', 'stale')
    for (const path of HARNESS_LRU_PATHS.slice(1)) {
      await result.navigate(path)
    }
    const { tabs, pageCache } = result.store.getState()
    // 页签全部保留（Dashboard + p1..p11），缓存只保留 10 个普通实例 + affix；
    // lruOrder 队首为最近激活：p11 → p2，队尾 affix Dashboard
    expect(tabs.items.map((tab) => tab.key)).toEqual(['/dashboard', ...HARNESS_LRU_PATHS])
    expect(pageCache.lruOrder).toEqual([...HARNESS_LRU_PATHS.slice(1).reverse(), '/dashboard'])
    // 最久未激活的 /p1 缓存实例被移除；当前页 /p11 与 affix 不淘汰
    expect(renderedPaneKeys(result.container)).toEqual(['/dashboard', ...HARNESS_LRU_PATHS.slice(1)])

    // 再激活 /p1：重新挂载为全新实例（输入清零），并淘汰此时的 LRU 尾部 /p2
    await result.navigate('/p1')
    expect(pageObservation('/p1').mounts).toBe(2)
    expect(inputText('/p1')).toBe('')
    expect(result.store.getState().pageCache.lruOrder).toEqual([
      '/p1',
      ...HARNESS_LRU_PATHS.slice(2).reverse(),
      '/dashboard',
    ])
    expect(result.store.getState().tabs.items.map((tab) => tab.key)).toContain('/p2')
  })

  it('恰好达到容量不淘汰', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    for (const path of HARNESS_LRU_PATHS.slice(0, 10)) {
      await result.navigate(path)
    }
    expect(result.store.getState().pageCache.lruOrder).toEqual([
      ...HARNESS_LRU_PATHS.slice(0, 10).reverse(),
      '/dashboard',
    ])
  })
})

describe('页面请求 scope 取消（规格 §7.4-6/§17.12）', () => {
  it('页签隐藏时取消该 scope 的在途请求', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/p1')
    const controller = registerScope('/p1')
    await result.navigate('/p2')
    expect(controller.signal.aborted).toBe(true)
  })

  it('关闭页签立即移除 Activity 并取消 scope（对接 TASK-007 权限收窄的 slice 调用）', async () => {
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/p1')
    await result.navigate('/p2')
    const controller = registerScope('/p1')
    // 模拟 auth.session closeInaccessibleTabs 的 slice 调用序列
    act(() => {
      result.store.dispatch(tabsRemoved({ keys: ['/p1'] }))
      result.store.dispatch(cacheEntriesRemoved({ keys: ['/p1'] }))
    })
    expect(findProbe(result.container, '/p1')).toBeNull()
    expect(controller.signal.aborted).toBe(true)
    expect(result.store.getState().tabs.items.map((tab) => tab.key)).toEqual(['/dashboard', '/p2'])
  })
})

describe('页面级错误边界（规格 §4.2/§9.1/§17.19）', () => {
  it('渲染崩溃页在本缓存实例显示 500，其他缓存实例不受影响', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const result = renderTabsHarness({ initialPath: '/dashboard' })
    await result.navigate('/p1')
    await result.navigate('/boom')
    expect(screen.getByText('服务器错误')).toBeInTheDocument()
    // 其他缓存实例仍在（隐藏保活），崩溃页生成了自己的页签
    expect(findProbe(result.container, '/p1')).not.toBeNull()
    expect(result.store.getState().tabs.items.map((tab) => tab.key)).toEqual(['/dashboard', '/p1', '/boom'])
    consoleSpy.mockRestore()
  })
})
