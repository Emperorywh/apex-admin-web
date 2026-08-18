/**
 * 多页签纯逻辑模型（规格 §4.5/§9.1/§9.3）：
 * 页签 key 规范化、location 快照构造、当前视图解析、LRU 淘汰选择、
 * 关闭后继顺序（右→左→回退）、拖拽排序边界与批量关闭 key 选择。
 * 本文件只包含纯函数与数据形状：store 派发由 PageCacheHost/TabsBar 编排，
 * 切片本身保持数据操作（tabs.slice/pageCache.slice）。
 */
import type { UIMatch } from 'react-router'
import type { TabItem, TabLocationSnapshot } from '@/store/slices/tabs.slice'
import { readNavMatchMeta, type NavMatchMeta } from './navModel'

/** 页面主容器 id：TabsBar aria-controls 与焦点迁移目标（规格 §11.3） */
export const PAGE_CONTAINER_ID = 'apex-page-container'

/** affix 页签注入形状：router 层从路由定义投影（默认仅 Dashboard），布局启动重建用 */
export interface AffixTabRoute {
  pathname: string
  /** 标题为 menu 命名空间的中文文案 key，渲染时经 t 翻译（规格 §12） */
  title: string
}

/** Data Router 当前 location 的页签视图解析结果 */
export interface TabRouteView {
  /** 规范化页签 key（tabKeyMode:'pathname' 时仅 pathname，规格 §4.5） */
  key: string
  /** 最深带 meta 的 match 标题（中文文案 key） */
  title: string
  /** 命中 affixTab 的页面 */
  affix: boolean
  /** 是否生成页签（hideInTabs 页面不生成，规格 §4.2） */
  tabbed: boolean
  /** 是否可缓存：生成页签且非 noCache（规格 §9.1） */
  cacheable: boolean
  /** 不可变 location 快照：state 固定 null（规格 §4.5） */
  snapshot: TabLocationSnapshot
}

/**
 * 规范化 search：URLSearchParams.sort() 按参数名稳定排序，
 * 同名重复参数保持原顺序（规格 §4.5）；空 search 返回空字符串。
 */
export function normalizeSearch(search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search
  if (raw === '') {
    return ''
  }
  const params = new URLSearchParams(raw)
  params.sort()
  const sorted = params.toString()
  return sorted === '' ? '' : `?${sorted}`
}

/**
 * 构造页签 key：默认 fullPath = pathname + 规范化 search（不含 hash）；
 * tabKeyMode:'pathname' 仅按路径，用于 query 只表示筛选条件的页面（规格 §4.5）。
 */
export function buildTabKey(pathname: string, search: string, mode: NonNullable<NavMatchMeta['tabKeyMode']> = 'fullPath'): string {
  if (mode === 'pathname') {
    return pathname
  }
  const normalized = normalizeSearch(search)
  return normalized === '' ? pathname : `${pathname}${normalized}`
}

/** 构造不可变 location 快照：只保存 pathname/search/hash/key，state 固定 null（规格 §4.5） */
export function createTabSnapshot(
  pathname: string,
  search: string,
  hash: string,
  key: string,
): TabLocationSnapshot {
  return { pathname, search, hash, key, state: null }
}

/** 由注入的 affix 路由构造固定页签：key 即 pathname（无查询参数的入口地址） */
export function buildAffixTabItem(route: AffixTabRoute): TabItem {
  return {
    key: route.pathname,
    title: route.title,
    affix: true,
    location: createTabSnapshot(route.pathname, '', '', route.pathname),
  }
}

/**
 * 解析 Data Router 当前 location 的页签视图（规格 §4.5/§9.1）：
 * meta 取最深带 meta 的 match；hideInTabs 页面不生成页签，
 * noCache 页面生成页签但不进入 Activity/LRU。
 */
export function resolveCurrentTabView(
  location: { pathname: string; search: string; hash: string },
  matches: readonly UIMatch[],
): TabRouteView {
  let meta: NavMatchMeta | undefined
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    meta = readNavMatchMeta(matches[i].handle)
    if (meta !== undefined) {
      break
    }
  }
  const tabbed = meta?.hideInTabs !== true
  const key = buildTabKey(location.pathname, location.search, meta?.tabKeyMode)
  return {
    key,
    title: meta?.title ?? location.pathname,
    affix: meta?.affixTab === true,
    tabbed,
    cacheable: tabbed && meta?.noCache !== true,
    // 快照保存原始 search 顺序；规范化只用于 key 判定（规格 §4.5）
    snapshot: createTabSnapshot(location.pathname, location.search, location.hash, key),
  }
}

