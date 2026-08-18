/**
 * 自绘导航键盘与扁平化纯函数（SPEC_UI2 §6.1 可访问性红线）：
 * 重建 antd Menu 现成的键盘能力——方向键/Enter/Esc 操作、展开链随路由派生。
 * 全部函数只依赖 NavTreeNode 树与 openKeys 快照，不读取 store、不感知 DOM，
 * 供 SideNav/TopNav 消费并可直接单元测试（同目录 navKeys.test.ts）。
 */
import type { NavTreeNode } from './navModel'

/** 扁平化后的可见导航项：垂直菜单（含已展开子级）的键盘游走与渲染共用 */
export interface NavFlatItem {
  /** 节点路径（导航 key） */
  key: string
  /** 缩进层级（0 为一级） */
  depth: number
  /** 是否有可见子级（目录节点） */
  hasChildren: boolean
  /** 目录节点当前是否展开（叶子恒 false） */
  isOpen: boolean
  /** 父目录 key（一级项无） */
  parentKey?: string
  /** 节点标题（i18n key）：悬浮浮层/提示消费 */
  title: string
}

/**
 * 把导航树按展开状态扁平化为可见项序列（先序遍历）：
 * 无 path 的节点不可寻址，不进入序列，其可见子级上提一级（与 navTree 索引口径一致）；
 * 目录未展开时其子级不可见。折叠悬浮浮层传 forceExpand=true 时忽略 openKeys 全量展开。
 */
export function flattenVisibleNavItems(
  nodes: readonly NavTreeNode[],
  openKeys: readonly string[],
  forceExpand = false,
): NavFlatItem[] {
  const flat: NavFlatItem[] = []
  const visit = (list: readonly NavTreeNode[], depth: number, parentKey: string | undefined): void => {
    for (const node of list) {
      if (node.path === undefined) {
        if (node.children !== undefined && node.children.length > 0) {
          visit(node.children, depth, parentKey)
        }
        continue
      }
      const hasChildren = node.children !== undefined && node.children.length > 0
      const isOpen = hasChildren && (forceExpand || openKeys.includes(node.path))
      flat.push({ key: node.path, depth, hasChildren, isOpen, parentKey, title: node.title })
      if (isOpen && node.children !== undefined) {
        visit(node.children, depth + 1, node.path)
      }
    }
  }
  visit(nodes, 0, undefined)
  return flat
}

/** 垂直导航按键解析结果：焦点游走 / 目录开合 / 叶子激活 */
export type NavKeyAction =
  | { readonly type: 'focus'; readonly key: string }
  | { readonly type: 'toggle-open'; readonly key: string; readonly open: boolean }
  | { readonly type: 'activate'; readonly key: string }

/**
 * 垂直菜单按键语义（menu 模式，SPEC_UI2 §6.1）：
 * - ArrowDown/ArrowUp：在可见项间游走（循环）；
 * - ArrowRight：目录未展开→展开；已展开→焦点进首个子项；叶子→无操作；
 * - ArrowLeft：目录已展开→收起；其余→焦点回父目录；
 * - Enter/Space：叶子→激活导航；目录→开合切换；
 * - Escape：焦点回父目录（无父级无操作）；
 * - Home/End：跳到首/末可见项。
 */
export function resolveVerticalNavKey(
  items: readonly NavFlatItem[],
  currentKey: string,
  pressedKey: string,
): NavKeyAction | null {
  const index = items.findIndex((item) => item.key === currentKey)
  if (index < 0 || items.length === 0) {
    return null
  }
  const current = items[index]
  switch (pressedKey) {
    case 'ArrowDown':
      return { type: 'focus', key: items[(index + 1) % items.length].key }
    case 'ArrowUp':
      return { type: 'focus', key: items[(index - 1 + items.length) % items.length].key }
    case 'Home':
      return { type: 'focus', key: items[0].key }
    case 'End':
      return { type: 'focus', key: items[items.length - 1].key }
    case 'ArrowRight':
      if (!current.hasChildren) {
        return null
      }
      if (!current.isOpen) {
        return { type: 'toggle-open', key: current.key, open: true }
      }
      return { type: 'focus', key: items[index + 1].key }
    case 'ArrowLeft':
      if (current.hasChildren && current.isOpen) {
        return { type: 'toggle-open', key: current.key, open: false }
      }
      if (current.parentKey !== undefined) {
        return { type: 'focus', key: current.parentKey }
      }
      return null
    case 'Enter':
    case ' ':
      if (current.hasChildren) {
        return { type: 'toggle-open', key: current.key, open: !current.isOpen }
      }
      return { type: 'activate', key: current.key }
    case 'Escape':
      if (current.parentKey !== undefined) {
        return { type: 'focus', key: current.parentKey }
      }
      return null
    default:
      return null
  }
}

/**
 * 横向一级导航按键语义（menubar 模式，SPEC_UI2 §6.1 TopNav）：
 * - ArrowLeft/ArrowRight：在一级项间游走（循环）；
 * - ArrowDown/Enter/Space：目录→打开下拉浮层（open-popup），叶子→激活；
 * - Escape：交由浮层自身关闭（此处返回 null）。
 */
export function resolveHorizontalNavKey(
  items: readonly NavFlatItem[],
  currentKey: string,
  pressedKey: string,
): (NavKeyAction | { readonly type: 'open-popup'; readonly key: string }) | null {
  const index = items.findIndex((item) => item.key === currentKey)
  if (index < 0 || items.length === 0) {
    return null
  }
  const current = items[index]
  switch (pressedKey) {
    case 'ArrowRight':
      return { type: 'focus', key: items[(index + 1) % items.length].key }
    case 'ArrowLeft':
      return { type: 'focus', key: items[(index - 1 + items.length) % items.length].key }
    case 'ArrowDown':
      return current.hasChildren ? { type: 'open-popup', key: current.key } : null
    case 'Enter':
    case ' ':
      return current.hasChildren
        ? { type: 'open-popup', key: current.key }
        : { type: 'activate', key: current.key }
    default:
      return null
  }
}
