/**
 * 认证状态：用户与权限码。字段级持久化（user/permissions），
 * 令牌只存内存（refreshToken 在 HttpOnly Cookie）。
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthSession } from '@/types/auth/auth.types'

interface AuthState {
  user: AuthSession['user'] | null
  permissions: string[]
}

const initialState: AuthState = {
  user: null,
  permissions: [],
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** 登录或会话恢复完成 */
    sessionReady(_state, action: PayloadAction<AuthSession>) {
      return { user: action.payload.user, permissions: action.payload.permissions }
    },
    /** 局部更新当前用户（如个人中心保存后） */
    userPatched(state, action: PayloadAction<Partial<AuthSession['user']>>) {
      if (state.user !== null) {
        state.user = { ...state.user, ...action.payload }
      }
    },
    /** 会话失效（登出、401 刷新失败等） */
    sessionExpired() {
      return initialState
    },
  },
})

export const { sessionReady, sessionExpired, userPatched } = authSlice.actions
export default authSlice.reducer
