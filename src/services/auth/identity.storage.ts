/**
 * 身份本地存储：明确的存储结构与异常解析兜底（SPEC §6.2）。
 *
 * - 沿用源存储键 accessInfo 与字段形状（username/token/permissionsTree/flatPermissions），
 *   保持与冻结源码的存储契约一致；token 以带 "Bearer " 前缀的最终形态存储（源行为）；
 * - 只存非敏感数据，不存密码；
 * - JSON 解析失败 / 形状不合法一律视为无会话并清除，不再让坏存储反复破坏启动流程；
 * - token 不进 Redux：读写统一经本模块，请求头由 setLegacyToken 供给。
 */

import { setLegacyToken } from '@/services/request/legacy/legacyRequest'
import type { IdentitySnapshot, PermissionNode } from '@/types/auth/auth.types'

/** 本地存储键；与旧系统一致，便于排查与迁移对照 */
const ACCESS_INFO_STORAGE_KEY = 'accessInfo'

/** 存储结构：身份快照 + 带前缀 token（快照字段与 Redux 的 IdentitySnapshot 对齐） */
export interface StoredAccessInfo {
  username?: string
  token?: string
  permissionsTree?: PermissionNode[]
  flatPermissions?: string[]
}

/** 形状守卫：至少要有非空 username 与 token 才认为是可恢复的会话 */
function isPlausibleAccessInfo(value: unknown): value is StoredAccessInfo {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as StoredAccessInfo
  return (
    typeof candidate.username === 'string' &&
    candidate.username.length > 0 &&
    typeof candidate.token === 'string' &&
    candidate.token.length > 0
  )
}

/**
 * 读取存储的会话；解析失败或形状不合法时清除并返回 null（异常解析兜底）。
 * 不抛错：坏存储与"从未登录"对启动流程等价。
 */
export function readStoredAccessInfo(): StoredAccessInfo | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(ACCESS_INFO_STORAGE_KEY)
  } catch {
    // 隐私模式等 localStorage 不可用场景：按无会话处理
    return null
  }
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isPlausibleAccessInfo(parsed)) return parsed
  } catch {
    // JSON 损坏走清除分支
  }
  clearStoredAccessInfo()
  return null
}

/** 写入会话（登录成功 / 详情核查后刷新快照时调用）；token 为带 "Bearer " 前缀的最终形态 */
export function writeStoredAccessInfo(info: StoredAccessInfo): void {
  try {
    localStorage.setItem(ACCESS_INFO_STORAGE_KEY, JSON.stringify(info))
  } catch {
    // 写入失败不阻断登录流程；仅本次刷新恢复不可用
  }
}

/** 清除会话存储（登出 / 认证失效 / 坏存储自愈） */
export function clearStoredAccessInfo(): void {
  try {
    localStorage.removeItem(ACCESS_INFO_STORAGE_KEY)
  } catch {
    // 忽略：无法操作存储时保持原状
  }
}

/**
 * 用身份快照同步整条存储链：storage + 请求头来源。
 * snapshot 为 null 表示会话结束（清存储 + 清请求头）。
 */
export function persistIdentity(snapshot: IdentitySnapshot | null, token?: string): void {
  if (snapshot === null) {
    clearStoredAccessInfo()
    setLegacyToken(null)
    return
  }
  const resolvedToken = token ?? readStoredAccessInfo()?.token ?? null
  writeStoredAccessInfo({
    username: snapshot.username,
    token: resolvedToken ?? undefined,
    permissionsTree: snapshot.permissionsTree,
    flatPermissions: snapshot.flatPermissions,
  })
  if (resolvedToken) setLegacyToken(resolvedToken)
}
