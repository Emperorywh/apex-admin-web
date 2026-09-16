/**
 * 认证状态：唯一身份快照（旧协议模型）+ 会话纪元。
 *
 * - identity 为唯一会话/权限源（SPEC §6.2、D06），不并存第二套身份状态；
 * - epoch 会话纪元：登录/恢复成功与失效都递增，请求发起方捕获纪元、
 *   响应返回时比对，切账号/重登后旧会话迟到响应据此丢弃，不写入新会话；
 * - 持久化仅 identity：刷新后先以缓存快照渲染，再由 detail 重新核对
 *   （SPEC §6.2：恢复时重新核对权限/身份，不只相信缓存用户对象）；
 *   token 不进 Redux，由 identity.storage + setLegacyToken 管理。
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { IdentitySnapshot } from '@/types/auth/auth.types'

interface AuthState {
  /** 当前身份；null = 未登录（含登出、认证失效、恢复失败） */
  identity: IdentitySnapshot | null
  /** 会话纪元：每次 identityReady / sessionExpired 递增 */
  epoch: number
  /** 启动恢复流程是否已出结论（含"无会话"），守卫与界面据此判定而非猜测 */
  restored: boolean
  /**
   * 软件授权缺失挂起（1001000 事件置位）：身份仍有效，
   * 由 T007/T018 接管路由与恢复编排，本层只记录状态。
   */
  authorizationRequired: boolean
}

const initialState: AuthState = {
  identity: null,
  epoch: 0,
  restored: false,
  authorizationRequired: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * 登录成功或恢复完成：写入唯一快照并推进纪元。
     * 同名载荷携带有意覆盖语义（新登录覆盖旧快照），不提供局部合并。
     */
    identityReady(state, action: PayloadAction<IdentitySnapshot>) {
      state.identity = action.payload
      state.epoch += 1
      state.restored = true
      state.authorizationRequired = false
    },
    /**
     * 刷新恢复的详情核查结果：仅当纪元仍匹配时替换快照。
     * 切账号/重登（纪元已推进）后到达的迟到核查在此被隔离。
     */
    identityVerified(state, action: PayloadAction<{ epoch: number; identity: IdentitySnapshot }>) {
      if (state.epoch !== action.payload.epoch) return
      state.identity = action.payload.identity
    },
    /** 启动恢复流程结束且无会话可恢复（守卫据此放行登录页判定） */
    restoreFinishedWithoutSession(state) {
      state.restored = true
    },
    /**
     * 会话失效（登出成功 / 1000000）：立即清空身份并推进纪元（D26），
     * 迟到的写入回执/查询响应一律凭纪元丢弃；不恢复草稿、不自动续传。
     */
    sessionExpired(state) {
      state.identity = null
      state.epoch += 1
      state.restored = true
      state.authorizationRequired = false
    },
    /** 软件授权缺失事件（1001000）：身份保留，仅置位挂起标记 */
    softwareAuthorizationRequired(state) {
      state.authorizationRequired = true
    },
  },
})

export const {
  identityReady,
  identityVerified,
  restoreFinishedWithoutSession,
  sessionExpired,
  softwareAuthorizationRequired,
} = authSlice.actions
export default authSlice.reducer
