/**
 * 路由常量：路由 ID、路径与稳定回退地址。
 * definitions/projections 与守卫只能引用此处定义，禁止散落字面量。
 */

export const ROUTE_IDS = {
  AUTH_LOGIN: 'auth-login',
  ROOT: 'root',
  /** 受保护根的 index 重定向节点 */
  ROOT_INDEX: 'root-index',
  /** 受保护根内 * 的 404 节点 */
  ROOT_NOT_FOUND: 'root-not-found',
  DASHBOARD: 'dashboard',
  PROFILE: 'profile',
  SYSTEM: 'system',
  SYSTEM_USER: 'system-user',
  SYSTEM_ROLE: 'system-role',
  SYSTEM_MENU: 'system-menu',
  ERROR_403: 'error-403',
  ERROR_404: 'error-404',
  ERROR_500: 'error-500',
} as const

export const ROUTE_PATHS = {
  LOGIN: '/login',
  ROOT: '/',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SYSTEM: '/system',
  SYSTEM_USER: '/system/user',
  SYSTEM_ROLE: '/system/role',
  SYSTEM_MENU: '/system/menu',
  ERROR_403: '/403',
  ERROR_404: '/404',
  ERROR_500: '/500',
} as const

/** 登无页签可激活时的稳定回退地址 */
export const FALLBACK_PATH = ROUTE_PATHS.DASHBOARD
