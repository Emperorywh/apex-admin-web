/**
 * 导航树纯函数（规格 §11.2）：选中项与祖先展开链推导、面包屑层级推导。
 * SideNav/TopNav/Breadcrumb 共用本模块，不各自维护遍历逻辑；
 * 全部函数只依赖注入的 NavTreeNode 树与 Data Router matches 的 pathname/handle，
 * 不读取 store、不感知路由实例，可直接单元测试。
 * （SPEC_UI2 §6.1 起壳层导航弃用 antd Menu 完全自绘，原 antd 菜单项构建函数移除；
 * 键盘导航与扁平化见同目录 navKeys.ts。）
 */
import { readNavMatchMeta, type NavTreeNode } from './navModel'

/**
 * 菜单项标题翻译函数：调用方以 menu 命名空间绑定的 t 传入
 * （如 `useCallback((key) => t(key, { ns: MENU_NAMESPACE }), [t])`，规格 §12）。
 */
export type NavTranslate = (key: string) => string

/** 路径索引条目：节点与从根到其父级的全部祖先路径（antd Menu 以路径为 key） */
export interface NavIndexEntry {
  node: NavTreeNode
  ancestorKeys: readonly string[]
}

/**
 * 构建路径 → 节点索引：任意层级树一次遍历。
 * 无 path 的节点不登记自身（不可寻址），但其子树仍以原祖先链继续索引。
 */
export function buildNavPathIndex(navItems: readonly NavTreeNode[]): ReadonlyMap<string, NavIndexEntry> {
  const index = new Map<string, NavIndexEntry>()
  const visit = (nodes: readonly NavTreeNode[], ancestors: readonly string[]): void => {
    for (const node of nodes) {
      if (node.path !== undefined) {
        index.set(node.path, { node, ancestorKeys: ancestors })
      }
      if (node.children !== undefined && node.children.length > 0) {
        visit(node.children, node.path !== undefined ? [...ancestors, node.path] : ancestors)
      }
    }
  }
  visit(navItems, [])
  return index
}

/** 菜单选中结果：选中项 key（节点路径）与需要展开的祖先链 */
export interface NavSelection {
  selectedKey?: string
  openKeys: readonly string[]
}

/**
 * 由 Data Router 当前 match 推导选中项与祖先展开链（规格 §11.2）：
 * 自最深层 match 向上查找第一个命中导航树的节点——深层隐藏页（如详情页）回退到
 * 最近可见祖先；完全不在导航树内（如错误页）时无选中，仅保留空展开链。
 */
export function deriveNavSelection(
  navItems: readonly NavTreeNode[],
  matchPathnames: readonly string[],
): NavSelection {
  const index = buildNavPathIndex(navItems)
  for (let i = matchPathnames.length - 1; i >= 0; i -= 1) {
    const entry = index.get(matchPathnames[i])
    if (entry !== undefined) {
      return { selectedKey: entry.node.path, openKeys: entry.ancestorKeys }
    }
  }
  return { openKeys: [] }
}

/** Data Router match 的导航消费子集：推导面包屑只需 pathname 与 handle */
export interface NavMatchLike {
  pathname: string
  handle?: unknown
}

/** 面包屑层级：标题来自 handle.meta，hasPage 决定可点击性（规格 §11.2） */
export interface NavCrumb {
  pathname: string
  title: string
  hasPage: boolean
}

/**
 * 由 matches 推导面包屑层级（规格 §11.2）：
 * - 标题只从 handle.meta 读取（规格 §4.2），meta 缺失的层级不出现；
 * - meta.breadcrumb === false（错误页）与受保护根 '/' 不参与；
 * - 该层级在导航树中存在且挂载页面组件（hasPage）才可点击；
 *   无页面组件的目录节点（hasPage=false）与不在导航树内的层级渲染为纯文本。
 */
export function deriveBreadcrumbCrumbs(
  navItems: readonly NavTreeNode[],
  matches: readonly NavMatchLike[],
): NavCrumb[] {
  const index = buildNavPathIndex(navItems)
  const crumbs: NavCrumb[] = []
  for (const match of matches) {
    if (match.pathname === '/') {
      continue
    }
    const meta = readNavMatchMeta(match.handle)
    if (meta === undefined || meta.breadcrumb === false) {
      continue
    }
    crumbs.push({
      pathname: match.pathname,
      title: meta.title,
      hasPage: index.get(match.pathname)?.node.hasPage === true,
    })
  }
  return crumbs
}

/** 并集合并展开链：保留既有展开项，追加新选中项的祖先链（去重、保持出现顺序） */
export function mergeOpenKeys(current: readonly string[], incoming: readonly string[]): string[] {
  const merged = [...current]
  for (const key of incoming) {
    if (!merged.includes(key)) {
      merged.push(key)
    }
  }
  return merged
}
