/**
 * 自绘导航键盘与展开纯函数（SPEC_UI2 §6.1 可访问性红线）：
 * 重建 antd Menu 现成的键盘语义——方向键游走、ArrowRight/Left 展开收纳、
 * Enter/Space 激活、Home/End 首末、Esc 收纳/关闭浮层；全部逻辑为纯函数，
 * 不读取 store、不触碰 DOM，可同目录单测（navKeyboard.test.ts）。
 * SideNav（垂直，含 mini 折叠浮层）消费同一套语义。
 */
import type { NavTreeNode } from './navModel'

/** 扁平化导航条目：保留父子引用与层级，供焦点游走与展开判定 */
export interface NavFlatEntry {
  /** 节点 key（节点路径） */
  key: string
  /** 可寻址叶子路径；目录节点可能携带路径但导航只走叶子 */
  path?: string
  title: string
  /** 是否目录（含子节点） */
  hasChildren: boolean
  /** 父节点 key；根级为 null */
  parentKey: string | null
  /** 从根计的层级（根级 0） */
  level: number
}

/** 任意层级树一次遍历扁平化（DFS，保持菜单视觉顺序） */
export function flattenNavTree(nodes: readonly NavTreeNode[], parentKey: string | null = null, level = 0): NavFlatEntry[] {
  const entries: NavFlatEntry[] = []
  for (const node of nodes) {
    if (node.path === undefined) {
      // 无 path 的目录不生成条目，其子树以原层级上提（与 buildNavPathIndex 口径一致）
      if (node.children !== undefined) {
        entries.push(...flattenNavTree(node.children, parentKey, level))
      }
      continue
    }
    entries.push({
      key: node.path,
      path: node.path,
      title: node.title,
      hasChildren: node.children !== undefined && node.children.length > 0,
      parentKey,
      level,
    })
    if (node.children !== undefined && node.children.length > 0) {
      entries.push(...flattenNavTree(node.children, node.path, level + 1))
    }
  }
  return entries
}

/** 由扁平条目查 key → 条目 */
export function findNavEntry(entries: readonly NavFlatEntry[], key: string): NavFlatEntry | undefined {
  return entries.find((entry) => entry.key === key)
}

/** 展开集合下的可见条目：祖先全部展开才可见 */
export function visibleNavEntries(
  entries: readonly NavFlatEntry[],
  openKeys: readonly string[],
): NavFlatEntry[] {
  const open = new Set(openKeys)
  const hidden = new Set<string>()
  return entries.filter((entry) => {
    if (entry.parentKey === null) {
      return true
    }
    const parent = findNavEntry(entries, entry.parentKey)
    if (parent === undefined) {
      return true
    }
    if (hidden.has(parent.key) || (parent.hasChildren && !open.has(parent.key))) {
      hidden.add(entry.key)
      return false
    }
    return true
  })
}

/** 焦点在可见条目间顺序游走（循环），返回目标 key；无可见条目返回 null */
export function moveNavFocus(
  visible: readonly NavFlatEntry[],
  currentKey: string | null,
  offset: 1 | -1,
): string | null {
  if (visible.length === 0) {
    return null
  }
  const index = visible.findIndex((entry) => entry.key === currentKey)
  if (index === -1) {
    return visible[0].key
  }
  const next = (index + offset + visible.length) % visible.length
  return visible[next].key
}

/** key 是否位于指定子树内（含根自身）：mini 浮层 Esc 判定用 */
export function isNavKeyWithin(entries: readonly NavFlatEntry[], key: string, subtreeRootKey: string): boolean {
  let current = findNavEntry(entries, key)
  while (current !== undefined) {
    if (current.key === subtreeRootKey) {
      return true
    }
    current = current.parentKey === null ? undefined : findNavEntry(entries, current.parentKey)
  }
  return false
}

/** 键盘动作结果：SideNav 消费后落到焦点/展开/导航三类状态 */
export type NavKeyAction =
  | { type: 'none' }
  | { type: 'focus'; key: string }
  | { type: 'expand'; key: string; focusKey?: string }
  | { type: 'collapse'; key: string; focusKey: string }
  | { type: 'navigate'; path: string }
  | { type: 'escape' }

/**
 * 解析菜单键按 ARIA menu 模式（SPEC_UI2 §6.1）的动作：
 * - ArrowDown/Up：可见条目间循环游走；
 * - ArrowRight：目录未展开则展开（焦点保持）；已展开则焦点进首个子级；叶子进下一条；
 * - ArrowLeft：焦点处于展开目录内则收纳最近展开祖先并聚焦它；目录自身已展开则收纳自身；
 * - Home/End：首/末可见条目；
 * - Enter/Space：目录切换展开，叶子导航；
 * - Escape：上报 escape（mini 浮层关闭 / 收纳由调用方按上下文决定）。
 */
export function resolveNavKeyAction(input: {
  /** 触发键（KeyboardEvent.key） */
  key: string
  /** 当前焦点条目 */
  entry: NavFlatEntry
  /** 全量扁平条目（含不可见，供祖先链判定） */
  entries: readonly NavFlatEntry[]
  /** 可见条目（展开集合过滤后） */
  visible: readonly NavFlatEntry[]
  /** 当前展开集合 */
  openKeys: readonly string[]
}): NavKeyAction {
  const { key, entry, entries, visible, openKeys } = input
  const open = new Set(openKeys)

  switch (key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      const target = moveNavFocus(visible, entry.key, key === 'ArrowDown' ? 1 : -1)
      return target === null ? { type: 'none' } : { type: 'focus', key: target }
    }
    case 'ArrowRight': {
      if (entry.hasChildren) {
        if (!open.has(entry.key)) {
          return { type: 'expand', key: entry.key }
        }
        const firstChild = visible.find((item) => item.parentKey === entry.key)
        return firstChild === undefined ? { type: 'none' } : { type: 'focus', key: firstChild.key }
      }
      const next = moveNavFocus(visible, entry.key, 1)
      return next === null || next === entry.key ? { type: 'none' } : { type: 'focus', key: next }
    }
    case 'ArrowLeft': {
      // 焦点在展开目录内：收纳最近展开祖先并聚焦它
      let parentKey = entry.parentKey
      while (parentKey !== null) {
        const parent = findNavEntry(entries, parentKey)
        if (parent === undefined) {
          break
        }
        if (parent.hasChildren && open.has(parent.key)) {
          return { type: 'collapse', key: parent.key, focusKey: parent.key }
        }
        parentKey = parent.parentKey
      }
      if (entry.hasChildren && open.has(entry.key)) {
        return { type: 'collapse', key: entry.key, focusKey: entry.key }
      }
      return { type: 'none' }
    }
    case 'Home': {
      const first = visible[0]
      return first === undefined ? { type: 'none' } : { type: 'focus', key: first.key }
    }
    case 'End': {
      const last = visible[visible.length - 1]
      return last === undefined ? { type: 'none' } : { type: 'focus', key: last.key }
    }
    case 'Enter':
    case ' ': {
      if (entry.hasChildren) {
        return open.has(entry.key)
          ? { type: 'collapse', key: entry.key, focusKey: entry.key }
          : { type: 'expand', key: entry.key }
      }
      return entry.path === undefined ? { type: 'none' } : { type: 'navigate', path: entry.path }
    }
    case 'Escape':
      return { type: 'escape' }
    default:
      return { type: 'none' }
  }
}
