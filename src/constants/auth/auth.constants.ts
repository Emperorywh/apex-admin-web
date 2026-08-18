/**
 * 认证业务域常量（规格 §6）：凭据策略。
 * 守卫与登录表单一律引用本文件；登录/刷新/登出接口路径由 auth service 在调用点内联
 * （规格 §14.3 v1.8），/auth/profile 与 /auth/password 亦归 auth service 内联。
 */

/**
 * 账号密码最小长度，单位：字符（后端 SPEC 23.2：密码为 12-128 个 Unicode 字符）。
 * 该策略同时约束创建用户与个人中心修改密码，对应校验规则由表单实现，
 * 登录接口不做该前置校验。
 */
export const PASSWORD_MIN_LENGTH = 12

/**
 * 账号密码最大长度，单位：字符（后端 SPEC 23.2：密码为 12-128 个 Unicode 字符）。
 */
export const PASSWORD_MAX_LENGTH = 128

/**
 * 密码强度正则（后端 SPEC 23.2 仅约束长度，无复杂度要求）：
 * 总长在 [PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH] 内。
 * 创建用户表单与个人中心修改密码表单的前置校验共用，
 * 唯一权威定义，不在调用点复制正则字面量。
 */
export const PASSWORD_PATTERN = /^.{12,128}$/

/**
 * 超级管理员用户名（规格 §5.1/§6.3 v1.15）：username 等于该值的用户由前端固定注入
 * admin 角色码（通配语义，§4.4）且菜单不受后端菜单树白名单限制——后端 /me 端点按
 * 启用角色聚合，admin 用户无角色时返回空集合，超管体验由前端补齐；后端仍逐接口鉴权。
 */
export const SUPER_ADMIN_USERNAME = 'admin'

