import { describe, expect, it } from 'vitest'
import type { TabItem, TabLocationSnapshot } from '@/store/slices/tabs.slice'
import {
  initialTabsState,
  tabActivated,
  tabOpened,
  tabSnapshotUpdated,
  tabsCleared,
  tabsRemoved,
  tabsReordered,
  tabsSlice,
} from '@/store/slices/tabs.slice'

const { reducer } = tabsSlice

function snapshot(pathname: string, search = '', hash = ''): TabLocationSnapshot {
  return { pathname, search, hash, key: `${pathname}${search}`, state: null }
}

const dashboard: TabItem = { key: '/dashboard', title: 'Dashboard', affix: true, location: snapshot('/dashboard') }
const userList: TabItem = { key: '/system/user', title: '用户管理', affix: false, location: snapshot('/system/user') }
const userDetail1: TabItem = {
  key: '/system/user?id=1',
  title: '用户管理',
  affix: false,
  location: snapshot('/system/user', '?id=1'),
}

describe('tabs.slice', () => {
  it('初始状态为空页签列表、无激活 key', () => {
    expect(initialTabsState).toEqual({ items: [], activeKey: null })
  })

  it('tabOpened 新 key 追加到末尾并激活', () => {
    const state = reducer(reducer(initialTabsState, tabOpened({ tab: dashboard })), tabOpened({ tab: userList }))
    expect(state.items.map((tab) => tab.key)).toEqual(['/dashboard', '/system/user'])
    expect(state.activeKey).toBe('/system/user')
  })

  it('tabOpened 同 key 导航替换快照并激活，保持原位置、不产生第二个实例（规格 §4.5）', () => {
    const opened = reducer(
      reducer(initialTabsState, tabOpened({ tab: dashboard })),
      tabOpened({ tab: userDetail1 }),
    )
    const revisited = reducer(
      opened,
      tabOpened({ tab: { ...userDetail1, location: snapshot('/system/user', '?id=1', '#anchor') } }),
    )
    expect(revisited.items).toHaveLength(2)
    expect(revisited.items[1].location.hash).toBe('#anchor')
    expect(revisited.items.map((tab) => tab.key)).toEqual(['/dashboard', '/system/user?id=1'])
    expect(revisited.activeKey).toBe('/system/user?id=1')
  })

  it('tabSnapshotUpdated 只更新既有页签快照（hash 变化复用页签），key 不存在时忽略', () => {
    const opened = reducer(initialTabsState, tabOpened({ tab: userList }))
    const updated = reducer(opened, tabSnapshotUpdated({ key: '/system/user', location: snapshot('/system/user', '', '#top') }))
    expect(updated.items[0].location.hash).toBe('#top')
    expect(updated.activeKey).toBe('/system/user')

    const untouched = reducer(updated, tabSnapshotUpdated({ key: '/missing', location: snapshot('/missing') }))
    expect(untouched.items).toHaveLength(1)
    expect(untouched.items[0].location.hash).toBe('#top')
  })

  it('tabActivated 激活存在的 key，忽略不存在的 key', () => {
    const opened = reducer(reducer(initialTabsState, tabOpened({ tab: dashboard })), tabOpened({ tab: userList }))
    const activated = reducer(opened, tabActivated({ key: '/dashboard' }))
    expect(activated.activeKey).toBe('/dashboard')

    const ignored = reducer(activated, tabActivated({ key: '/missing' }))
    expect(ignored.activeKey).toBe('/dashboard')
  })

  it('tabsRemoved 批量移除普通页签且 affix 永不移除（关闭其他/右侧/全部共用原语）', () => {
    const opened = [dashboard, userList, userDetail1].reduce(
      (state, tab) => reducer(state, tabOpened({ tab })),
      initialTabsState,
    )
    const closed = reducer(opened, tabsRemoved({ keys: ['/system/user', '/system/user?id=1', '/dashboard'] }))
    expect(closed.items.map((tab) => tab.key)).toEqual(['/dashboard'])
    // 激活页签被移除后 activeKey 置 null，后继激活顺序由调用方按「右→左→Dashboard」决定
    expect(closed.activeKey).toBeNull()
  })

  it('tabsRemoved 移除非激活页签时保留 activeKey', () => {
    const opened = [dashboard, userList, userDetail1].reduce(
      (state, tab) => reducer(state, tabOpened({ tab })),
      initialTabsState,
    )
    const closed = reducer(opened, tabsRemoved({ keys: ['/system/user'] }))
    expect(closed.items.map((tab) => tab.key)).toEqual(['/dashboard', '/system/user?id=1'])
    expect(closed.activeKey).toBe('/system/user?id=1')
  })

  it('tabsReordered 接受同 key 集合的新顺序', () => {
    const opened = [dashboard, userList, userDetail1].reduce(
      (state, tab) => reducer(state, tabOpened({ tab })),
      initialTabsState,
    )
    const reordered = reducer(opened, tabsReordered({ items: [userList, userDetail1, dashboard] }))
    expect(reordered.items.map((tab) => tab.key)).toEqual(['/system/user', '/system/user?id=1', '/dashboard'])
  })

  it('tabsReordered 对缺 key、多 key、重复 key 的非法排序整体忽略', () => {
    const opened = [dashboard, userList].reduce((state, tab) => reducer(state, tabOpened({ tab })), initialTabsState)

    const missingKey = reducer(opened, tabsReordered({ items: [dashboard] }))
    expect(missingKey.items.map((tab) => tab.key)).toEqual(['/dashboard', '/system/user'])

    const extraKey = reducer(opened, tabsReordered({ items: [dashboard, userList, userDetail1] }))
    expect(extraKey.items.map((tab) => tab.key)).toEqual(['/dashboard', '/system/user'])

    const duplicated = reducer(opened, tabsReordered({ items: [userList, userList] }))
    expect(duplicated.items.map((tab) => tab.key)).toEqual(['/dashboard', '/system/user'])
  })

  it('tabsCleared 登出销毁全部页签（含 affix）', () => {
    const opened = [dashboard, userList].reduce((state, tab) => reducer(state, tabOpened({ tab })), initialTabsState)
    const cleared = reducer(opened, tabsCleared())
    expect(cleared).toEqual({ items: [], activeKey: null })
  })
})
