/**
 * 认证服务：真实登录（POST /auth/authorize/login）与登出（/auth/authorize/logout）。
 *
 * - 密码以 MD5 摘要提交：旧项目已证实行为（spark-md5，32 位小写）；
 *   文档仅声明字符串密码且无 securitySchemes，最终确认统一登记缺口 G03
 * - Authorization: Bearer <token> 由请求层单点组装，本服务不手工拼头
 * - 后端无 /users/me、无刷新令牌接口（G01/G02 已确认缺失）：
 *   会话完全由登录返回构建并持久化，过期即重新登录，不做静默刷新
 */

import SparkMD5 from 'spark-md5'
import { api } from '@/services/request/request'
import type { LoginParamDto, UserAuthDto } from '@/services/auth/auth.service.types'
import type { AuthSession, AuthUser } from '@/types/auth/auth.types'

/** 密码提交前统一做 MD5 摘要（G03：旧代码已证实行为，单一适配点） */
function toPasswordDigest(plain: string): string {
  return SparkMD5.hash(plain)
}

/** 从用户显示名生成头像缩写（最多两个字符） */
function toInitials(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return '–'
  const asciiWords = trimmed.split(/\s+/)
  if (/^[A-Za-z]/.test(trimmed) && asciiWords.length >= 2) {
    return (asciiWords[0][0] + asciiWords[1][0]).toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

/**
 * 登录返回 UserAuth → 前端会话实体。
 * 后端字段允许缺省（可空）：逐项回退到诚实默认值，不伪造登录人信息。
 */
function toSession(payload: UserAuthDto): AuthSession {
  const username = payload.user?.username ?? ''
  const user: AuthUser = {
    // int64 id 转字符串无损承载（G10：精度契约联调后最终确认）
    id: payload.user?.id === null || payload.user?.id === undefined ? '' : String(payload.user.id),
    username,
    displayName: username,
    state: payload.user?.state ?? 'DISABLED',
    level: payload.user?.level ?? 0,
    initials: toInitials(username),
  }
  return {
    token: payload.token ?? '',
    activated: payload.activated === true,
    user,
    roles: payload.roles ?? [],
    permissions: payload.permissions ?? [],
    permissionsTree: payload.permissionsTree ?? [],
  }
}

/**
 * 真实登录：调用 POST /auth/authorize/login。
 * 失败（凭据错误 / 网络异常）由请求层抛出 ApiError，本服务不吞错不改判成功。
 */
export async function login(credentials: LoginParamDto): Promise<AuthSession> {
  const payload: LoginParamDto = {
    username: credentials.username.trim(),
    password: toPasswordDigest(credentials.password),
  }
  // api.post 已完成 Result 解包：code!==200 抛业务错误，返回值即 data（UserAuth）
  const userAuth = await api.post<UserAuthDto>('/auth/authorize/login', payload)
  return toSession(userAuth)
}

/**
 * 登出：POST /auth/authorize/logout（OpenAPI 已声明，ResultVoid）。
 * 尽力通知后端；无论成败都继续本地登出（令牌清理由调用方派发 sessionExpired 收敛）。
 */
export async function logout(): Promise<void> {
  try {
    await api.post<void>('/auth/authorize/logout')
  } catch {
    // 后端不可达 / 会话已失效：本地登出继续，不阻塞用户
  }
}
