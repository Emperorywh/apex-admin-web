/**
 * 应用级页签与页面缓存状态（不跨会话持久化）。
 *
 * 约定：
 * - tab.key 为规范化地址，同一 key 只有一个缓存实例
 * - cached=false 表示页签仍在但 Activity 实例被 LRU 淘汰，再激活时重新挂载
 * - revision 递增用于「刷新当前页签」：外层以新 React key 重建并取消旧 scope 请求
 * - affix 常驻页签由布局层挂载时从路由定义播种（cached=false，首次访问才挂载实例），
 *   刷新浏览器与会话重置后自动恢复，无需持久化
 * - 会话失效（主动登出 / 401 刷新失败）即整体重置，避免下个会话恢复上个会话的页签
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { sessionExpired } from '@/store/slices/authSlice'

/** 非固定页签的最大缓存实例数；affix 页签不计入 */
const PAGE_CACHE_MAX_ENTRIES = 10

/** 可序列化的 location 快照；state 固定为 null */
export interface TabLocationSnapshot {
  pathname: string
  search: string
  hash: string
  key: string
}

export interface TabEntry {
  /** 规范化页签 key */
  key: string
  routeId: string
  affix: boolean
  closable: boolean
  /** 是否存在保活缓存实例 */
  cached: boolean
  location: TabLocationSnapshot
  /** 刷新计数；变化即整树重建 */
  revision: number
  /** LRU 激活序号，越大越新 */
  activatedSeq: number
}

export interface TabSyncPayload {
  tabKey: string
  routeId: string
  affix: boolean
  closable: boolean
  /** noCache 路由为 false：仅当前实例、离开即卸载 */
  cacheable: boolean
  location: TabLocationSnapshot
}

interface TabsState {
  tabs: TabEntry[]
  activeTabKey: string | null
  /** 全局递增的激活序号 */
  seq: number
}

/** 布局层播种常驻页签时的输入（路由定义的 affixTab 叶子，结构兼容即可） */
export interface AffixTabSeedInput {
  key: string
  routeId: string
  pathname: string
}

interface TabsState {
  tabs: TabEntry[]
  activeTabKey: string | null
  /** 全局递增的激活序号 */
  seq: number
}

const initialState: TabsState = {
  tabs: [],
  activeTabKey: null,
  seq: 0,
}

/** 保留 affix 与目标页签，关闭其余；返回新的激活 key */
function closeOthers(tabs: TabEntry[], keepKey: string): { tabs: TabEntry[]; activeTabKey: string } {
  const next = tabs.filter((tab) => tab.affix || !tab.closable || tab.key === keepKey)
  return { tabs: next, activeTabKey: keepKey }
}

