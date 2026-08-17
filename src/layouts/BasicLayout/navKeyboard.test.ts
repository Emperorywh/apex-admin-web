/**
 * 自绘导航键盘与展开纯函数测试（SPEC_UI2 §6.1 可访问性红线/§12）：
 * 方向键游走、展开收纳链、Enter/Space 激活、Home/End、Esc 与 mini 浮层子树判定。
 */
import { describe, expect, it } from 'vitest'
import type { NavTreeNode } from './navModel'
import {
  findNavEntry,
  flattenNavTree,
  isNavKeyWithin,
  moveNavFocus,
  resolveNavKeyAction,
  visibleNavEntries,
} from './navKeyboard'

/** 三级导航树：目录 > 目录 > 叶子，验证任意层级 */
const TREE: NavTreeNode[] = [
  { id: 'dashboard', path: '/dashboard', title: '仪表盘', hasPage: true },
  {
    id: 'system',
    path: '/system',
    title: '系统管理',
    hasPage: false,
    children: [
      { id: 'user', path: '/system/user', title: '用户管理', hasPage: true },
      {
        id: 'role',
        path: '/system/role',
        title: '角色管理',
        hasPage: true,
        children: [{ id: 'role-detail', path: '/system/role/detail', title: '角色详情', hasPage: true }],
      },
    ],
  },
  { id: 'demo', path: '/demo', title: '演示', hasPage: true, children: [{ id: 'demo-leaf', path: '/demo/leaf', title: '演示页', hasPage: true }] },
]

const ENTRIES = flattenNavTree(TREE)

describe('flattenNavTree / visibleNavEntries', () => {
  it('DFS 扁平化保留层级与父子引用；无 path 节点不生成条目且子树上提', () => {
    expect(ENTRIES.map((entry) => [entry.key, entry.level, entry.parentKey])).toEqual([
      ['/dashboard', 0, null],
      ['/system', 0, null],
      ['/system/user', 1, '/system'],
      ['/system/role', 1, '/system'],
      ['/system/role/detail', 2, '/system/role'],
      ['/demo', 0, null],
      ['/demo/leaf', 1, '/demo'],
    ])
    const lifted = flattenNavTree([
      { id: 'wrapper', title: '包装', hasPage: false, children: [{ id: 'leaf', path: '/leaf', title: '叶子', hasPage: true }] },
    ])
    expect(lifted).toEqual([{ key: '/leaf', path: '/leaf', title: '叶子', hasChildren: false, parentKey: null, level: 0 }])
  })

  it('可见性按展开集合过滤：祖先全部展开才可见', () => {
    const rootOnly = visibleNavEntries(ENTRIES, [])
    expect(rootOnly.map((entry) => entry.key)).toEqual(['/dashboard', '/system', '/demo'])
    const oneLevel = visibleNavEntries(ENTRIES, ['/system'])
    expect(oneLevel.map((entry) => entry.key)).toEqual([
      '/dashboard',
      '/system',
      '/system/user',
      '/system/role',
      '/demo',
    ])
    const deep = visibleNavEntries(ENTRIES, ['/system', '/system/role'])
    expect(deep.map((entry) => entry.key)).toContain('/system/role/detail')
  })
})

describe('moveNavFocus', () => {
  it('可见条目间循环游走；空集返回 null；未知焦点回到首个', () => {
    const visible = visibleNavEntries(ENTRIES, ['/system'])
    expect(moveNavFocus(visible, '/dashboard', 1)).toBe('/system')
    expect(moveNavFocus(visible, '/system/role', 1)).toBe('/demo')
    expect(moveNavFocus(visible, '/dashboard', -1)).toBe('/demo')
    expect(moveNavFocus(visible, 'unknown', 1)).toBe('/dashboard')
    expect(moveNavFocus([], '/dashboard', 1)).toBeNull()
  })
})

describe('isNavKeyWithin（mini 浮层子树判定）', () => {
  it('子树内（含根）为真，子树外为假', () => {
    expect(isNavKeyWithin(ENTRIES, '/system', '/system')).toBe(true)
    expect(isNavKeyWithin(ENTRIES, '/system/role/detail', '/system')).toBe(true)
    expect(isNavKeyWithin(ENTRIES, '/demo/leaf', '/system')).toBe(false)
  })
})

describe('resolveNavKeyAction（ARIA menu 模式，SPEC_UI2 §6.1）', () => {
  const act = (key: string, entryKey: string, openKeys: readonly string[]) => {
    const entry = findNavEntry(ENTRIES, entryKey)
    if (entry === undefined) {
      throw new Error(`未知条目 ${entryKey}`)
    }
    return resolveNavKeyAction({
      key,
      entry,
      entries: ENTRIES,
      visible: visibleNavEntries(ENTRIES, openKeys),
      openKeys,
    })
  }

  it('ArrowDown/Up 在可见条目间游走（未展开目录时跳过其子级）', () => {
    expect(act('ArrowDown', '/dashboard', [])).toEqual({ type: 'focus', key: '/system' })
    expect(act('ArrowUp', '/dashboard', [])).toEqual({ type: 'focus', key: '/demo' })
    expect(act('ArrowDown', '/system', ['/system'])).toEqual({ type: 'focus', key: '/system/user' })
  })

  it('ArrowRight：目录未展开→展开且焦点保持；已展开→焦点进首子级；叶子→进下一条', () => {
    expect(act('ArrowRight', '/system', [])).toEqual({ type: 'expand', key: '/system' })
    expect(act('ArrowRight', '/system', ['/system'])).toEqual({ type: 'focus', key: '/system/user' })
    expect(act('ArrowRight', '/dashboard', [])).toEqual({ type: 'focus', key: '/system' })
  })

  it('ArrowLeft：展开目录内→收纳最近展开祖先并聚焦；目录自身展开→收纳自身', () => {
    expect(act('ArrowLeft', '/system/user', ['/system'])).toEqual({
      type: 'collapse',
      key: '/system',
      focusKey: '/system',
    })
    expect(act('ArrowLeft', '/system/role/detail', ['/system', '/system/role'])).toEqual({
      type: 'collapse',
      key: '/system/role',
      focusKey: '/system/role',
    })
    expect(act('ArrowLeft', '/system', ['/system'])).toEqual({
      type: 'collapse',
      key: '/system',
      focusKey: '/system',
    })
    // 根级叶子无动作
    expect(act('ArrowLeft', '/dashboard', [])).toEqual({ type: 'none' })
  })

  it('Home/End 焦点首/末可见条目', () => {
    expect(act('Home', '/demo', [])).toEqual({ type: 'focus', key: '/dashboard' })
    expect(act('End', '/dashboard', [])).toEqual({ type: 'focus', key: '/demo' })
  })

  it('Enter/Space：目录切换展开、叶子导航；Escape 上报', () => {
    expect(act('Enter', '/system', [])).toEqual({ type: 'expand', key: '/system' })
    expect(act('Enter', '/system', ['/system'])).toEqual({
      type: 'collapse',
      key: '/system',
      focusKey: '/system',
    })
    expect(act(' ', '/dashboard', [])).toEqual({ type: 'navigate', path: '/dashboard' })
    expect(act('Escape', '/dashboard', [])).toEqual({ type: 'escape' })
    expect(act('a', '/dashboard', [])).toEqual({ type: 'none' })
  })
})
