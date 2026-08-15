/**
 * 路由 ID、路径与稳定回退地址（规格 §3.6 所有权表、§4、§14.2）。
 * 路由定义、守卫、重定向与页签逻辑一律引用本文件；
 * ID 必须全局唯一且稳定，路径为前端静态路由地址（与后端 API 路径无关）。
 */

/** 路由节点 ID：路由树每个节点（含目录节点）的稳定唯一标识（规格 §4.1/§4.2） */
export const ROUTE_IDS = {
  /** 受保护根（BasicLayout 挂载点） */
  ROOT: 'root',
  /** 受保护 index route：固定 replace 重定向到 /dashboard（规格 §4.2） */
  INDEX: 'index',
  LOGIN: 'login',
  DASHBOARD: 'dashboard',
  /** 系统管理目录节点 */
  SYSTEM: 'system',
  SYSTEM_USER: 'system-user',
  SYSTEM_ROLE: 'system-role',
  SYSTEM_MENU: 'system-menu',
  /** 演示模式目录节点 */
  DEMO: 'demo',
  DEMO_NESTED: 'demo-nested',
  DEMO_NESTED_LEVEL1: 'demo-nested-level1',
  DEMO_NESTED_LEVEL2: 'demo-nested-level2',
  DEMO_NESTED_LEVEL3: 'demo-nested-level3',
  PROFILE: 'profile',
  /** 错误页：仅要求登录、无 permCode，防止错误页自身形成权限循环（规格 §4.2） */
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not-found',
  SERVER_ERROR: 'server-error',
} as const

/** 路由节点路径：前端静态路由地址（规格 §14.2） */
export const ROUTE_PATHS = {
  /** 受保护根入口；其 index route 固定 replace 到 /dashboard */
  ROOT: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  SYSTEM: '/system',
  SYSTEM_USER: '/system/user',
  SYSTEM_ROLE: '/system/role',
  SYSTEM_MENU: '/system/menu',
  DEMO: '/demo',
  DEMO_NESTED: '/demo/nested',
  DEMO_NESTED_LEVEL1: '/demo/nested/level1',
  DEMO_NESTED_LEVEL2: '/demo/nested/level1/level2',
  /** 三级导航叶子页（规格 §14.2：/demo/nested/level1/level2/level3） */
  DEMO_NESTED_LEVEL3: '/demo/nested/level1/level2/level3',
  PROFILE: '/profile',
  FORBIDDEN: '/403',
  NOT_FOUND: '/404',
  SERVER_ERROR: '/500',
} as const

/**
 * 稳定回退地址：登录回跳校验失败与「关闭全部页签」等无合法落点场景统一回到这里
 * （规格 §4.3/§9.3）。Dashboard 是唯一默认 affix 页签，所有可登录账号必须可访问。
 */
export const ROUTE_FALLBACK_PATH: string = ROUTE_PATHS.DASHBOARD

/**
 * 登录页回跳参数名（规格 §4.3）。
 * 守卫用 URLSearchParams#set 写入当前地址，登录成功后按同源校验规则取出；
 * 禁止手工字符串拼接与重复 encodeURIComponent。
 */
export const REDIRECT_QUERY_KEY = 'redirect'
