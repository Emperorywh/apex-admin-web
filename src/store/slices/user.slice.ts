/**
 * 用户会话切片（规格 §6.1/§8.1）。
 * 双 token、sessionSource 与 sessionEpoch 是认证信息的单一数据源；
 * 用户资料、roles、permCodes、permissionVersion 每次整页启动经 /auth/profile 重新拉取，不持久化。
 * 本切片只定形数据操作，登录/登出/刷新等跨切片编排由认证任务以 thunk 实现。
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { type SessionSource } from '@/constants/auth/auth.constants'
import type { User } from '@/types/system/user/user.types'

/** 用户切片状态：认证凭据与权限快照（规格 §8.1 表） */
export interface UserState {
  /** 访问令牌：与 refreshToken、sessionSource 一起随 persist 白名单持久化 */
  accessToken: string | null
  /** 刷新令牌 */
  refreshToken: string | null
  /** 会话来源：real 走真实后端，demo 走演示 adapter；在任何请求 adapter 选择之前完成恢复 */
  sessionSource: SessionSource | null
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
  sessionSource: null,
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
    /** 登录/刷新成功后保存双 token 与会话来源；epoch 递增由 sessionEpochIncremented 显式触发 */
    tokensStored(
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string; sessionSource: SessionSource }>,
    ) {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.sessionSource = action.payload.sessionSource
    },
    /**
     * 单独切换会话来源：demo fallback 登录在网络级失败后切换并重放时使用（规格 §13.2）。
     * null 表示恢复到未登录的无来源状态——重放自身失败时恢复切换前取值，未登录状态不得残留 demo 标记
     */
    sessionSourceSet(state, action: PayloadAction<{ sessionSource: SessionSource | null }>) {
      state.sessionSource = action.payload.sessionSource
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
      state.sessionSource = null
      state.user = null
      state.roles = []
      state.permCodes = []
      state.permissionVersion = null
    },
  },
})

export const { tokensStored, sessionSourceSet, sessionEpochIncremented, profileLoaded, authCleared } =
  userSlice.actions
