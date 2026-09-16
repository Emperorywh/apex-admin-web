/**
 * 认证服务：旧后端身份协议唯一接入点（SPEC §6.2、D06）。
 *
 * - 登录 / 详情 / 登出走 /fms/v1/auth/authorize/*，经 T003 旧协议通道
 *   （信封解包、1000000/1001000 事件、无重试无重放）；
 * - 登录密码按源规则 MD5 后发送，不存储、不上送原文；
 * - refresh 与认证重放不用于旧 token（本服务不存在刷新概念）；
 * - 刷新恢复：坏存储兜底 → 缓存快照渲染 → detail 重新核对身份与权限；
 * - 会话纪元隔离：登录/恢复/失效推进 epoch，迟到响应凭纪元丢弃；
 * - 事件桥：1000000 → 立即清会话（D26）；1001000 → 置授权挂起标记，
 *   路由跳转与业务清理编排分别归 T007/T015，本层只维护唯一身份状态。
 */

import { store } from '@/store/store'
import {
  identityReady,
  identityVerified,
  restoreFinishedWithoutSession,
  sessionExpired,
  softwareAuthorizationRequired,
} from '@/store/slices/authSlice'
import {
  legacyGet,
  legacyPost,
  setLegacyToken,
  subscribeLegacyEvents,
} from '@/services/request/legacy/legacyRequest'
import { LEGACY_ERROR_CODES } from '@/services/request/legacy/legacy.types'
import type { ApiError } from '@/services/request/request.types'
import { md5 } from '@/services/auth/crypto/md5'
import { persistIdentity, readStoredAccessInfo } from '@/services/auth/identity.storage'
import type {
  AuthDetailDataDto,
  AuthLoginDataDto,
  LoginRequestDto,
} from '@/services/auth/auth.service.types'
import type { IdentitySnapshot } from '@/types/auth/auth.types'

/* -------------------------------------------------------------------------- */
/* 协议地址（SPEC 附录B；路径保留源样，不前置 /api/v1）                             */
/* -------------------------------------------------------------------------- */

const LOGIN_URL = '/fms/v1/auth/authorize/login'
const DETAIL_URL = '/fms/v1/auth/authorize/detail'
const LOGOUT_URL = '/fms/v1/auth/authorize/logout'

/* -------------------------------------------------------------------------- */
/* 会话纪元：切账号/重登的迟到响应隔离（消费合同见 identity 契约文档）                */
/* -------------------------------------------------------------------------- */

/** 读取当前会话纪元；请求发起方在发请求前捕获 */
export function getIdentityEpoch(): number {
  return store.getState().auth.epoch
}

/** 比对捕获的纪元是否仍为当前会话；false = 响应来自已结束的会话，必须丢弃 */
export function isIdentityEpochCurrent(epoch: number): boolean {
  return store.getState().auth.epoch === epoch
}

/* -------------------------------------------------------------------------- */
/* DTO → 身份快照                                                              */
/* -------------------------------------------------------------------------- */

/** 由登录响应组装快照；activated 沿源严格判定（仅 === false 视为未激活） */
function toSnapshotFromLogin(data: AuthLoginDataDto, username: string): IdentitySnapshot {
  return {
    username,
    activated: data.activated !== false,
    permissionsTree: data.permissionsTree ?? [],
    flatPermissions: data.permissions ?? [],
  }
}

/**
 * 详情核查结果 → 快照；返回 null 表示响应不足以核对身份
 * （信封成功但缺关键字段：无法确认是哪个账号、权限是否完整，按核对失败处理）。
 */
function toSnapshotFromDetail(data: AuthDetailDataDto, fallbackUsername: string): IdentitySnapshot | null {
  const username = typeof data.username === 'string' && data.username ? data.username : fallbackUsername
  const hasCredentialBasis =
    (typeof data.username === 'string' && data.username.length > 0) ||
    Array.isArray(data.permissionsTree)
  if (!hasCredentialBasis) return null
  return {
    username,
    activated: data.activated !== false,
    permissionsTree: data.permissionsTree ?? [],
    flatPermissions: data.permissions ?? [],
  }
}

/* -------------------------------------------------------------------------- */
/* 登录 / 登出                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 登录：密码 MD5 后 POST login；成功即写快照 + 存储 + 请求头。
 * 未激活（activated === false）同样持有有效 token，由调用方分流授权页（T007/T018）。
 */
export async function login(credentials: LoginRequestDto): Promise<IdentitySnapshot> {
  // 源协议：密码以 32 位小写 MD5 摘要上送（utils/crypto.md5 @ e570b8df）
  const data = await legacyPost<AuthLoginDataDto>(LOGIN_URL, {
    username: credentials.username,
    password: md5(credentials.password),
  })
  if (!data || typeof data.token !== 'string' || data.token.length === 0) {
    // 无 token 的"成功"响应视为协议异常，不进入半登录状态
    throw new Error('登录响应缺少 token')
  }
  const username = credentials.username.trim()
  const snapshot = toSnapshotFromLogin(data, username)
  // 源行为：存储带 "Bearer " 前缀的最终形态，避免后续重复拼接
  const bearerToken = `Bearer ${data.token}`
  persistIdentity(snapshot, bearerToken)
  store.dispatch(identityReady(snapshot))
  return snapshot
}

