/**
 * 正式权限码（规格 §3.6 所有权表、§5.1）。
 * 本文件是全部正式权限码的唯一所有者；页面、组件、守卫与菜单过滤一律引用此处，
 * 禁止出现权限魔法字符串。
 */

/**
 * 模板必须定义并使用的 15 个权限码（规格 §5.1），格式固定为 `<模块>:<资源>:<动作>`。
 * 前端权限仅改善 UX，后端始终承担最终鉴权。
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',
  SYSTEM_USER_LIST: 'system:user:list',
  SYSTEM_USER_CREATE: 'system:user:create',
  SYSTEM_USER_UPDATE: 'system:user:update',
  SYSTEM_USER_DELETE: 'system:user:delete',
  SYSTEM_USER_ASSIGN_ROLE: 'system:user:assign-role',
  SYSTEM_ROLE_LIST: 'system:role:list',
  SYSTEM_ROLE_CREATE: 'system:role:create',
  SYSTEM_ROLE_UPDATE: 'system:role:update',
  SYSTEM_ROLE_DELETE: 'system:role:delete',
  SYSTEM_ROLE_ASSIGN_PERMISSION: 'system:role:assign-permission',
  SYSTEM_MENU_LIST: 'system:menu:list',
  SYSTEM_MENU_CREATE: 'system:menu:create',
  SYSTEM_MENU_UPDATE: 'system:menu:update',
  SYSTEM_MENU_DELETE: 'system:menu:delete',
} as const

/** 正式权限码联合类型：由 PERMISSIONS 推导，避免另写一份可能漂移的字符串联合 */
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/**
 * 权限通配符（规格 §4.4/§5.1）。
 * admin 角色视作拥有 '*'，hasAuth('*') 与任意权限码判定对其均返回 true；
 * 它不是 §5.1 清单中的正式权限码，后端仍逐接口鉴权。
 */
export const PERMISSION_WILDCARD = '*'
