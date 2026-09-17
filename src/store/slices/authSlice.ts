/**
 * 认证状态：登录会话（token/激活/用户/角色/权限）。
 *
 * 持久化策略（规格 5.2）：token 与权限一并持久化，刷新页面/重启浏览器可恢复
 * 前端会话上下文；不存密码。恢复只代表前端上下文，服务端仍逐请求鉴权，
 * 业务码 1000000 时由请求层收敛清空并跳登录。
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthSession } from '@/types/auth/auth.types'

interface AuthState {
  /** 登录令牌；请求层经会话桥接读取并以 Bearer 携带 */
  token: string | null
  /** 系统是否已激活（登录返回；P02 软件授权流程消费） */
  activated: boolean
  user: AuthSession['user'] | null
  /** 角色编码列表 */
  roles: string[]
  /** 按钮权限码列表 */
  permissions: string[]
  /** 权限树（菜单数据源，T00.4 消费） */
  permissionsTree: AuthSession['permissionsTree']
}

/** 会话为空 = 未登录（也是登出/过期/跨窗口退出的目标状态） */
export const initialAuthState: AuthState = {
  token: null,
  activated: false,
  user: null,
  roles: [],
  permissions: [],
  permissionsTree: [],
}

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    /** 登录成功：整会话落库（含 token 与权限） */
    sessionReady(_state, action: PayloadAction<AuthSession>) {
      const session = action.payload
      return {
        token: session.token,
        activated: session.activated,
        user: session.user,
        roles: session.roles,
        permissions: session.permissions,
        permissionsTree: session.permissionsTree,
      }
    },
    /**
     * 会话失效（登出、业务码 1000000 过期、其他窗口登出同步）。
     * 清空全部会话数据：令牌、用户与权限不可跨账号残留（规格 5.2）。
     */
    sessionExpired() {
      return initialAuthState
    },
  },
})

export const { sessionReady, sessionExpired } = authSlice.actions
export default authSlice.reducer
