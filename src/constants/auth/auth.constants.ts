/**
 * 认证域常量。
 */

/** 登录成功后回跳地址所用的查询参数名 */
export const LOGIN_REDIRECT_QUERY_KEY = 'redirect'

/** 内部 admin 标记注入条件：username 等于该值时视为超管（对应后端 super_admin 角色） */
export const ADMIN_USERNAME = 'admin'

/** 密码长度边界（Unicode 字符数，仅长度校验、无复杂度；与后端策略一致） */
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

/** 用户名长度边界 */
export const USERNAME_MIN_LENGTH = 2
export const USERNAME_MAX_LENGTH = 32