/**
 * 登出：通知后端销毁会话；业务失败/网络失败原样抛出，
 * 由调用方提示并保留会话（源行为：登出未成功不本地登出）。
 * 成功后清除存储与请求头；Redux 状态由调用方 dispatch sessionExpired 收敛
 * （页签/草稿清理在同一 reducer 内完成）。
 */
export async function logout(): Promise<void> {
  await legacyPost(LOGOUT_URL)
  persistIdentity(null)
}

/* -------------------------------------------------------------------------- */
/* 刷新恢复                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 刷新页面后的会话恢复（启动引导调用，先于路由守卫）：
 *
 * 1. 读取存储；缺失或损坏 → 无会话结论；
 * 2. 有存储：先恢复请求头并保留缓存快照（外渲染壳可用），随后 detail 重新核对；
 * 3. 核对成功 → identityVerified（纪元匹配才生效）；
 *    核对遇 1000000 → 立即清会话（D26）；
 *    网络失败 → 保留缓存快照继续（对齐源行为：恢复不因后端暂时不可达而强制登出），
 *    后续首个业务请求的失效事件会再次收敛。
 *
 * 全程不存储、不读取密码。
 */
/**
 * 会话恢复完成门（T007）：restoreSession 无论结论如何都会置 resolve。
 * 守卫 loader 在路由模块初始化期即运行，早于启动引导完成；守卫必须等待
 * 本门拿到确定性登录结论（identity/restored 已落定），否则硬刷新会被误判
 * 为未登录而弹回登录页。
 */
let resolveSessionRestoreGate: (() => void) | null = null
const sessionRestoreGate = new Promise<void>((resolve) => {
  resolveSessionRestoreGate = resolve
})

export function awaitSessionRestored(): Promise<void> {
  return sessionRestoreGate
}

export async function restoreSession(): Promise<void> {
  try {
    await runRestoreSession()
  } finally {
    resolveSessionRestoreGate?.()
    resolveSessionRestoreGate = null
  }
}

async function runRestoreSession(): Promise<void> {
  const stored = readStoredAccessInfo()
  // 形状守卫已保证 username/token 非空；类型收窄仅防可选字段语义
  const storedToken = stored?.token
  const storedUsername = stored?.username
  if (!stored || !storedToken || !storedUsername) {
    persistIdentity(null)
    store.dispatch(restoreFinishedWithoutSession())
    return
  }

  // 恢复请求头（缓存快照已由 redux-persist 还原进 store，无需在此派发）
  setLegacyToken(storedToken)

  const cachedIdentity = store.getState().auth.identity
  const fallbackUsername = cachedIdentity?.username ?? storedUsername
  const epoch = getIdentityEpoch()
  try {
    // detail 沿源 GET 方法，携带恢复的 Authorization 头核查当前 token 的身份与权限
    const data = await legacyGet<AuthDetailDataDto>(DETAIL_URL)
    // 等待期间发生重登/切号（纪元推进）→ 本次核对结果作废
    if (!isIdentityEpochCurrent(epoch)) return
    const snapshot = toSnapshotFromDetail(data, fallbackUsername)
    if (snapshot === null) {
      // 信封成功但无法核对身份：按会话不可信处理，立即清除
      persistIdentity(null)
      store.dispatch(sessionExpired())
      return
    }
    // 核查结果回写存储：下次刷新引导的缓存快照与服务器真值一致
    persistIdentity(snapshot)
    store.dispatch(identityVerified({ epoch, identity: snapshot }))
  } catch (error) {
    const api = (error as { api?: ApiError }).api
    if (api?.code === LEGACY_ERROR_CODES.SESSION_EXPIRED) {
      // 恢复即遇认证失效：立即清会话（D26），不进入受保护界面
      persistIdentity(null)
      store.dispatch(sessionExpired())
      return
    }
    if (api?.code === LEGACY_ERROR_CODES.SOFTWARE_UNAUTHORIZED) {
      // 身份仍有效但软件未授权：置挂起标记，路由编排归 T007/T018
      store.dispatch(softwareAuthorizationRequired())
      return
    }
    // 网络/服务不可达：保留缓存快照与请求头，结论仍为"已恢复"（源行为对齐）
  }
}

/* -------------------------------------------------------------------------- */
/* 事件桥：T003 旧协议事件 → 唯一身份状态                                          */
/* -------------------------------------------------------------------------- */

/**
 * 启动期注册一次：订阅旧协议请求事件。
 * - session-expired（1000000）：立即清存储/请求头/身份（D26），迟到回执凭纪元隔离；
 *   登录页/授权页自身的失效事件不重复清（无会话时跳过）。
 * - authorization-required（1001000）：身份有效，仅置挂起标记；
 * - request-error：不进身份层，由页面提示层消费。
 * 不做路由跳转与业务清理编排（T015 统一接线）。
 */
export function initIdentityEventBridge(): () => void {
  return subscribeLegacyEvents((event) => {
    if (event.type === 'session-expired') {
      // 仅在存在会话时处理一次：无会话的失效事件（登录页密码错误等）不触发登出编排
      if (store.getState().auth.identity === null) return
      persistIdentity(null)
      store.dispatch(sessionExpired())
      return
    }
    if (event.type === 'authorization-required') {
      store.dispatch(softwareAuthorizationRequired())
    }
  })
}
