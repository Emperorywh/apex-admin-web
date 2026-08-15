/**
 * tabsModel 纯逻辑测试（规格 §4.5/§9.1/§9.3/§17.10/§17.13/§17.14）：
 * key 规范化、LRU 淘汰选择、关闭后继顺序、拖拽边界与批量关闭 key 选择。
 * 组件级行为（Activity 宿主、页签交互）位于 components/ 同目录测试。
 */
import { describe, expect, it } from 'vitest'
import type { TabItem } from '@/store/slices/tabs.slice'
import {
  buildAffixTabItem,
  buildTabKey,
  computeTabsReorder,
  createTabSnapshot,
  normalizeSearch,
  resolveCloseSuccessor,
  resolveCurrentTabView,
  selectCloseAllKeys,
  selectCloseOthersKeys,
  selectCloseRightKeys,
  selectLruEvictions,
  tabLocationTarget,
} from '@/layouts/BasicLayout/tabsModel'

function tab(key: string, affix = false): TabItem {
  return {
    key,
    title: key,
    affix,
    location: createTabSnapshot(key, '', '', key),
  }
}

/** 合成 match：只需 handle.meta 形状（与 Data Router handle 投影一致） */
function matchWithMeta(meta: Record<string, unknown> | undefined) {
  return { handle: meta === undefined ? undefined : { meta } } as never
}

describe('normalizeSearch / buildTabKey（规格 §4.5）', () => {
  it('URLSearchParams.sort() 按参数名稳定排序，空与纯问号返回空串', () => {
    expect(normalizeSearch('')).toBe('')
    expect(normalizeSearch('?')).toBe('')
    expect(normalizeSearch('?b=2&a=1')).toBe('?a=1&b=2')
    expect(normalizeSearch('?a=1')).toBe('?a=1')
  })

  it('同名重复参数保持原顺序（稳定排序）', () => {
    expect(normalizeSearch('?tag=b&tag=a&id=2&id=1')).toBe('?id=2&id=1&tag=b&tag=a')
  })

  it('fullPath key = pathname + 规范化 search，不含 hash；空 search 即 pathname', () => {
    expect(buildTabKey('/system/user', '?b=2&a=1')).toBe('/system/user?a=1&b=2')
    expect(buildTabKey('/system/user', '')).toBe('/system/user')
    expect(buildTabKey('/system/user', '?id=1', 'pathname')).toBe('/system/user')
  })
})

describe('resolveCurrentTabView（规格 §4.5/§9.1）', () => {
  it('取最深带 meta 的 match：hideInTabs 不生成页签，noCache 生成页签但不可缓存', () => {
    const hidden = resolveCurrentTabView(
      { pathname: '/403', search: '', hash: '' },
      [matchWithMeta({ title: '首页' }), matchWithMeta({ title: '无权限访问', hideInTabs: true, noCache: true })],
    )
    expect(hidden.tabbed).toBe(false)
    expect(hidden.cacheable).toBe(false)

    const noCache = resolveCurrentTabView({ pathname: '/nocache', search: '', hash: '' }, [
      matchWithMeta({ title: '不缓存页', noCache: true }),
    ])
    expect(noCache.tabbed).toBe(true)
    expect(noCache.cacheable).toBe(false)

    const normal = resolveCurrentTabView({ pathname: '/list', search: '?b=2&a=1', hash: '#top' }, [
      matchWithMeta({ title: '列表页' }),
    ])
    expect(normal).toMatchObject({ key: '/list?a=1&b=2', title: '列表页', tabbed: true, cacheable: true, affix: false })
    // 快照保存原始 search 顺序与 hash；state 固定 null
    expect(normal.snapshot).toEqual({ pathname: '/list', search: '?b=2&a=1', hash: '#top', key: '/list?a=1&b=2', state: null })
  })

  it('affixTab 与 tabKeyMode 随最深 meta 生效', () => {
    const affix = resolveCurrentTabView({ pathname: '/dashboard', search: '', hash: '' }, [
      matchWithMeta({ title: '仪表盘', affixTab: true }),
    ])
    expect(affix.affix).toBe(true)

    const byPathname = resolveCurrentTabView({ pathname: '/pathname', search: '?x=1', hash: '' }, [
      matchWithMeta({ title: '路径键页', tabKeyMode: 'pathname' }),
    ])
    expect(byPathname.key).toBe('/pathname')
  })

  it('无任何带 meta 的 match 时以 pathname 兜底标题并按普通可缓存页处理', () => {
    const view = resolveCurrentTabView({ pathname: '/unknown', search: '', hash: '' }, [{} as never])
    expect(view.title).toBe('/unknown')
    expect(view.tabbed).toBe(true)
    expect(view.cacheable).toBe(true)
  })
})

