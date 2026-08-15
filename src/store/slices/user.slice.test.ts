import { describe, expect, it } from 'vitest'
import type { User } from '@/types/system/user/user.types'
import {
  authCleared,
  initialUserState,
  profileLoaded,
  sessionEpochIncremented,
  sessionSourceSet,
  tokensStored,
  userSlice,
} from '@/store/slices/user.slice'

const userFixture: User = {
  id: 'u-1',
  username: 'admin',
  displayName: '管理员',
  email: 'admin@example.com',
  status: 'enabled',
  roleIds: ['r-1'],
  createdAt: '2026-08-15T00:00:00+08:00',
  updatedAt: '2026-08-15T00:00:00+08:00',
}

function reducer(state = initialUserState, action: ReturnType<(typeof userSlice.actions)[keyof typeof userSlice.actions]>) {
  return userSlice.reducer(state, action)
}

describe('user.slice', () => {
  it('初始状态：无 token、无会话、纪元为 0', () => {
    expect(initialUserState).toEqual({
      accessToken: null,
      refreshToken: null,
      sessionSource: null,
      sessionEpoch: 0,
      user: null,
      roles: [],
      permCodes: [],
      permissionVersion: null,
    })
  })

  it('tokensStored 保存双 token 与会话来源，不触碰其他字段', () => {
    const state = reducer(
      initialUserState,
      tokensStored({ accessToken: 'at-1', refreshToken: 'rt-1', sessionSource: 'demo' }),
    )
    expect(state.accessToken).toBe('at-1')
    expect(state.refreshToken).toBe('rt-1')
    expect(state.sessionSource).toBe('demo')
    expect(state.sessionEpoch).toBe(0)
  })

  it('sessionSourceSet 单独切换会话来源（demo fallback 重放场景）', () => {
    const state = reducer(initialUserState, sessionSourceSet({ sessionSource: 'demo' }))
    expect(state.sessionSource).toBe('demo')
    expect(state.accessToken).toBeNull()
  })

  it('sessionEpochIncremented 递增纪元', () => {
    const once = reducer(initialUserState, sessionEpochIncremented())
    const twice = reducer(once, sessionEpochIncremented())
    expect(once.sessionEpoch).toBe(1)
    expect(twice.sessionEpoch).toBe(2)
  })

  it('profileLoaded 写入用户信息、角色、权限码与权限版本，不落 token', () => {
    const state = reducer(
      initialUserState,
      profileLoaded({
        user: userFixture,
        roles: ['admin'],
        permCodes: ['dashboard:view', 'system:user:list'],
        permissionVersion: 'v1',
      }),
    )
    expect(state.user).toEqual(userFixture)
    expect(state.roles).toEqual(['admin'])
    expect(state.permCodes).toEqual(['dashboard:view', 'system:user:list'])
    expect(state.permissionVersion).toBe('v1')
    expect(state.accessToken).toBeNull()
  })

  it('authCleared 清空认证与权限快照但保留 sessionEpoch（纪元单调，旧请求无法通过比对）', () => {
    const loggedIn = reducer(
      reducer(reducer(initialUserState, tokensStored({ accessToken: 'at-1', refreshToken: 'rt-1', sessionSource: 'real' })), sessionEpochIncremented()),
      profileLoaded({ user: userFixture, roles: ['admin'], permCodes: ['dashboard:view'], permissionVersion: 'v1' }),
    )
    const cleared = reducer(loggedIn, authCleared())
    expect(cleared.accessToken).toBeNull()
    expect(cleared.refreshToken).toBeNull()
    expect(cleared.sessionSource).toBeNull()
    expect(cleared.user).toBeNull()
    expect(cleared.roles).toEqual([])
    expect(cleared.permCodes).toEqual([])
    expect(cleared.permissionVersion).toBeNull()
    expect(cleared.sessionEpoch).toBe(1)
  })
})
