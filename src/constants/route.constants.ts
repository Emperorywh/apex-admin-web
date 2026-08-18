/**
 * 框架核心路由 ID、路径与稳定回退地址（规格 §3.6 所有权表、§4、§14.2，v1.10 收缩）。
 * 只负责被守卫、会话清理、回跳校验、错误页与布局等跨层机制消费的框架核心路由；
 * 业务页面节点的 id/path 由 src/router/definitions.tsx 直接内联，不在本文件登记。
 * ID 必须全局唯一且稳定，路径为前端静态路由地址（与后端 API 路径无关）。
 */

/** 路由节点 ID：框架核心路由的稳定唯一标识（规格 §4.1/§4.2）；业务路由 id 内联于 definitions.tsx */
export const ROUTE_IDS = {
  /** 受保护根（BasicLayout 挂载点） */
  ROOT: 'root',
  /** 受保护 index route：固定 replace 重定向到 /dashboard（规格 §4.2） */
  INDEX: 'index',
  LOGIN: 'login',
  DASHBOARD: 'dashboard',
  /** 个人中心：仅要求登录、入口在 Header 用户菜单（规格 §14.2） */
  PROFILE: 'profile',
  /** 错误页：仅要求登录、无 permCode，防止错误页自身形成权限循环（规格 §4.2） */
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not-found',
  /** 受保护根内的 * 兜底路由：渲染同一 NotFound 页面组件（规格 §4.2，与显式 /404 区分的独立节点） */
  NOT_FOUND_SPLAT: 'not-found-splat',
  SERVER_ERROR: 'server-error',
} as const

/** 路由节点路径：框架核心路由的前端静态路由地址（规格 §14.2）；业务路由 path 内联于 definitions.tsx */
export const ROUTE_PATHS = {
  /** 受保护根入口；其 index route 固定 replace 到 /dashboard */
  ROOT: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
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
