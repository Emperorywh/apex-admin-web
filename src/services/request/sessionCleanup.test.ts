/**
 * 会话清理与登录跳转单元测试（规格 §6.2/§17.21）：
 * 清理动作序列、经校验的登录目标构造与导航回调注册。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tabOpened } from '@/store/slices/tabs.slice'
import { cacheEntryTouched } from '@/store/slices/pageCache.slice'
import { createRequestTestStore, seedSession } from '@/test/requestTestHelpers'
import { buildLoginTarget, performSessionCleanup, readCurrentAddress, registerSessionExpiredNavigator, runSessionCleanup } from './sessionCleanup'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

describe('buildLoginTarget（规格 §17.21：跳登录带经校验的当前地址）', () => {
  it('合法站内地址附带 redirect 参数（URLSearchParams#set 编码）', () => {
    const target = buildLoginTarget('/system/user?id=1')
    expect(target.startsWith('/login?redirect=')).toBe(true)
    const redirect = new URL(target, 'http://localhost').searchParams.get('redirect')
    expect(redirect).toBe('/system/user?id=1')
  })

  it('外站、协议相对、反斜杠、控制字符与登录页自身不带 redirect', () => {
    expect(buildLoginTarget('https://evil.example')).toBe('/login')
    expect(buildLoginTarget('//evil.example')).toBe('/login')
    expect(buildLoginTarget('/\\evil.example')).toBe('/login')
    expect(buildLoginTarget('/foo\nbar')).toBe('/login')
    expect(buildLoginTarget('/login')).toBe('/login')
    expect(buildLoginTarget('/login?redirect=%2Fdashboard')).toBe('/login')
  })
})

describe('performSessionCleanup / runSessionCleanup（规格 §6.2）', () => {
  it('动作序列：先递增 epoch 阻止旧异步任务回写，再清认证、页签与页面缓存', () => {
    const { store, countActions } = createRequestTestStore()
    seedSession(store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    store.dispatch(tabOpened({ tab: { key: '/dashboard', title: 'Dashboard', affix: true, location: { pathname: '/dashboard', search: '', hash: '', key: 'k', state: null } } }))
    store.dispatch(cacheEntryTouched({ key: '/dashboard' }))

    performSessionCleanup(store)

    expect(store.getState().user.sessionEpoch).toBe(1)
    expect(store.getState().user.accessToken).toBeNull()
    expect(store.getState().tabs.items).toEqual([])
    expect(store.getState().pageCache.revisions).toEqual({})
    expect(countActions('user/sessionEpochIncremented')).toBe(1)
    expect(countActions('user/authCleared')).toBe(1)
    expect(countActions('tabs/tabsCleared')).toBe(1)
    expect(countActions('pageCache/pageCacheCleared')).toBe(1)
  })

  it('runSessionCleanup 经注册的导航回调跳登录；未注册时只清理不跳转', () => {
    const { store } = createRequestTestStore()
    seedSession(store, { accessToken: 'at-1', refreshToken: 'rt-1' })
    window.history.pushState({}, '', '/profile?tab=1')
    const navigator = vi.fn()
    registerSessionExpiredNavigator(navigator)
    runSessionCleanup(store)
    expect(navigator).toHaveBeenCalledTimes(1)
    expect(new URL(navigator.mock.calls[0][0], 'http://localhost').searchParams.get('redirect')).toBe('/profile?tab=1')
    expect(readCurrentAddress()).toBe('/profile?tab=1')

    // 未注册：清理照常执行，不抛错
    registerSessionExpiredNavigator(null)
    seedSession(store, { accessToken: 'at-2', refreshToken: 'rt-2' })
    expect(() => runSessionCleanup(store)).not.toThrow()
    expect(store.getState().user.accessToken).toBeNull()
    expect(navigator).toHaveBeenCalledTimes(1)
  })
})
