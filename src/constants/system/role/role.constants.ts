/**
 * 角色管理业务域常量（对齐真实后端 rbac 模块）：
 * 排序白名单与角色编码约束的唯一所有者。
 * 角色页面、feature 组件/Hook 与 role service 一律引用本文件；
 * 接口路径由 role service 在调用点内联（规格 §14.3 v1.8）。
 */

/**
 * 角色列表 sort 白名单（后端 rbac _ROLE_SORT_FIELDS，camelCase 发送）。
 * 白名单外字段由后端返回 400 PARAMETER.INVALID；列表接口无 keyword 搜索，仅 status 筛选。
 */
export const ROLE_SORT_FIELDS = ['code', 'displayName', 'createdAt', 'updatedAt'] as const

/** 角色排序字段联合类型：由 ROLE_SORT_FIELDS 推导 */
export type RoleSortField = (typeof ROLE_SORT_FIELDS)[number]

/**
 * 角色编码格式校验（后端 RoleCreateRequest pattern）：小写字母开头，仅小写字母/数字/下划线。
 * 创建角色表单的前置校验使用，code 全局唯一且创建后不可修改。
 */
export const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_]*$/

/**
 * 超级管理员角色标识（规格 §5.1）。
 * 前端内部通配语义标记（权限判定与菜单放行）；后端真实超管角色码为 super_admin，
 * 前端按 username 注入本标记（auth service，规格 §6.3 v1.15），后端仍逐接口鉴权。
 */
export const ADMIN_ROLE_CODE = 'admin'

/**
 * 角色管理页面 i18n 命名空间（规格 §12）。
 * 与 en-US 资源文件名一致，经路由 meta.i18nNamespaces 声明后按需加载。
 */
export const ROLE_I18N_NAMESPACE = 'role'
