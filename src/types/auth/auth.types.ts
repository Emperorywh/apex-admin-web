/**
 * 认证域跨层实体：登录用户会话。
 */

/** 登录用户；由 /users/me + /me/permissions 聚合转换而来 */
export interface AuthUser {
  id: string
  username: string
  displayName: string
  email: string | null
  /** 头像展示用的姓名缩写（如 "YW"） */
  initials: string
  /** 内部 admin 标记：username === 'admin' 时注入（对应后端 super_admin 角色） */
  isAdmin: boolean
  roleCodes: string[]
  roleNames: string[]
}

/** 完整会话 = 用户 + 权限码列表 */
export interface AuthSession {
  user: AuthUser
  permissions: string[]
}
