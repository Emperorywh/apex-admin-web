/**
 * 认证业务域常量（规格 §6）：登录/刷新/登出 endpoint、会话来源与凭据策略。
 * auth service、守卫与登录表单一律引用本文件。
 * /auth/profile 与 /auth/password 属个人中心业务域，见 profile.constants.ts。
 */

/** 认证接口路径模板（规格 §6.3 核心认证接口） */
export const AUTH_ENDPOINTS = {
  /** 登录：body { username, password } */
  LOGIN: '/auth/login',
  /** 刷新：body { refreshToken }；使用不安装业务响应拦截器的专用实例 */
  REFRESH: '/auth/refresh',
  /** 登出：body { refreshToken }；固定 skipAuthRefresh */
  LOGOUT: '/auth/logout',
} as const

/**
 * 会话来源枚举（规格 §6.1）。
 * sessionSource 随双 token 持久化，在任何请求 adapter 选择之前完成恢复；
 * real 走真实后端，demo 走 demo adapter。
 */
export const SESSION_SOURCES = {
  REAL: 'real',
  DEMO: 'demo',
} as const

/** 会话来源联合类型：由 SESSION_SOURCES 推导 */
export type SessionSource = (typeof SESSION_SOURCES)[keyof typeof SESSION_SOURCES]

/**
 * 账号密码最小长度，单位：字符（规格 §14.3）。
 * 密码最少 8 位且必须同时包含字母和数字；该策略同时约束创建用户与个人中心修改密码，
 * 对应校验规则由表单实现，登录接口不做该前置校验（demo 账号密码任意）。
 */
export const PASSWORD_MIN_LENGTH = 8
