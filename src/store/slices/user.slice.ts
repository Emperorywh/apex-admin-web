/**
 * 用户会话切片（规格 §6.1/§8.1，v1.14）。
 * accessToken 与 sessionEpoch 是前端认证状态的单一数据源；refreshToken 由后端经
 * __Host-apex_refresh HttpOnly Cookie 承载，前端不可读、不进本切片。
 * 用户资料、roles、permCodes 每次整页启动经 profile 聚合重新拉取，不持久化。
 * 本切片只定形数据操作，登录/登出/刷新等跨切片编排由认证任务以 thunk 实现。
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '@/types/system/user/user.types'

/** 用户切片状态：认证凭据与权限快照（规格 §8.1 表） */
export interface UserState {
  /** 访问令牌：随 persist 白名单持久化（refreshToken 为 HttpOnly Cookie，不落前端存储） */
  accessToken: string | null
  /** 会话纪元：登录、登出、切换账号时递增，用于阻止旧异步任务回写新会话；不持久化 */
  sessionEpoch: number
  /** 当前登录用户信息：每次整页启动重新拉取，不从上次会话复用 */
  user: User | null
  /** 角色 code 列表（profile.roleCodes，当前后端无自助查询接口，固定空数组），不持久化 */
  roles: string[]
  /** 权限码集合（profile.permCodes），不持久化 */
  permCodes: string[]
  /**
   * 后端菜单树 path 白名单（profile.menuPaths，GET /me/menus 扁平化，规格 §4.4 v1.15），
   * 菜单叶子展示需命中该白名单；null 表示不受菜单树限制（admin 超管），不持久化
   */
  menuPaths: string[] | null
}

export const initialUserState: UserState = {
  accessToken: null,
  sessionEpoch: 0,
  user: null,
  roles: [],
  permCodes: [],
  menuPaths: [],
}

export const userSlice = createSlice({
  name: 'user',
  initialState: initialUserState,
  reducers: {
    /** 登录/刷新成功后保存 accessToken；epoch 递增由 sessionEpochIncremented 显式触发 */
    accessTokenStored(state, action: PayloadAction<{ accessToken: string }>) {
      state.accessToken = action.payload.accessToken
    },
    /** 会话纪元递增：登录、登出、切换账号前调用，使旧异步任务的纪元比对失效 */
    sessionEpochIncremented(state) {
      state.sessionEpoch += 1
    },
    /** profile 拉取成功：写入用户信息、角色、权限码与菜单路径白名单，不落 token */
    profileLoaded(
      state,
      action: PayloadAction<{
        user: User
        roles: string[]
        permCodes: string[]
        menuPaths: string[] | null
      }>,
    ) {
      state.user = action.payload.user
      state.roles = action.payload.roles
      state.permCodes = action.payload.permCodes
      state.menuPaths = action.payload.menuPaths
    },
    /**
     * 清空全部认证与权限快照字段（登出本地清理、会话不满足基本访问条件、持久化恢复降级）。
     * sessionEpoch 不重置：保持单调递增，清理前发出的旧请求永远无法通过纪元比对（规格 §6.1）。
     */
    authCleared(state) {
      state.accessToken = null
      state.user = null
      state.roles = []
      state.permCodes = []
      // 收敛为最严格空白名单（fail-closed）；null 仅由 admin 的 profile 聚合重新建立
      state.menuPaths = []
    },
  },
})

export const { accessTokenStored, sessionEpochIncremented, profileLoaded, authCleared } = userSlice.actions
