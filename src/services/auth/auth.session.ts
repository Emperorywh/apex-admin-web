/**
 * 认证会话编排（规格 §4.3/§6.2，v1.14）：
 * - ensureProfile 启动单飞：等待 rehydratedPromise 后复用单飞，一次整页启动最多一个 profile 聚合请求；
 * - 登录状态机：login → 保存 accessToken + 递增 epoch（refreshToken 经 Set-Cookie 落地）→
 *   profile 聚合 → 路由无关导航意图；
 * - 登出状态机：先递增 epoch，POST /auth/logout（认证请求，Cookie 由浏览器携带），
 *   finally 本地清理（settings 保留）；
 * - 会话规则：profile 聚合拉取成功即视为会话有效（v1.14 移除 dashboard:view 门槛）；
 *   网络失败原样上抛，不误清 token（路由错误页提供重试与退出登录）；
 *   401 由请求层刷新状态机处理（AUTH.UNAUTHENTICATED → Cookie 刷新 → 失败清理回登录）。
 *
 * 运行态编排在 createAuthSessionRuntime 创建的实例内隔离（与 createRequestRuntime 同构），
 * 默认单例经 getDefaultAuthSessionRuntime 懒创建；路由任务消费 authNavigation/sessionCleanup
 * 两个导航通道完成最终跳转，本模块不读取路由、不校验回跳。
 */
import type { UnknownAction } from '@reduxjs/toolkit'
import { ROUTE_FALLBACK_PATH, ROUTE_PATHS } from '@/constants/route.constants'
import { createApiError, createCanceledApiError } from '@/services/request/envelope'
import type { RequestStore } from '@/services/request/request.types'
import { performSessionCleanup } from '@/services/request/sessionCleanup'
import { getDefaultAppStore } from '@/store/store'
import { accessTokenStored, profileLoaded, sessionEpochIncremented } from '@/store/slices/user.slice'
import type { ProfileData } from '@/types/auth/auth.types'
import { getProfile as getProfileRequest, login as loginRequest, logout as logoutRequest } from './auth.service'
import type {
  GetProfileResponseDto,
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
} from './auth.service.types'
import { emitAuthNavigation } from './authNavigation'

/** 会话编排消费的认证接口子集；测试注入桩实现以隔离网络 */
export interface AuthSessionApi {
  login(dto: LoginRequestDto): Promise<LoginResponseDto>
  logout(): Promise<LogoutResponseDto>
  getProfile(): Promise<GetProfileResponseDto>
}

export interface CreateAuthSessionOptions {
  store: RequestStore
  /** 启动闸门 Promise（规格 §4.3）：ensureProfile 第一层等待其完成后才读取 token */
  rehydrated: Promise<void>
  /** 认证接口实现；缺省使用 auth.service 的全局实现（绑定默认请求运行时） */
  api?: AuthSessionApi
}

export interface AuthSessionRuntime {
  /**
   * 启动 profile 单飞（规格 §4.3）：await rehydratedPromise 后读取 token；
   * 无 token 时返回 null（不发起请求），并发调用共享同一 Promise；
   * 成功结果在本次整页启动内缓存（最多一个 profile 请求），失败后清除以便重试。
   */
  ensureProfile(): Promise<ProfileData | null>
  /** 登录状态机（规格 §6.2）：成功后产出 post-login 导航意图（默认 /dashboard） */
  loginWithCredentials(dto: LoginRequestDto): Promise<void>
  /** 登出状态机（规格 §6.2）：finally 本地清理并产出 post-logout 导航意图 */
  logoutSession(): Promise<void>
  /** 清除 profile 单飞缓存：登录/登出内部调用；测试用于隔离启动态 */
  resetProfileSingleFlight(): void
}

