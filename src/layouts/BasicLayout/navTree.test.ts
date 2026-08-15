/**
 * 导航树纯函数测试（规格 §11.2）：选中项与祖先展开链推导（含深层隐藏页回退、
 * 错误页无选中）、面包屑层级推导（handle.meta 标题、breadcrumb:false 与根路径
 * 排除、目录不可点击）、antd 菜单项构建（任意层级递归、aria-current、无 path 跳过）
 * 与展开链并集。
 */
import { describe, expect, it } from 'vitest'
import { LayoutGrid, Users } from 'lucide-react'
import type { NavTreeNode } from './navModel'

import {
  buildNavMenuItems,
  buildNavPathIndex,
  deriveBreadcrumbCrumbs,
  deriveNavSelection,
  mergeOpenKeys,
} from './navTree'

/** 三级导航树：目录无页面组件，叶子有；含一个无 path 的异常节点 */
function navTree(): NavTreeNode[] {
  return [
    { id: 'dashboard', path: '/dashboard', title: '仪表盘', hasPage: true },
    {
      id: 'system',
      path: '/system',
      title: '系统管理',
      hasPage: false,
      children: [
        { id: 'system-user', path: '/system/user', title: '用户管理', hasPage: true, icon: Users },
        {
          id: 'system-role',
          path: '/system/role',
          title: '角色管理',
          hasPage: true,
          children: [
            { id: 'system-role-detail', path: '/system/role/detail', title: '角色详情', hasPage: true },
          ],
        },
      ],
    },
    { id: 'odd', title: '无路径节点', hasPage: true, children: [{ id: 'odd-child', path: '/odd/child', title: '无路径子节点', hasPage: true }] },
  ]
}

describe('buildNavPathIndex 路径索引（任意层级）', () => {
  it('登记全部可寻址节点并携带从根到父级的祖先链', () => {
    const index = buildNavPathIndex(navTree())
    expect(index.get('/system/user')?.node.title).toBe('用户管理')
    expect(index.get('/system/user')?.ancestorKeys).toEqual(['/system'])
    expect(index.get('/system/role/detail')?.ancestorKeys).toEqual(['/system', '/system/role'])
    expect(index.get('/dashboard')?.ancestorKeys).toEqual([])
  })

  it('无 path 节点不登记自身，其子树沿用原祖先链继续索引', () => {
    const index = buildNavPathIndex(navTree())
    expect(index.has('odd')).toBe(false)
    expect(index.get('/odd/child')?.ancestorKeys).toEqual([])
  })
})

describe('deriveNavSelection 选中项与祖先展开链（规格 §11.2）', () => {
  it('深层叶子选中：选中项为叶子路径，展开链为全部祖先目录', () => {
    const selection = deriveNavSelection(navTree(), ['/', '/system', '/system/role', '/system/role/detail'])
    expect(selection.selectedKey).toBe('/system/role/detail')
    expect(selection.openKeys).toEqual(['/system', '/system/role'])
  })

  it('深层隐藏页（不在导航树内）回退到最近的可见祖先', () => {
    const selection = deriveNavSelection(navTree(), ['/', '/system', '/system/user', '/system/user/1001'])
    expect(selection.selectedKey).toBe('/system/user')
    expect(selection.openKeys).toEqual(['/system'])
  })

  it('完全不在导航树内的路由（如错误页）无选中项', () => {
    const selection = deriveNavSelection(navTree(), ['/', '/403'])
    expect(selection.selectedKey).toBeUndefined()
    expect(selection.openKeys).toEqual([])
  })
})

