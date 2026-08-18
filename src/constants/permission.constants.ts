/**
 * 正式权限码（对齐真实后端权限目录，apex-admin SPEC 13.1/25.2）。
 * 本文件是全部正式权限码的唯一所有者；页面、组件、守卫与菜单过滤一律引用此处，
 * 禁止出现权限魔法字符串。
 */

/**
 * 模板权限码全集（后端按 `<模块>:<资源>:<动作>` 声明并经 sync-permissions 同步）：
 * identity 用户域为 system:user:read/write；rbac 角色域为 rbac:role:read/write、
 * 分配类动作为 rbac:assignment:write；menu 域为 menu:menu:read/write。
 * 后端动作粒度为 read/write 两级（无 create/update/delete 细分码），
 * 同一后端码可被多个语义 key 引用；前端权限仅改善 UX，后端始终承担最终鉴权。
 */
export const PERMISSIONS = {
  SYSTEM_USER_LIST: 'system:user:read',
  SYSTEM_USER_CREATE: 'system:user:write',
  SYSTEM_USER_UPDATE: 'system:user:write',
  SYSTEM_USER_DELETE: 'system:user:write',
  SYSTEM_USER_ASSIGN_ROLE: 'rbac:assignment:write',
  SYSTEM_ROLE_LIST: 'rbac:role:read',
  SYSTEM_ROLE_CREATE: 'rbac:role:write',
  SYSTEM_ROLE_UPDATE: 'rbac:role:write',
  SYSTEM_ROLE_DELETE: 'rbac:role:write',
  SYSTEM_ROLE_ASSIGN_PERMISSION: 'rbac:assignment:write',
  SYSTEM_MENU_LIST: 'menu:menu:read',
  SYSTEM_MENU_CREATE: 'menu:menu:write',
  SYSTEM_MENU_UPDATE: 'menu:menu:write',
  SYSTEM_MENU_DELETE: 'menu:menu:write',
} as const

/** 正式权限码联合类型：由 PERMISSIONS 推导，避免另写一份可能漂移的字符串联合 */
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/**
 * 权限通配符（规格 §4.4/§5.1）。
 * admin 角色视作拥有 '*'，hasAuth('*') 与任意权限码判定对其均返回 true；
 * 它不是正式权限码，后端仍逐接口鉴权。
 */
export const PERMISSION_WILDCARD = '*'