const tabsSlice = createSlice({
  name: 'tabs',
  initialState,
  reducers: {
    /** 挂载时播种 affix 常驻页签（cached=false，首次访问才挂载实例）；已存在的 key 跳过 */
    affixTabsSeeded(state, action: PayloadAction<AffixTabSeedInput[]>) {
      for (const seed of action.payload) {
        if (state.tabs.some((tab) => tab.key === seed.key)) continue
        state.tabs.push({
          key: seed.key,
          routeId: seed.routeId,
          affix: true,
          closable: false,
          cached: false,
          // location.key 为占位：首次访问被 tabSynced 以真实 location 覆盖
          location: { pathname: seed.pathname, search: '', hash: '', key: 'seed' },
          revision: 0,
          activatedSeq: 0,
        })
      }
    },
    /** Data Router location 变化后的页签同步（upsert + 激活 + LRU 淘汰） */
    tabSynced(state, action: PayloadAction<TabSyncPayload>) {
      const { tabKey, cacheable } = action.payload
      state.seq += 1
      const existing = state.tabs.find((tab) => tab.key === tabKey)
      if (existing) {
        existing.location = action.payload.location
        existing.routeId = action.payload.routeId
        existing.affix = action.payload.affix
        existing.closable = action.payload.closable
        existing.cached = existing.cached || cacheable
        existing.activatedSeq = state.seq
      } else {
        state.tabs.push({
          key: tabKey,
          routeId: action.payload.routeId,
          affix: action.payload.affix,
          closable: action.payload.closable,
          cached: cacheable,
          location: action.payload.location,
          revision: 0,
          activatedSeq: state.seq,
        })
      }
      state.activeTabKey = tabKey

      // LRU：仅统计非 affix 缓存实例，当前激活页永不被淘汰
      if (cacheable) {
        const cachedNonAffix = state.tabs
          .filter((tab) => tab.cached && !tab.affix && tab.key !== tabKey)
          .sort((a, b) => a.activatedSeq - b.activatedSeq)
        for (const victim of cachedNonAffix.slice(0, Math.max(0, cachedNonAffix.length - (PAGE_CACHE_MAX_ENTRIES - 1)))) {
          victim.cached = false
        }
      }
    },
    /** 关闭单个页签；若关闭的是当前页，优先激活右侧、其次左侧 */
    tabClosed(state, action: PayloadAction<string>) {
      const index = state.tabs.findIndex((tab) => tab.key === action.payload)
      if (index < 0) return
      const wasActive = state.activeTabKey === action.payload
      state.tabs.splice(index, 1)
      if (wasActive) {
        const right = state.tabs[index]
        const left = state.tabs[index - 1]
        state.activeTabKey = right?.key ?? left?.key ?? state.tabs[0]?.key ?? null
      }
    },
    /** 关闭其他页签（affix 永不受影响） */
    otherTabsClosed(state, action: PayloadAction<string>) {
      const result = closeOthers(state.tabs, action.payload)
      state.tabs = result.tabs
      state.activeTabKey = result.activeTabKey
    },
    /** 关闭左侧页签 */
    leftTabsClosed(state, action: PayloadAction<string>) {
      const index = state.tabs.findIndex((tab) => tab.key === action.payload)
      if (index < 0) return
      const removedActive = state.tabs.slice(0, index).some((tab) => tab.key === state.activeTabKey)
      state.tabs = state.tabs.filter((tab, i) => i >= index || !tab.closable || tab.affix)
      if (removedActive) state.activeTabKey = action.payload
    },
    /** 关闭右侧页签 */
    rightTabsClosed(state, action: PayloadAction<string>) {
      const index = state.tabs.findIndex((tab) => tab.key === action.payload)
      if (index < 0) return
      const removedActive = state.tabs.slice(index + 1).some((tab) => tab.key === state.activeTabKey)
      state.tabs = state.tabs.filter((tab, i) => i <= index || !tab.closable || tab.affix)
      if (removedActive) state.activeTabKey = action.payload
    },
    /** 关闭全部页签：只保留 affix 并激活第一个 */
    allTabsClosed(state) {
      state.tabs = state.tabs.filter((tab) => tab.affix || !tab.closable)
      state.activeTabKey = state.tabs[0]?.key ?? null
    },
    /** 刷新页签：revision +1，重建组件并重新进入缓存 */
    tabRefreshed(state, action: PayloadAction<string>) {
      const tab = state.tabs.find((item) => item.key === action.payload)
      if (!tab) return
      tab.revision += 1
      tab.cached = true
    },
    /** dnd-kit 拖拽排序：在可关闭区间内移动 */
    tabMoved(state, action: PayloadAction<{ fromKey: string; toKey: string }>) {
      const from = state.tabs.findIndex((tab) => tab.key === action.payload.fromKey)
      const to = state.tabs.findIndex((tab) => tab.key === action.payload.toKey)
      if (from < 0 || to < 0) return
      const [moved] = state.tabs.splice(from, 1)
      state.tabs.splice(to, 0, moved)
    },
  },
  extraReducers: (builder) => {
    /** 会话失效即清空全部页签与页面缓存实例（登出在 Header，401 在 request 层，统一在此收敛） */
    builder.addCase(sessionExpired, () => initialState)
  },
})

export const {
  affixTabsSeeded,
  tabSynced,
  tabClosed,
  otherTabsClosed,
  leftTabsClosed,
  rightTabsClosed,
  allTabsClosed,
  tabRefreshed,
  tabMoved,
} = tabsSlice.actions

export default tabsSlice.reducer