export function createAuthSessionRuntime(options: CreateAuthSessionOptions): AuthSessionRuntime {
  const { store, rehydrated } = options
  const api: AuthSessionApi = options.api ?? {
    login: loginRequest,
    logout: logoutRequest,
    getProfile: getProfileRequest,
  }

  let profileFlight: Promise<ProfileData | null> | null = null

  function resetProfileSingleFlight(): void {
    profileFlight = null
  }

  /**
   * profile 聚合拉取核心：请求、epoch 防陈旧回写与派生数据写入。
   * 网络失败原样上抛（路由错误页可重试）；401 由请求层刷新状态机处理，
   * 刷新失败的会话清理已在该路径完成（规格 §6.2）。
   */
  async function loadProfileCore(): Promise<ProfileData> {
    const epochAtStart = store.getState().user.sessionEpoch
    const profile = await api.getProfile()
    // 等待期间会话已切换/登出：丢弃结果，不回写新会话（规格 §6.1）
    if (store.getState().user.sessionEpoch !== epochAtStart) {
      throw createCanceledApiError()
    }
    store.dispatch(
      profileLoaded({
        user: profile.user,
        roles: profile.roleCodes,
        permCodes: profile.permCodes,
        menuPaths: profile.menuPaths,
      }) as UnknownAction,
    )
    return profile
  }

  /** 启动闸门后的实际拉取：先等待 rehydration 再读 token；无 token 不发请求 */
  async function runStartupProfileFetch(): Promise<ProfileData | null> {
    await rehydrated
    if (store.getState().user.accessToken === null) {
      return null
    }
    return loadProfileCore()
  }

  function ensureProfile(): Promise<ProfileData | null> {
    profileFlight ??= runStartupProfileFetch().catch((error: unknown) => {
      // 失败后清除单飞缓存：路由错误页的「重试」可再次发起（规格 §4.3/§6.2）
      profileFlight = null
      throw error
    })
    return profileFlight
  }

  async function loginWithCredentials(dto: LoginRequestDto): Promise<void> {
    const result = await api.login(dto)
    // 会话切换：先递增 epoch 使旧会话在途任务失效，再保存 accessToken（规格 §6.1/§6.2）；
    // refreshToken 经 Set-Cookie 落地，前端无感知
    store.dispatch(sessionEpochIncremented() as UnknownAction)
    store.dispatch(accessTokenStored({ accessToken: result.accessToken }) as UnknownAction)
    resetProfileSingleFlight()
    const profile = await ensureProfile()
    if (profile === null) {
      // 防御分支：token 已保存，ensureProfile 不应判定为未登录；出现即状态机被破坏
      throw createApiError({ message: '登录后会话状态异常：token 未就位' })
    }
    // 登录成功产出路由无关导航意图，默认落点为 /dashboard 常量；
    // 合法回跳的解码与五步同源校验由路由任务的 redirect.ts/守卫唯一承担（规格 §4.3）
    emitAuthNavigation({ kind: 'post-login', target: ROUTE_FALLBACK_PATH })
  }

  async function logoutSession(): Promise<void> {
    const hasAccessToken = store.getState().user.accessToken !== null
    // 先递增 epoch：阻止旧异步任务回写新会话与在途请求重放（规格 §6.2）
    store.dispatch(sessionEpochIncremented() as UnknownAction)
    try {
      // 无 accessToken 时跳过网络调用，仅做本地清理；Cookie 由浏览器自动携带、
      // 后端吊销当前会话并删除 Cookie（规格 §6.2）
      if (hasAccessToken) {
        await api.logout()
      }
    } finally {
      // 无论成功、失败或超时：销毁页签与页面缓存、清空认证；settings 不在清理范围（规格 §6.2）
      performSessionCleanup(store)
      resetProfileSingleFlight()
      // 主动登出回登录页，不携带 redirect 参数（用户显式离开，不回跳原地址）
      emitAuthNavigation({ kind: 'post-logout', target: ROUTE_PATHS.LOGIN })
    }
  }

  return {
    ensureProfile,
    loginWithCredentials,
    logoutSession,
    resetProfileSingleFlight,
  }
}

let defaultAuthSession: AuthSessionRuntime | null = null

/** 页面级默认认证会话运行时：绑定默认 store 与其 rehydratedPromise，懒创建单例 */
export function getDefaultAuthSessionRuntime(): AuthSessionRuntime {
  defaultAuthSession ??= (() => {
    const appStore = getDefaultAppStore()
    return createAuthSessionRuntime({ store: appStore.store, rehydrated: appStore.rehydratedPromise })
  })()
  return defaultAuthSession
}
