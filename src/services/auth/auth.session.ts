/**
 * 认证会话编排（规格 §4.3/§5.4/§6.2）：
 * - ensureProfile 启动单飞：等待 rehydratedPromise 后复用单飞，一次整页启动最多一个 profile 请求；
 * - 登录状态机：login → 保存双 token/sessionSource + 递增 epoch → profile → 路由无关导航意图；
 * - 登出状态机：先递增 epoch、保存 refreshToken，POST /auth/logout，finally 本地清理（settings 保留）；
 * - 会话规则：profile 返回 AUTH_FORBIDDEN 或缺少 dashboard:view → 清理会话并回登录；
 *   网络失败原样上抛，不误清 token（路由错误页提供重试与退出登录）；
 * - 权限变更闭环：403 AUTH_PERMISSION_CHANGED 单飞完成后比较 permissionVersion、
 *   重算权限派生数据并关闭失权普通页签与缓存，当前页失权产出 replace('/403') 意图。
 *
 * 运行态编排在 createAuthSessionRuntime 创建的实例内隔离（与 createRequestRuntime 同构），
 * 默认单例经 getDefaultAuthSessionRuntime 懒创建；路由任务消费 authNavigation/sessionCleanup
 * 两个导航通道完成最终跳转，本模块不读取路由、不校验回跳。
 */
import type { UnknownAction } from '@reduxjs/toolkit'
import { SESSION_SOURCES } from '@/constants/auth/auth.constants'
import { PERMISSIONS } from '@/constants/permission.constants'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { ROUTE_FALLBACK_PATH, ROUTE_PATHS } from '@/constants/route.constants'
import { createApiError, createCanceledApiError, isApiError } from '@/services/request/envelope'
import { registerProfileRefreshFetcher } from '@/services/request/profileRefresh'
import type { RequestStore } from '@/services/request/request.types'
import { performSessionCleanup, runSessionCleanup } from '@/services/request/sessionCleanup'
import { getDefaultAppStore } from '@/store/store'
import { hasPermissionCode } from '@/store/permissions'
import { cacheEntriesRemoved } from '@/store/slices/pageCache.slice'
import { tabsRemoved } from '@/store/slices/tabs.slice'
import { profileLoaded, sessionEpochIncremented, tokensStored } from '@/store/slices/user.slice'
import type { ProfileData } from '@/types/auth/auth.types'
import { getProfile as getProfileRequest, login as loginRequest, logout as logoutRequest } from './auth.service'
import type {
  GetProfileResponseDto,
  LoginRequestDto,
  LoginResponseDto,
  LogoutRequestDto,
} from './auth.service.types'
import { emitAuthNavigation } from './authNavigation'

/** 会话编排消费的认证接口子集；测试注入桩实现以隔离网络 */
export interface AuthSessionApi {
  login(dto: LoginRequestDto): Promise<LoginResponseDto>
  logout(dto: LogoutRequestDto): Promise<null>
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
  /** 权限变更 profile 刷新（规格 §5.4）：请求层 403 AUTH_PERMISSION_CHANGED 单飞的执行器 */
  refreshProfileAfterPermissionChange(): Promise<void>
}

/** 页签路径 → 从受保护根到叶子的全部所需权限码（规格 §4.4 AND 语义） */
export type TabPermissionResolver = (pathname: string) => readonly string[]

let tabPermissionResolver: TabPermissionResolver | null = null

/**
 * 注册/清空页签权限解析器：路由任务是路由定义的唯一所有者，在启动时把
 * pathname → 权限码全集的映射注册进来；未注册时权限收窄无法判定路径归属，不关闭任何页签。
 */
