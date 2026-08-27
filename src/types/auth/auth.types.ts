/**
 * 认证域跨层实体：登录用户会话。
 */

/** 登录用户；由 /users/me 转换而来 */
export interface AuthUser {
  id: string
  username: string
  displayName: string
  email: string | null
  /** 头像展示用的姓名缩写（如 "YW"） */
  initials: string
  roleCodes: string[]
  roleNames: string[]
}

/** 完整会话 = 当前登录用户 */
export interface AuthSession {
  user: AuthUser
}
