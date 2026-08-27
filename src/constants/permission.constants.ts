/**
 * 权限码统一定义（read/write 两级，与后端协议一致）。
 * 路由 meta.permCode、按钮鉴权与守卫只能引用此处定义。
 */

/** 超管通配权限码；持有者视为拥有全部权限 */
export const WILDCARD_PERMISSION = '*'

export const PERMISSION_CODES = {
  SYSTEM_USER_READ: 'system:user:read',
  SYSTEM_USER_WRITE: 'system:user:write',
  RBAC_ROLE_READ: 'rbac:role:read',
  RBAC_ROLE_WRITE: 'rbac:role:write',
  RBAC_ASSIGNMENT_WRITE: 'rbac:assignment:write',
  MENU_MENU_READ: 'menu:menu:read',
  MENU_MENU_WRITE: 'menu:menu:write',
} as const

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES]