export function registerTabPermissionResolver(resolver: TabPermissionResolver | null): void {
  tabPermissionResolver = resolver
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
   * profile 拉取核心：请求、epoch 防陈旧回写、会话资格校验与派生数据写入。
   * 网络失败原样上抛（路由错误页可重试）；会话不满足条件时清理会话并以 AUTH_FORBIDDEN 结束。
   */
  async function loadProfileCore(): Promise<ProfileData> {
    const epochAtStart = store.getState().user.sessionEpoch
    let profile: ProfileData
    try {
      profile = await api.getProfile()
    } catch (error) {
      // /auth/profile 自身返回 AUTH_FORBIDDEN：会话不满足模板基本访问条件，清理会话并回登录（规格 §6.2）
      if (isApiError(error) && error.httpStatus === 403 && error.errorCode === API_ERROR_CODES.AUTH_FORBIDDEN) {
        runSessionCleanup(store)
      }
      throw error
    }
    // 等待期间会话已切换/登出：丢弃结果，不回写新会话（规格 §6.1）
    if (store.getState().user.sessionEpoch !== epochAtStart) {
      throw createCanceledApiError()
    }
    // 成功数据使 hasAuth('dashboard:view') 为 false（admin 按 * 通配）→ 清理会话并回登录（规格 §6.2/§4.2）
    if (!hasPermissionCode(profile.permCodes, profile.roleCodes, PERMISSIONS.DASHBOARD_VIEW)) {
      runSessionCleanup(store)
      throw createApiError({
        httpStatus: 403,
        errorCode: API_ERROR_CODES.AUTH_FORBIDDEN,
        message: '会话不满足模板基本访问条件（缺少 dashboard:view）',
      })
    }
    store.dispatch(
      profileLoaded({
        user: profile.user,
        roles: profile.roleCodes,
        permCodes: profile.permCodes,
        permissionVersion: profile.permissionVersion,
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

  /** 权限收窄：关闭不再可访问的普通页签与缓存；当前页失权时产出 replace('/403') 意图（规格 §5.4） */
  function closeInaccessibleTabs(): void {
    const resolver = tabPermissionResolver
    if (!resolver) {
      return
    }
    const { user, tabs } = store.getState()
    const removedKeys: string[] = []
    let currentTabLostAccess = false
    for (const tab of tabs.items) {
      // affix 页签（Dashboard）永不移除（规格 §9.3）；其失权由会话资格校验走清理回登录路径
      if (tab.affix) {
        continue
      }
      const required = resolver(tab.location.pathname)
      const accessible = required.every((code) => hasPermissionCode(user.permCodes, user.roles, code))
      if (!accessible) {
        removedKeys.push(tab.key)
        if (tab.key === tabs.activeKey) {
          currentTabLostAccess = true
        }
      }
    }
    if (removedKeys.length > 0) {
      store.dispatch(tabsRemoved({ keys: removedKeys }) as UnknownAction)
      store.dispatch(cacheEntriesRemoved({ keys: removedKeys }) as UnknownAction)
    }
    // 当前页失权：立即产出导航意图，由路由任务 replace('/403')，不能等到下次激活（规格 §5.4）
    if (currentTabLostAccess) {
      emitAuthNavigation({ kind: 'route-forbidden', target: ROUTE_PATHS.FORBIDDEN })
    }
  }

  async function refreshProfileAfterPermissionChange(): Promise<void> {
    // 刷新前版本：与刷新结果比较，版本变化才收窄页签（规格 §5.4）
    const previousVersion = store.getState().user.permissionVersion
    const profile = await loadProfileCore()
    if (profile.permissionVersion !== previousVersion) {
      closeInaccessibleTabs()
    }
  }

  // 注册为请求层 403 AUTH_PERMISSION_CHANGED 单飞的执行器（规格 §5.4）；
  // 注册表是全局唯一入口，最后创建的运行时生效——生产只有一个默认运行时
  registerProfileRefreshFetcher(refreshProfileAfterPermissionChange)

  async function loginWithCredentials(dto: LoginRequestDto): Promise<void> {
    const result = await api.login(dto)
    // 会话切换：先递增 epoch 使旧会话在途任务失效，再保存双 token 与来源（规格 §6.1/§6.2）；
    // 来源固定 real：demo fallback 切换由演示模式任务在本流程插入（规格 §13.2）
    store.dispatch(sessionEpochIncremented() as UnknownAction)
    store.dispatch(
      tokensStored({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionSource: SESSION_SOURCES.REAL,
      }) as UnknownAction,
    )
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
    // 先保存待提交的 refreshToken；无 token 时跳过网络调用，仅做本地清理（规格 §6.2）
    const { refreshToken } = store.getState().user
    // 先递增 epoch：阻止旧异步任务回写新会话与在途请求重放（规格 §6.2）
    store.dispatch(sessionEpochIncremented() as UnknownAction)
    try {
      if (refreshToken !== null) {
        await api.logout({ refreshToken })
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
    refreshProfileAfterPermissionChange,
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
