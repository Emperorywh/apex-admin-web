/**
 * 自绘导航扁平化与键盘语义测试（SPEC_UI2 §6.1 可访问性红线）：
 * 可见项扁平化（展开链过滤、无 path 上提、forceExpand）、垂直 menu 按键
 * （上下游走/开合/激活/Esc 回父级）、横向 menubar 按键（左右游走/开浮层）。
 */
import { describe, expect, it } from 'vitest'
import type { NavTreeNode } from './navModel'
import { flattenVisibleNavItems, resolveHorizontalNavKey, resolveVerticalNavKey } from './navKeys'

function navTree(): NavTreeNode[] {
  return [
    { id: 'dashboard', path: '/dashboard', title: '仪表盘', hasPage: true },
    {
      id: 'system',
      path: '/system',
      title: '系统管理',
      hasPage: false,
      children: [
        { id: 'system-user', path: '/system/user', title: '用户管理', hasPage: true },
        { id: 'system-role', path: '/system/role', title: '角色管理', hasPage: true },
      ],
    },
    {
      id: 'demo',
      path: '/demo',
      title: '演示',
      hasPage: false,
      children: [
        {
          id: 'demo-nested',
          path: '/demo/nested',
          title: '多级菜单',
          hasPage: false,
          children: [{ id: 'level1', path: '/demo/nested/level1', title: '一级页面', hasPage: true }],
        },
      ],
    },
    { id: 'odd', title: '无路径节点', hasPage: false, children: [{ id: 'odd-child', path: '/odd/child', title: '无路径子节点', hasPage: true }] },
  ]
}

describe('flattenVisibleNavItems 可见项扁平化', () => {
  it('目录未展开时子级不可见；展开后按先序进入序列并携带深度与父链', () => {
    const closed = flattenVisibleNavItems(navTree(), [])
    expect(closed.map((item) => item.key)).toEqual(['/dashboard', '/system', '/demo', '/odd/child'])

    const open = flattenVisibleNavItems(navTree(), ['/system', '/demo', '/demo/nested'])
    expect(open.map((item) => item.key)).toEqual([
      '/dashboard',
      '/system',
      '/system/user',
      '/system/role',
      '/demo',
      '/demo/nested',
      '/demo/nested/level1',
      '/odd/child',
    ])
    expect(open[2]).toMatchObject({ depth: 1, parentKey: '/system', hasChildren: false })
    expect(open[5]).toMatchObject({ depth: 1, hasChildren: true, isOpen: true })
  })

  it('forceExpand 忽略 openKeys 全量展开（mini 悬浮浮层/顶部下拉用）', () => {
    const flat = flattenVisibleNavItems(navTree(), [], true)
    expect(flat.map((item) => item.key)).toContain('/demo/nested/level1')
  })
})

describe('resolveVerticalNavKey 垂直 menu 键盘语义（SPEC_UI2 §6.1）', () => {
  const open = flattenVisibleNavItems(navTree(), ['/system'])

  it('ArrowDown/ArrowUp 在可见项间循环游走', () => {
    expect(resolveVerticalNavKey(open, '/dashboard', 'ArrowDown')).toEqual({ type: 'focus', key: '/system' })
    expect(resolveVerticalNavKey(open, '/dashboard', 'ArrowUp')).toEqual({ type: 'focus', key: '/odd/child' })
    expect(resolveVerticalNavKey(open, '/odd/child', 'ArrowDown')).toEqual({ type: 'focus', key: '/dashboard' })
  })

  it('ArrowRight：目录未展开→展开；已展开→焦点进首个子项；叶子→无操作', () => {
    expect(resolveVerticalNavKey(open, '/demo', 'ArrowRight')).toEqual({ type: 'toggle-open', key: '/demo', open: true })
    expect(resolveVerticalNavKey(open, '/system', 'ArrowRight')).toEqual({ type: 'focus', key: '/system/user' })
    expect(resolveVerticalNavKey(open, '/dashboard', 'ArrowRight')).toBeNull()
  })

  it('ArrowLeft：目录已展开→收起；子项→焦点回父目录', () => {
    expect(resolveVerticalNavKey(open, '/system', 'ArrowLeft')).toEqual({ type: 'toggle-open', key: '/system', open: false })
    expect(resolveVerticalNavKey(open, '/system/user', 'ArrowLeft')).toEqual({ type: 'focus', key: '/system' })
    expect(resolveVerticalNavKey(open, '/dashboard', 'ArrowLeft')).toBeNull()
  })

  it('Enter/Space：叶子激活导航，目录开合切换', () => {
    expect(resolveVerticalNavKey(open, '/dashboard', 'Enter')).toEqual({ type: 'activate', key: '/dashboard' })
    expect(resolveVerticalNavKey(open, '/system', ' ')).toEqual({ type: 'toggle-open', key: '/system', open: false })
  })

  it('Escape：子项焦点回父目录；一级项无操作', () => {
    expect(resolveVerticalNavKey(open, '/system/user', 'Escape')).toEqual({ type: 'focus', key: '/system' })
    expect(resolveVerticalNavKey(open, '/system', 'Escape')).toBeNull()
  })

  it('Home/End 跳首末可见项；未知键与未知 currentKey 返回 null', () => {
    expect(resolveVerticalNavKey(open, '/system', 'Home')).toEqual({ type: 'focus', key: '/dashboard' })
    expect(resolveVerticalNavKey(open, '/system', 'End')).toEqual({ type: 'focus', key: '/odd/child' })
    expect(resolveVerticalNavKey(open, '/system', 'Tab')).toBeNull()
    expect(resolveVerticalNavKey(open, '/missing', 'ArrowDown')).toBeNull()
  })
})

describe('resolveHorizontalNavKey 横向 menubar 键盘语义（SPEC_UI2 §6.1）', () => {
  const top = flattenVisibleNavItems(navTree(), [])

  it('ArrowLeft/ArrowRight 在一级项间循环游走', () => {
    expect(resolveHorizontalNavKey(top, '/dashboard', 'ArrowRight')).toEqual({ type: 'focus', key: '/system' })
    expect(resolveHorizontalNavKey(top, '/dashboard', 'ArrowLeft')).toEqual({ type: 'focus', key: '/odd/child' })
  })

  it('ArrowDown/Enter：目录开浮层，叶子激活', () => {
    expect(resolveHorizontalNavKey(top, '/system', 'ArrowDown')).toEqual({ type: 'open-popup', key: '/system' })
    expect(resolveHorizontalNavKey(top, '/system', 'Enter')).toEqual({ type: 'open-popup', key: '/system' })
    expect(resolveHorizontalNavKey(top, '/dashboard', 'Enter')).toEqual({ type: 'activate', key: '/dashboard' })
    expect(resolveHorizontalNavKey(top, '/dashboard', 'ArrowDown')).toBeNull()
  })
})
