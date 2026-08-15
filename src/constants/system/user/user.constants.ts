/**
 * 用户管理业务域常量（规格 §14.3）：endpoint、排序与查询字段白名单、字段约束。
 * 用户页面、feature 组件/Hook、user service 与 demo adapter 一律引用本文件，
 * 禁止在任意调用点重复这些字面量。
 */

/** 用户接口路径模板（规格 §14.3）；:id 由 service 以真实用户 ID 替换 */
export const USER_ENDPOINTS = {
  /** 分页查询：GET → PageResult<User> */
  LIST: '/users',
  /** 创建用户：body { username, password, displayName, email, phone?, status, roleIds } */
  CREATE: '/users',
  /** 编辑用户：body { displayName, email, phone?, status }；不含 username/password/roleIds */
  UPDATE: '/users/:id',
  /** 删除用户：删除自己、删除最后一个 admin 均返回 RESOURCE_CONFLICT */
  DELETE: '/users/:id',
  /** 分配角色：body { roleIds } */
  ASSIGN_ROLES: '/users/:id/roles',
} as const

/**
 * 用户列表 sortBy 白名单（规格 §14.3）。
 * 白名单外的 sortBy 返回 VALIDATION_FAILED；未传时统一 createdAt desc。
 */
export const USER_SORT_FIELDS = ['username', 'displayName', 'status', 'createdAt'] as const

/** 用户排序字段联合类型：由 USER_SORT_FIELDS 推导 */
export type UserSortField = (typeof USER_SORT_FIELDS)[number]

/**
 * 用户列表 keyword 匹配字段（规格 §14.3）。
 * keyword 去除首尾空白后，对这些字段做不区分大小写的包含匹配；
 * 真实 service 与 demo adapter 必须使用同一字段集合。
 */
export const USER_KEYWORD_FIELDS = ['username', 'displayName'] as const

/**
 * 用户邮箱格式校验正则（规格 §14.3：email 格式校验）。
 * 采用务实格式：非空本地部分 + @ + 域名 + 顶级域，不做完整 RFC 校验；
 * 创建与编辑用户、个人中心资料表单共用。
 */
export const USER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
