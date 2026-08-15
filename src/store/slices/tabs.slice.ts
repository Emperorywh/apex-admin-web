/**
 * 多页签切片（规格 §4.5/§8.1/§9.3）：保存页签 key、location 快照、title、affix 与顺序；不持久化。
 * 本切片只定形数据操作：关闭后激活顺序、LRU 淘汰、拖拽落点边界等交互策略由页签任务编排，
 * 权限收窄关页签等跨切片 thunk 由认证/页签任务在切片之外组合，均不写入本切片。
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * 页签 location 快照（规格 §4.5）：只保存可序列化的 pathname/search/hash/key，state 固定为 null。
 * 模板业务导航禁止依赖 location.state 传递数据，应使用 URL 参数或业务 store。
 */
export interface TabLocationSnapshot {
  pathname: string
  search: string
  hash: string
  key: string
  state: null
}

/** 单个页签：key 为规范化 pathname+search（tabKeyMode:'pathname' 时仅 pathname），不含 hash */
export interface TabItem {
  key: string
  title: string
  /** 固定页签：排在最前且不可关闭，批量关闭永不影响 affix（规格 §9.3） */
  affix: boolean
  /** 不可变 location 快照：导航到同 key 时替换该快照，不创建第二个缓存实例 */
  location: TabLocationSnapshot
}

/** tabs 切片状态：items 数组顺序即页签展示顺序 */
export interface TabsState {
  items: TabItem[]
  /** 当前激活页签 key；无页签或激活页签被移除且尚未指定后继时为 null */
  activeKey: string | null
}

export const initialTabsState: TabsState = { items: [], activeKey: null }

export const tabsSlice = createSlice({
  name: 'tabs',
  initialState: initialTabsState,
  reducers: {
    /** 打开或激活页签：同 key 导航替换快照并激活（保持原位置），新 key 追加到末尾（规格 §4.5） */
    tabOpened(state, action: PayloadAction<{ tab: TabItem }>) {
      const { tab } = action.payload
      const index = state.items.findIndex((item) => item.key === tab.key)
      if (index >= 0) {
        state.items[index] = tab
      } else {
        state.items.push(tab)
      }
      state.activeKey = tab.key
    },
    /** 仅更新快照：hash 变化复用当前页签、只更新 location 快照，不产生新页签；key 不存在时忽略 */
    tabSnapshotUpdated(state, action: PayloadAction<{ key: string; location: TabLocationSnapshot }>) {
      const tab = state.items.find((item) => item.key === action.payload.key)
      if (tab) {
        tab.location = action.payload.location
      }
    },
    /** 激活指定页签；key 不存在时忽略，保持原激活态 */
    tabActivated(state, action: PayloadAction<{ key: string }>) {
      if (state.items.some((item) => item.key === action.payload.key)) {
        state.activeKey = action.payload.key
      }
    },
    /**
     * 按 key 批量移除页签（关闭其他/关闭右侧/关闭全部都以此为原语）：
     * affix 页签永不移除；激活页签被移除时 activeKey 置 null，
     * 由调用方按「右 → 左 → /dashboard」固定顺序决定后继激活（规格 §9.3）。
     */
    tabsRemoved(state, action: PayloadAction<{ keys: string[] }>) {
      const removing = new Set(action.payload.keys)
      state.items = state.items.filter((item) => item.affix || !removing.has(item.key))
      if (state.activeKey !== null && !state.items.some((item) => item.key === state.activeKey)) {
        state.activeKey = null
      }
    },
    /**
     * 拖拽排序：整体替换页签顺序。key 集合必须与原列表完全一致（数量一致且互不重复），
     * 否则视为非法排序并忽略；固定区/普通区边界等落点约束由页签任务在调用侧保证（规格 §9.3）。
     */
    tabsReordered(state, action: PayloadAction<{ items: TabItem[] }>) {
      const next = action.payload.items
      const currentKeys = new Set(state.items.map((item) => item.key))
      const nextKeys = new Set(next.map((item) => item.key))
      const sameKeySet =
        next.length === currentKeys.size && nextKeys.size === next.length && [...nextKeys].every((key) => currentKeys.has(key))
      if (sameKeySet) {
        state.items = next
      }
    },
    /** 登出/会话清理：销毁全部页签（含 affix）；与「关闭全部只保留 affix Dashboard」语义不同（规格 §6.2） */
    tabsCleared(state) {
      state.items = []
      state.activeKey = null
    },
  },
})

export const { tabOpened, tabSnapshotUpdated, tabActivated, tabsRemoved, tabsReordered, tabsCleared } =
  tabsSlice.actions
