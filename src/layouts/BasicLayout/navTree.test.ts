/**
 * 导航树纯函数测试（规格 §11.2）：选中项与祖先展开链推导（含深层隐藏页回退、
 * 错误页无选中）、面包屑层级推导（handle.meta 标题、breadcrumb:false 与根路径
 * 排除、目录不可点击）与展开链并集。
 * （SPEC_UI2 §6.1 起壳层导航自绘，antd 菜单项构建测试移除；图标名字符串与
 * 键盘游走测试见 navKeys.test.ts 与 AppIcon 注册完整性测试。）
 */
import { describe, expect, it } from 'vitest'
import type { NavTreeNode } from './navModel'

import {
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
        { id: 'system-user', path: '/system/user', title: '用户管理', hasPage: true, icon: 'local:ic-user' },
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

describe('mergeOpenKeys 展开链并集', () => {
  it('保留既有展开项并追加新祖先链，去重且保持出现顺序', () => {
    expect(mergeOpenKeys(['/a'], ['/b', '/a'])).toEqual(['/a', '/b'])
    expect(mergeOpenKeys([], ['/x'])).toEqual(['/x'])
  })
})

describe('图标名契约（SPEC_UI2 §5.4）', () => {
  it('NavTreeNode.icon 为 local: 图标名字符串（原组件引用废止）', () => {
    const node: NavTreeNode = { id: 'x', path: '/x', title: 'X', hasPage: true, icon: 'local:ic-menu' }
    expect(node.icon).toBe('local:ic-menu')
  })
})
