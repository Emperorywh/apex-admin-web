/**
 * 认证服务：登录（临时直通）、会话（/users/me）、登出。
 */

import { api, setAccessToken } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { LoginRequestDto, MeResponseDto } from '@/services/auth/auth.service.types'
import type { AuthSession } from '@/types/auth/auth.types'

/** 临时直通登录的缺省账号名 */
const ADMIN_USERNAME = 'admin'

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

/** DTO → 会话实体 */
function toSession(me: MeResponseDto): AuthSession {
  return {
    user: {
      id: me.id,
      username: me.username,
      displayName: me.displayName,
      email: me.email,
      initials: toInitials(me.displayName),
      roleCodes: me.roles.map((role) => role.code),
      roleNames: me.roles.map((role) => role.name),
    },
  }
}

/**
 * 登录（临时直通）：后端尚未接入，任意账号密码直接放行。接入后端后恢复真实登录。
 */
export async function login(credentials: LoginRequestDto): Promise<AuthSession> {
  const username = credentials.username.trim() || ADMIN_USERNAME
  return {
    user: {
      id: 'local-session',
      username,
      displayName: username,
      email: null,
      initials: toInitials(username),
      roleCodes: ['super_admin'],
      roleNames: ['超级管理员'],
    },
  }
}

/** 加载当前会话；未登录时后端返回 401 */
export async function loadSession(options?: RequestOptions): Promise<AuthSession> {
  const me = await api.get<MeResponseDto>('/users/me', { signal: options?.signal })
  return toSession(me)
}

/** 登出：尽力通知后端销毁 refreshToken Cookie，随后清除本地令牌 */
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } catch {
    // 后端不可达时也继续本地登出
  } finally {
    setAccessToken(null)
  }
}
