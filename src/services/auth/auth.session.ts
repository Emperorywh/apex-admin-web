/**
 * 认证会话编排（纯前端模式）：
 * 本应用已改造为纯前端模式，不再发起任何 API 请求：
 * - loginWithCredentials 接受任意账号密码：写入本地 accessToken 与固定的本地管理员
 *   权限快照（admin 角色 + '*' 通配 + menuPaths null，全部权限码与菜单放行），
 *   随后产出 post-login 导航意图；
 * - ensureProfile 在持有 accessToken 时返回权限快照：快照字段不持久化，整页刷新后
 *   按确定性数据重建并写回 store，语义对齐原先的 profile 聚合；
 * - logoutSession 执行本地会话清理（认证、页签、页面缓存）并产出 post-logout 意图。
 *
 * 运行态编排在 createAuthSessionRuntime 创建的实例内隔离，默认单例经
 * getDefaultAuthSessionRuntime 懒创建；导航意图经 authNavigation 通道由路由任务消费，
 * 本模块不读取路由、不校验回跳。
 */
import { PERMISSION_WILDCARD } from '@/constants/permission.constants'
import { ROUTE_FALLBACK_PATH, ROUTE_PATHS } from '@/constants/route.constants'
import { ADMIN_ROLE_CODE } from '@/constants/system/role/role.constants'
import { pageCacheCleared } from '@/store/slices/pageCache.slice'
import { tabsCleared } from '@/store/slices/tabs.slice'
import { accessTokenStored, authCleared, profileLoaded, sessionEpochIncremented } from '@/store/slices/user.slice'
import type { AppStore } from '@/store/store'
import { getDefaultAppStore } from '@/store/store'
import type { ProfileData } from '@/types/auth/auth.types'
import type { User } from '@/types/system/user/user.types'
import { emitAuthNavigation } from './authNavigation'

/** 登录表单凭据：纯前端模式不校验内容，任意账号密码均可登录 */
export interface LocalCredentials {
  username: string
  password: string
}

export interface CreateAuthSessionOptions {
  store: AppStore['store']
  /** 启动闸门 Promise：ensureProfile 等待其完成后才读取 token */
  rehydrated: Promise<void>
}

export interface AuthSessionRuntime {
  /** 权限快照就绪：无 token 返回 null；有 token 复用或重建本地快照（规格 §4.3 语义） */
  ensureProfile(): Promise<ProfileData | null>
  /** 登录状态机：接受任意凭据，写入 token 与权限快照后产出 post-login 导航意图 */
  loginWithCredentials(dto: LocalCredentials): Promise<void>
  /** 登出状态机：本地清理认证、页签与页面缓存，产出 post-logout 导航意图 */
  logoutSession(): Promise<void>
}

/** 本地会话固定 accessToken：仅作为「已登录」标记，不参与任何网络认证 */
const LOCAL_ACCESS_TOKEN = 'local-session'

/** 本地会话固定用户名：整页刷新后 profile 不持久化，重建快照时使用 */
const LOCAL_USER_NAME = 'admin'

/** 本地会话固定用户 id */
const LOCAL_USER_ID = 'local-user'

/** 构造本地管理员权限快照：admin 角色与 '*' 通配使全部权限码与菜单放行 */
function buildLocalProfile(username: string): ProfileData {
  const now = new Date().toISOString()
  const user: User = {
    id: LOCAL_USER_ID,
    username,
    displayName: username,
    status: 'active',
    phone: null,
    email: null,
    lastLoginAt: now,
    passwordUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
    department: null,
    posts: [],
  }
  return { user, roleCodes: [ADMIN_ROLE_CODE], permCodes: [PERMISSION_WILDCARD], menuPaths: null }
}

export function createAuthSessionRuntime(options: CreateAuthSessionOptions): AuthSessionRuntime {
  const { store, rehydrated } = options

  async function ensureProfile(): Promise<ProfileData | null> {
    await rehydrated
    const state = store.getState().user
    if (state.accessToken === null) {
      return null
    }
    // 快照已就绪时直接复用，避免每次导航都派发新引用触发无谓重渲染
    if (state.user !== null) {
      return { user: state.user, roleCodes: state.roles, permCodes: state.permCodes, menuPaths: state.menuPaths }
    }
    const profile = buildLocalProfile(LOCAL_USER_NAME)
    store.dispatch(
      profileLoaded({
        user: profile.user,
        roles: profile.roleCodes,
        permCodes: profile.permCodes,
        menuPaths: profile.menuPaths,
      }),
    )
    return profile
  }

  async function loginWithCredentials(dto: LocalCredentials): Promise<void> {
    // 纯前端模式：不校验凭据，任意账号密码均放行；username 取输入值用于展示
    const profile = buildLocalProfile(dto.username.trim())
    // 会话切换：先递增 epoch 使旧会话在途任务失效，再写入 token 与权限快照
    store.dispatch(sessionEpochIncremented())
    store.dispatch(accessTokenStored({ accessToken: LOCAL_ACCESS_TOKEN }))
    store.dispatch(
      profileLoaded({
        user: profile.user,
        roles: profile.roleCodes,
        permCodes: profile.permCodes,
        menuPaths: profile.menuPaths,
      }),
    )
    // 登录成功产出路由无关导航意图；合法回跳的解码与同源校验由路由任务唯一承担
    emitAuthNavigation({ kind: 'post-login', target: ROUTE_FALLBACK_PATH })
  }

  async function logoutSession(): Promise<void> {
    // 先递增 epoch，再清空认证、销毁页签与页面缓存；settings 不在清理范围
    store.dispatch(sessionEpochIncremented())
    store.dispatch(authCleared())
    store.dispatch(tabsCleared())
    store.dispatch(pageCacheCleared())
    // 主动登出回登录页，不携带 redirect 参数（用户显式离开，不回跳原地址）
    emitAuthNavigation({ kind: 'post-logout', target: ROUTE_PATHS.LOGIN })
  }

  return {
    ensureProfile,
    loginWithCredentials,
    logoutSession,
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