/**
 * LRU 淘汰选择（规格 §9.1/§17.13）：容量只统计非 affix 缓存（含当前页），
 * 当前页与 affix 永不作为淘汰对象；超出容量时从 LRU 队尾（最久未激活）的
 * 非当前页中淘汰，返回待淘汰 key（页签本身保留）。
 */
export function selectLruEvictions(
  lruOrder: readonly string[],
  affixKeys: ReadonlySet<string>,
  currentKey: string | null,
  maxEntries: number,
): string[] {
  const normalKeys = lruOrder.filter((key) => !affixKeys.has(key))
  const overflow = normalKeys.length - maxEntries
  if (overflow <= 0) {
    return []
  }
  const candidates = normalKeys.filter((key) => key !== currentKey)
  return candidates.slice(candidates.length - overflow)
}

/**
 * 关闭后继页签（规格 §9.3/§17.14）：优先右侧最近页签，其次左侧最近页签；
 * 均跳过本轮被移除的页签。没有任何幸存页签时返回 null，由调用方回退到
 * ROUTE_FALLBACK_PATH（正常会话 affix Dashboard 始终幸存，null 属防御分支）。
 */
export function resolveCloseSuccessor(
  items: readonly TabItem[],
  closedKey: string,
  removedKeys: ReadonlySet<string>,
): TabItem | null {
  const index = items.findIndex((tab) => tab.key === closedKey)
  if (index < 0) {
    return null
  }
  for (let i = index + 1; i < items.length; i += 1) {
    if (!removedKeys.has(items[i].key)) {
      return items[i]
    }
  }
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!removedKeys.has(items[i].key)) {
      return items[i]
    }
  }
  return null
}

/** 关闭其他：锚点之外的全部普通页签（affix 永不受批量关闭影响，规格 §9.3） */
export function selectCloseOthersKeys(items: readonly TabItem[], anchorKey: string): string[] {
  return items.filter((tab) => !tab.affix && tab.key !== anchorKey).map((tab) => tab.key)
}

/** 关闭左侧：锚点左侧的全部普通页签（与关闭右侧对称，规格 §9.3） */
export function selectCloseLeftKeys(items: readonly TabItem[], anchorKey: string): string[] {
  const anchorIndex = items.findIndex((tab) => tab.key === anchorKey)
  if (anchorIndex < 0) {
    return []
  }
  return items.filter((tab, index) => !tab.affix && index < anchorIndex).map((tab) => tab.key)
}

/** 关闭右侧：锚点右侧的全部普通页签 */
export function selectCloseRightKeys(items: readonly TabItem[], anchorKey: string): string[] {
  const anchorIndex = items.findIndex((tab) => tab.key === anchorKey)
  if (anchorIndex < 0) {
    return []
  }
  return items.filter((tab, index) => !tab.affix && index > anchorIndex).map((tab) => tab.key)
}

/** 关闭全部：全部普通页签（只保留 affix，规格 §9.3） */
export function selectCloseAllKeys(items: readonly TabItem[]): string[] {
  return items.filter((tab) => !tab.affix).map((tab) => tab.key)
}

/**
 * 拖拽排序落点计算（规格 §9.3）：普通页签不得拖入固定区、固定页签不得拖出固定区。
 * 落点穿越固定区边界（前 affixCount 位不再全为 affix）时视为非法，返回 null 整体忽略；
 * affix 页签在 TabsBar 侧禁用拖拽，此处边界校验是最终防线。
 */
export function computeTabsReorder(
  items: readonly TabItem[],
  draggingKey: string,
  overKey: string,
): TabItem[] | null {
  if (draggingKey === overKey) {
    return null
  }
  const from = items.findIndex((tab) => tab.key === draggingKey)
  const to = items.findIndex((tab) => tab.key === overKey)
  if (from < 0 || to < 0) {
    return null
  }
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  const affixCount = items.filter((tab) => tab.affix).length
  const prefixStillAffix = next.slice(0, affixCount).every((tab) => tab.affix)
  const suffixStillNormal = next.slice(affixCount).every((tab) => !tab.affix)
  return prefixStillAffix && suffixStillNormal ? next : null
}

/** 页签 location 快照 → 导航目标（pathname + search + hash） */
export function tabLocationTarget(location: TabLocationSnapshot): string {
  return `${location.pathname}${location.search}${location.hash}`
}
