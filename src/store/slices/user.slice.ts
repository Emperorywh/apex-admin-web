/**
 * 用户会话切片（规格 §6.1/§8.1）。
 * 双 token 与 sessionEpoch 是认证信息的单一数据源；
 * 用户资料、roles、permCodes、permissionVersion 每次整页启动经 /auth/profile 重新拉取，不持久化。
 * 本切片只定形数据操作，登录/登出/刷新等跨切片编排由认证任务以 thunk 实现。
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '@/types/system/user/user.types'

/** 用户切片状态：认证凭据与权限快照（规格 §8.1 表） */
export interface UserState {
  /** 访问令牌：与 refreshToken 一起随 persist 白名单持久化 */
  accessToken: string | null
  /** 刷新令牌 */
  refreshToken: string | null
  /** 会话纪元：登录、登出、切换账号时递增，用于阻止旧异步任务回写新会话；不持久化 */
  sessionEpoch: number
  /** 当前登录用户信息：每次整页启动重新拉取，不从上次会话复用 */
  user: User | null
  /** 角色 code 列表（profile.roleCodes），不持久化 */
  roles: string[]
  /** 权限码集合（profile.permCodes），不持久化 */
  permCodes: string[]
  /** 权限快照版本：只用于判断权限集合是否变化，不替代权限码校验；不持久化 */
  permissionVersion: string | null
}

export const initialUserState: UserState = {
  accessToken: null,
  refreshToken: null,
  sessionEpoch: 0,
  user: null,
  roles: [],
  permCodes: [],
  permissionVersion: null,
}

export const userSlice = createSlice({
  name: 'user',
  initialState: initialUserState,
  reducers: {
    /** 登录/刷新成功后保存双 token；epoch 递增由 sessionEpochIncremented 显式触发 */
    tokensStored(state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
    },
    /** 会话纪元递增：登录、登出、切换账号前调用，使旧异步任务的纪元比对失效 */
    sessionEpochIncremented(state) {
      state.sessionEpoch += 1
    },
    /** profile 拉取成功：写入用户信息、角色、权限码与权限版本，不落 token */
    profileLoaded(
      state,
      action: PayloadAction<{
        user: User
        roles: string[]
        permCodes: string[]
        permissionVersion: string
      }>,
    ) {
      state.user = action.payload.user
      state.roles = action.payload.roles
      state.permCodes = action.payload.permCodes
      state.permissionVersion = action.payload.permissionVersion
    },
    /**
     * 清空全部认证与权限快照字段（登出本地清理、会话不满足基本访问条件、持久化恢复降级）。
     * sessionEpoch 不重置：保持单调递增，清理前发出的旧请求永远无法通过纪元比对（规格 §6.1）。
     */
    authCleared(state) {
      state.accessToken = null
      state.refreshToken = null
      state.user = null
      state.roles = []
      state.permCodes = []
      state.permissionVersion = null
    },
  },
})

export const { tokensStored, sessionEpochIncremented, profileLoaded, authCleared } = userSlice.actions
