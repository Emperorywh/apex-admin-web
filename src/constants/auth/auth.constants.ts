/**
 * 认证域跨层共享契约：登录回跳参数与用户名边界。
 */

/** 登录成功后回跳地址所用的查询参数名 */
export const LOGIN_REDIRECT_QUERY_KEY = 'redirect'

/** 用户名长度边界（Unicode 字符数）；登录表单与用户管理表单共用，与后端策略一致 */
export const USERNAME_MIN_LENGTH = 2
export const USERNAME_MAX_LENGTH = 32
