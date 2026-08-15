/**
 * 页面缓存切片（规格 §8.1/§9.1）：记录缓存 key、revision 与 LRU 顺序；不持久化。
 * 本切片只维护缓存数据：容量上限（PAGE_CACHE_MAX_ENTRIES）、淘汰最久未激活且非当前页等
 * LRU 策略由页签任务在调用侧编排，不写入本切片。
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/** pageCache 切片状态：revisions 与 lruOrder 由同一批 action 保持一致 */
export interface PageCacheState {
  /** 各缓存实例的 revision：新建为 0，刷新当前页签时递增，用于生成新 React key 重建组件（规格 §9.3） */
  revisions: Record<string, number>
  /** LRU 顺序：队首为最近激活，队尾为最久未激活 */
  lruOrder: string[]
}

export const initialPageCacheState: PageCacheState = { revisions: {}, lruOrder: [] }

export const pageCacheSlice = createSlice({
  name: 'pageCache',
  initialState: initialPageCacheState,
  reducers: {
    /** 页签激活/新建缓存：确保 revision 存在（初始 0）并把 key 移到 LRU 队首 */
    cacheEntryTouched(state, action: PayloadAction<{ key: string }>) {
      const { key } = action.payload
      if (state.revisions[key] === undefined) {
        state.revisions[key] = 0
      }
      state.lruOrder = [key, ...state.lruOrder.filter((entryKey) => entryKey !== key)]
    },
    /** 刷新当前页签：revision 递增；缓存不存在时按「创建后递增」处理并进入 LRU 队首 */
    cacheRevisionBumped(state, action: PayloadAction<{ key: string }>) {
      const { key } = action.payload
      const current = state.revisions[key] ?? 0
      state.revisions[key] = current + 1
      if (!state.lruOrder.includes(key)) {
        state.lruOrder.unshift(key)
      }
    },
    /** 页签关闭/缓存淘汰：移除对应 revision 与 LRU 记录 */
    cacheEntriesRemoved(state, action: PayloadAction<{ keys: string[] }>) {
      const removing = new Set(action.payload.keys)
      for (const key of removing) {
        delete state.revisions[key]
      }
      state.lruOrder = state.lruOrder.filter((entryKey) => !removing.has(entryKey))
    },
    /** 登出/会话清理：销毁全部页面缓存 */
    pageCacheCleared(state) {
      state.revisions = {}
      state.lruOrder = []
    },
  },
})

export const { cacheEntryTouched, cacheRevisionBumped, cacheEntriesRemoved, pageCacheCleared } =
  pageCacheSlice.actions