describe('deriveBreadcrumbCrumbs 面包屑层级（规格 §11.2/§4.2）', () => {
  it('标题来自 handle.meta；受保护根与 meta.breadcrumb:false 的层级不出现', () => {
    const crumbs = deriveBreadcrumbCrumbs(navTree(), [
      { pathname: '/', handle: { meta: { title: '首页' } } },
      { pathname: '/system', handle: { meta: { title: '系统管理' } } },
      { pathname: '/system/user', handle: { meta: { title: '用户管理' } } },
    ])
    expect(crumbs).toEqual([
      { pathname: '/system', title: '系统管理', hasPage: false },
      { pathname: '/system/user', title: '用户管理', hasPage: true },
    ])
  })

  it('无页面组件的目录节点 hasPage=false（渲染为不可点击）；无 handle 的层级跳过', () => {
    const crumbs = deriveBreadcrumbCrumbs(navTree(), [
      { pathname: '/', handle: { meta: { title: '首页' } } },
      { pathname: '/system', handle: { meta: { title: '系统管理' } } },
      { pathname: '/system/role', handle: undefined },
      { pathname: '/system/role/detail', handle: { meta: { title: '角色详情', breadcrumb: true } } },
    ])
    expect(crumbs).toEqual([
      { pathname: '/system', title: '系统管理', hasPage: false },
      { pathname: '/system/role/detail', title: '角色详情', hasPage: true },
    ])
  })

  it('不在导航树内的层级仍展示标题但不可点击（hasPage=false）', () => {
    const crumbs = deriveBreadcrumbCrumbs(navTree(), [
      { pathname: '/hidden', handle: { meta: { title: '隐藏页' } } },
    ])
    expect(crumbs).toEqual([{ pathname: '/hidden', title: '隐藏页', hasPage: false }])
  })
})

describe('buildNavMenuItems antd 菜单项构建（任意层级）', () => {
  const identity = (key: string): string => key

  it('目录成为子菜单、叶子为菜单项，key 为节点路径并翻译标题', () => {
    const items = buildNavMenuItems(navTree(), identity)
    expect(items).toHaveLength(3)
    const system = items[1] as { key: string; label: { props: { children: string } }; children: unknown[] }
    expect(system.key).toBe('/system')
    expect(system.label.props.children).toBe('系统管理')
    expect(system.children).toHaveLength(2)
    const role = system.children[1] as { children: unknown[] }
    expect(role.children).toHaveLength(1)
  })

  it('图标节点生成菜单图标；选中项 label 携带 aria-current="page"', () => {
    const items = buildNavMenuItems(navTree(), identity, '/system/user')
    const user = (items[1] as { children: Array<{ key: string; icon: object; label: { props: Record<string, unknown> } }> }).children[0]
    expect(user.key).toBe('/system/user')
    expect(user.icon).toBeDefined()
    expect(user.label.props['aria-current']).toBe('page')
    const dashboard = items[0] as { label: { props: Record<string, unknown> } }
    expect(dashboard.label.props['aria-current']).toBeUndefined()
  })

  it('无 path 节点不生成菜单项，但其子节点照常生成', () => {
    const items = buildNavMenuItems(navTree(), identity)
    const odd = items[2] as { key: string; children: unknown[] }
    expect(odd.key).toBe('/odd/child')
    expect(odd.children).toBeUndefined()
  })

  it('翻译函数应用于标题（中文 key → 目标语言）', () => {
    const items = buildNavMenuItems(navTree(), (key) => `${key}-en`)
    expect((items[0] as { label: { props: { children: string } } }).label.props.children).toBe('仪表盘-en')
  })
})

describe('mergeOpenKeys 展开链并集', () => {
  it('保留既有展开项并追加新祖先链，去重且保持出现顺序', () => {
    expect(mergeOpenKeys(['/a'], ['/b', '/a'])).toEqual(['/a', '/b'])
    expect(mergeOpenKeys([], ['/x'])).toEqual(['/x'])
  })
})

describe('图标组件引用（构建入参契约）', () => {
  it('NavTreeNode.icon 接受 lucide 图标组件', () => {
    const node: NavTreeNode = { id: 'x', path: '/x', title: 'X', hasPage: true, icon: LayoutGrid }
    expect(node.icon).toBe(LayoutGrid)
  })
})
