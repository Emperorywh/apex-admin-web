/**
 * 角色管理业务域常量（规格 §5.1/§14.3）：endpoint、排序与查询字段白名单、admin 标识。
 * 角色页面、feature 组件/Hook、role service 与 demo adapter 一律引用本文件。
 */

/** 角色接口路径模板（规格 §14.3）；:id 由 service 以真实角色 ID 替换 */
export const ROLE_ENDPOINTS = {
  /** 分页查询：GET → PageResult<Role> */
  LIST: '/roles',
  /** 创建角色：body { code, name, description?, status } */
  CREATE: '/roles',
  /** 编辑角色：body { name, description?, status }；不含 code */
  UPDATE: '/roles/:id',
  /** 删除角色：角色被用户引用或 builtIn 时返回 RESOURCE_CONFLICT */
  DELETE: '/roles/:id',
  /** 分配权限：body { permCodes: string[] } */
  ASSIGN_PERMISSIONS: '/roles/:id/permissions',
} as const

/**
 * 权限树接口（规格 §14.3：GET /permissions/tree → PermissionNode[]）。
 * 仅供角色分配权限使用，与角色接口同域维护。
 */
export const PERMISSION_TREE_ENDPOINT = '/permissions/tree'

/**
 * 角色列表 sortBy 白名单（规格 §14.3）。
 * 白名单外的 sortBy 返回 VALIDATION_FAILED；未传时统一 createdAt desc。
 */
export const ROLE_SORT_FIELDS = ['code', 'name', 'status', 'createdAt'] as const

/** 角色排序字段联合类型：由 ROLE_SORT_FIELDS 推导 */
export type RoleSortField = (typeof ROLE_SORT_FIELDS)[number]

/**
 * 角色列表 keyword 匹配字段（规格 §14.3）。
 * keyword 去除首尾空白后对 code/name 做不区分大小写包含匹配。
 */
export const ROLE_KEYWORD_FIELDS = ['code', 'name'] as const

/**
 * 超级管理员角色标识（规格 §5.1）。
 * code 固定为 admin，前端视作拥有通配权限 '*'；后端仍逐接口鉴权。
 */
export const ADMIN_ROLE_CODE = 'admin'

/**
 * 角色管理页面 i18n 命名空间（规格 §12）。
 * 与 en-US 资源文件名一致，经路由 meta.i18nNamespaces 声明后按需加载。
 */
export const ROLE_I18N_NAMESPACE = 'role'
