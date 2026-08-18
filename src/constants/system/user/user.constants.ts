/**
 * 用户管理业务域常量（对齐真实后端 identity 模块）：
 * 排序白名单与字段约束的唯一所有者。
 * 用户页面、feature 组件/Hook 与 user service 一律引用本文件，
 * 禁止在任意调用点重复这些字面量；接口路径由 user service 在调用点内联（规格 §14.3 v1.8）。
 */

/**
 * 用户列表 sort 白名单（后端 identity _USER_SORT_FIELDS，camelCase 发送）。
 * 白名单外字段由后端返回 400 PARAMETER.INVALID；列表接口无 keyword 搜索，仅 status 筛选。
 */
export const USER_SORT_FIELDS = ['username', 'displayName', 'createdAt', 'updatedAt'] as const

/** 用户排序字段联合类型：由 USER_SORT_FIELDS 推导 */
export type UserSortField = (typeof USER_SORT_FIELDS)[number]

/**
 * 用户邮箱格式校验正则（后端 Pydantic email 校验的前置 UX 版本）。
 * 采用务实格式：非空本地部分 + @ + 域名 + 顶级域，不做完整 RFC 校验；
 * 创建与编辑用户、个人中心资料表单共用。
 */
export const USER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 用户管理页面 i18n 命名空间（规格 §12）：
 * 路由 meta.i18nNamespaces 声明该值，en-US 资源文件为
 * src/i18n/locales/en-US/user.ts（文件名即命名空间）。
 */
export const USER_I18N_NAMESPACE = 'user'
