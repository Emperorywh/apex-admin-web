/**
 * 认证业务域常量（规格 §6）：会话来源与凭据策略。
 * 守卫与登录表单一律引用本文件；登录/刷新/登出接口路径由 auth service 在调用点内联
 * （规格 §14.3 v1.8），/auth/profile 与 /auth/password 亦归 auth service 内联。
 */

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

/**
 * 密码强度正则（规格 §14.3）：至少一位字母且至少一位数字，总长不小于 PASSWORD_MIN_LENGTH。
 * 创建用户表单与个人中心修改密码表单的前置校验、demo adapter 的创建用户契约校验共用，
 * 唯一权威定义，不在调用点复制正则字面量。
 */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

