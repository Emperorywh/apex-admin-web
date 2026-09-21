/**
 * 认证状态：当前用户。字段级持久化（user），
 * 令牌只存内存（refreshToken 在 HttpOnly Cookie）。
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthSession } from '@/types/auth/auth.types'

interface AuthState {
  user: AuthSession['user'] | null
}

const initialState: AuthState = {
  user: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** 登录或会话恢复完成 */
    sessionReady(_state, action: PayloadAction<AuthSession>) {
      return { user: action.payload.user }
    },
    /** 会话失效（登出、401 刷新失败等） */
    sessionExpired() {
      return initialState
    },
  },
})

export const { sessionReady, sessionExpired } = authSlice.actions
export default authSlice.reducer
