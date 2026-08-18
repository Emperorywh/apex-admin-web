/**
 * 用户管理业务域常量（规格 §14.3）：排序与查询字段白名单、字段约束。
 * 用户页面、feature 组件/Hook、user service 与 demo adapter 一律引用本文件，
 * 禁止在任意调用点重复这些字面量；接口路径由 user service 在调用点内联（规格 §14.3 v1.8）。
 */

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

/**
 * 用户管理页面 i18n 命名空间（规格 §12）：
 * 路由 meta.i18nNamespaces 声明该值，en-US 资源文件为
 * src/i18n/locales/en-US/user.ts（文件名即命名空间）。
 */
export const USER_I18N_NAMESPACE = 'user'