describe('selectLruEvictions（规格 §9.1/§17.13）', () => {
  const affixKeys = new Set(['/dashboard'])

  it('容量统计全部普通缓存（含当前页）；超出时从队尾淘汰最久未激活的非当前页', () => {
    // lruOrder 队首为最近激活：p11 为当前页，普通缓存共 11 个 → 淘汰队尾 p1（非当前）
    const order = ['/p11', '/p10', '/p9', '/p8', '/p7', '/p6', '/p5', '/p4', '/p3', '/p2', '/p1']
    expect(selectLruEvictions(order, affixKeys, '/p11', 10)).toEqual(['/p1'])
  })

  it('affix 不计入容量、当前页不作为淘汰对象；超额多个时从队尾淘汰多个', () => {
    // 普通缓存 = cur + p11..p1 共 12 个 > 10 → 候选（排除当前）p11..p1 取队尾两个
    const order = ['/cur', '/dashboard', '/p11', '/p10', '/p9', '/p8', '/p7', '/p6', '/p5', '/p4', '/p3', '/p2', '/p1']
    expect(selectLruEvictions(order, affixKeys, '/cur', 10)).toEqual(['/p2', '/p1'])
  })

  it('恰好等于容量（当前页计入）不淘汰', () => {
    const order = ['/p10', '/dashboard', '/p9', '/p8', '/p7', '/p6', '/p5', '/p4', '/p3', '/p2', '/p1']
    expect(selectLruEvictions(order, affixKeys, '/p10', 10)).toEqual([])
  })
})

describe('resolveCloseSuccessor（规格 §9.3/§17.14：右→左→回退）', () => {
  const items = [tab('/dashboard', true), tab('/a'), tab('/b'), tab('/c')]

  it('优先右侧最近，其次左侧最近', () => {
    expect(resolveCloseSuccessor(items, '/b', new Set(['/b']))?.key).toBe('/c')
    expect(resolveCloseSuccessor(items, '/c', new Set(['/c']))?.key).toBe('/b')
    expect(resolveCloseSuccessor(items, '/a', new Set(['/a']))?.key).toBe('/b')
  })

  it('批量关闭时跳过同批被移除页签：关闭全部后落到 affix Dashboard', () => {
    const removed = new Set(['/a', '/b', '/c'])
    expect(resolveCloseSuccessor(items, '/b', removed)?.key).toBe('/dashboard')
  })

  it('仅关闭左侧全部后右侧幸存；无幸存页签返回 null（调用方回退常量）', () => {
    expect(resolveCloseSuccessor(items, '/a', new Set(['/a', '/dashboard']))?.key).toBe('/b')
    expect(resolveCloseSuccessor([tab('/a')], '/a', new Set(['/a']))).toBeNull()
  })
})

describe('批量关闭 key 选择（规格 §9.3：批量永不影响 affix）', () => {
  const items = [tab('/dashboard', true), tab('/a'), tab('/b'), tab('/c')]

  it('关闭其他：锚点之外的普通页签；关闭右侧：锚点右侧普通页签；关闭全部：全部普通页签', () => {
    expect(selectCloseOthersKeys(items, '/b')).toEqual(['/a', '/c'])
    expect(selectCloseRightKeys(items, '/b')).toEqual(['/c'])
    expect(selectCloseRightKeys(items, '/c')).toEqual([])
    expect(selectCloseAllKeys(items)).toEqual(['/a', '/b', '/c'])
  })

  it('锚点是 affix 时关闭其他/右侧同样只作用于普通页签', () => {
    expect(selectCloseOthersKeys(items, '/dashboard')).toEqual(['/a', '/b', '/c'])
    expect(selectCloseRightKeys(items, '/dashboard')).toEqual(['/a', '/b', '/c'])
  })
})

describe('computeTabsReorder（规格 §9.3：固定区边界）', () => {
  const items = [tab('/dashboard', true), tab('/a'), tab('/b'), tab('/c')]

  it('普通页签之间重排返回新顺序', () => {
    expect(computeTabsReorder(items, '/c', '/a')?.map((item) => item.key)).toEqual(['/dashboard', '/c', '/a', '/b'])
  })

  it('普通页签拖到 affix 位次（落点越界）整体忽略', () => {
    expect(computeTabsReorder(items, '/a', '/dashboard')).toBeNull()
  })

  it('同 key、缺 key 忽略；affix 数量推导固定区大小', () => {
    expect(computeTabsReorder(items, '/a', '/a')).toBeNull()
    expect(computeTabsReorder(items, '/missing', '/a')).toBeNull()
    // 多 affix 场景：固定区整体仍在最前才允许
    const multiAffix = [tab('/d1', true), tab('/d2', true), tab('/a'), tab('/b')]
    expect(computeTabsReorder(multiAffix, '/b', '/d2')).toBeNull()
  })
})

describe('affix 页签构造与导航目标', () => {
  it('buildAffixTabItem 生成无查询的固定页签；tabLocationTarget 拼接完整地址', () => {
    expect(buildAffixTabItem({ pathname: '/dashboard', title: '仪表盘' })).toEqual({
      key: '/dashboard',
      title: '仪表盘',
      affix: true,
      location: { pathname: '/dashboard', search: '', hash: '', key: '/dashboard', state: null },
    })
    expect(tabLocationTarget(createTabSnapshot('/list', '?id=1', '#top', '/list?id=1'))).toBe('/list?id=1#top')
  })
})
