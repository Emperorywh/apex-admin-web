import { describe, expect, it } from 'vitest'
import {
  cacheEntriesRemoved,
  cacheEntryTouched,
  cacheRevisionBumped,
  initialPageCacheState,
  pageCacheCleared,
  pageCacheSlice,
} from '@/store/slices/pageCache.slice'

const { reducer } = pageCacheSlice

describe('pageCache.slice', () => {
  it('初始状态无缓存记录', () => {
    expect(initialPageCacheState).toEqual({ revisions: {}, lruOrder: [] })
  })

  it('cacheEntryTouched 新建缓存 revision 为 0 并置于 LRU 队首', () => {
    const state = reducer(initialPageCacheState, cacheEntryTouched({ key: '/dashboard' }))
    expect(state.revisions).toEqual({ '/dashboard': 0 })
    expect(state.lruOrder).toEqual(['/dashboard'])
  })

  it('cacheEntryTouched 重复激活把 key 移到队首且不重复、不重置 revision', () => {
    const touched = ['/a', '/b', '/c'].reduce((state, key) => reducer(state, cacheEntryTouched({ key })), initialPageCacheState)
    expect(touched.lruOrder).toEqual(['/c', '/b', '/a'])

    const bumped = reducer(touched, cacheRevisionBumped({ key: '/a' }))
    const reactivated = reducer(bumped, cacheEntryTouched({ key: '/a' }))
    expect(reactivated.lruOrder).toEqual(['/a', '/c', '/b'])
    expect(reactivated.revisions['/a']).toBe(1)
  })

  it('cacheRevisionBumped 递增 revision（刷新当前页签用新 React key 重建）', () => {
    const touched = reducer(initialPageCacheState, cacheEntryTouched({ key: '/a' }))
    const once = reducer(touched, cacheRevisionBumped({ key: '/a' }))
    const twice = reducer(once, cacheRevisionBumped({ key: '/a' }))
    expect(twice.revisions['/a']).toBe(2)
    expect(twice.lruOrder).toEqual(['/a'])
  })

  it('cacheRevisionBumped 对不存在的 key 按「创建后递增」处理并进入 LRU', () => {
    const state = reducer(initialPageCacheState, cacheRevisionBumped({ key: '/a' }))
    expect(state.revisions).toEqual({ '/a': 1 })
    expect(state.lruOrder).toEqual(['/a'])
  })

  it('cacheEntriesRemoved 同时清理 revision 与 LRU 顺序', () => {
    const touched = ['/a', '/b', '/c'].reduce((state, key) => reducer(state, cacheEntryTouched({ key })), initialPageCacheState)
    const removed = reducer(touched, cacheEntriesRemoved({ keys: ['/b', '/c'] }))
    expect(removed.revisions).toEqual({ '/a': 0 })
    expect(removed.lruOrder).toEqual(['/a'])
  })

  it('pageCacheCleared 登出销毁全部缓存', () => {
    const touched = ['/a', '/b'].reduce((state, key) => reducer(state, cacheEntryTouched({ key })), initialPageCacheState)
    expect(reducer(touched, pageCacheCleared())).toEqual(initialPageCacheState)
  })
})
