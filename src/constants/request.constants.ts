/**
 * 请求协议常量：超时、稳定错误码与请求协议默认值（规格 §3.6 所有权表、§7、§14.3）。
 * axios 实例配置与业务 service 一律引用本文件，禁止在调用点内联这些值。
 */

/** 请求超时时间，单位：毫秒（规格 §7.4）。axios 实例 timeout 与 refresh 专用实例共用。 */
export const REQUEST_TIMEOUT_MS = 15_000

/** 成功 envelope 固定业务码（规格 §7.1）。成功条件为 HTTP 2xx 且 code === 0。 */
export const API_SUCCESS_CODE = 0

/**
 * 跨前后端稳定的机器可读错误码全集（规格 §7.1/§14.4）。
 * 新增错误码必须同步更新接口契约与 i18n 映射；
 * 程序分支只能依赖 errorCode，不得依赖 message 文案。
 */
export const API_ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  AUTH_ACCESS_EXPIRED: 'AUTH_ACCESS_EXPIRED',
  AUTH_REFRESH_EXPIRED: 'AUTH_REFRESH_EXPIRED',
  AUTH_PERMISSION_CHANGED: 'AUTH_PERMISSION_CHANGED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

/** 稳定错误码联合类型：由 API_ERROR_CODES 推导，避免另写一份可能漂移的字符串联合 */
export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

/** 分页页码起始值与默认值（规格 §14.3：分页从 1 开始） */
export const PAGE_DEFAULT = 1

/** 分页每页条数默认值，单位：条（规格 §14.3） */
export const PAGE_SIZE_DEFAULT = 10

/** 分页每页条数上限，单位：条（规格 §14.3：最大 100；超出由守卫或后端判为非法） */
export const PAGE_SIZE_MAX = 100

/** 列表排序方向枚举（规格 §14.3：sortOrder 取 asc | desc） */
export const SORT_ORDERS = {
  ASC: 'asc',
  DESC: 'desc',
} as const

/** 排序方向联合类型：由 SORT_ORDERS 推导 */
export type SortOrder = (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS]

/** 列表默认排序字段（规格 §14.3：未传 sortBy 时统一按 createdAt desc） */
export const DEFAULT_SORT_BY = 'createdAt'

/** 列表默认排序方向，与 DEFAULT_SORT_BY 配套使用（规格 §14.3） */
export const DEFAULT_SORT_ORDER: SortOrder = SORT_ORDERS.DESC

/**
 * 全局请求作用域标识（规格 §7.3/§7.4）。
 * 全局 profile 与权限刷新请求使用该 scopeId，不进入任何页面页签作用域，
 * 因此不会被页签隐藏/关闭/淘汰时的作用域取消误杀。
 */
export const GLOBAL_REQUEST_SCOPE = 'global'
