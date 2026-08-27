/**
 * 请求基础设施常量：超时、稳定错误码、协议默认值。
 */

/** API 基础路径默认值；可被 VITE_API_BASE_URL 覆盖 */
export const DEFAULT_API_BASE_URL = '/api/v1'

/** 常规请求超时（毫秒） */
export const REQUEST_TIMEOUT_MS = 15_000

/** 刷新令牌请求超时（毫秒） */
export const REFRESH_TIMEOUT_MS = 10_000

/** 刷新令牌单飞锁的过期时间（毫秒），防止异常时永久锁死 */
export const REFRESH_LOCK_TTL_MS = 10_000

/** 协议稳定错误码（RFC 9457 problem+json body.code），<MODULE>.<REASON> 点分格式 */
export const API_ERROR_CODES = {
  /** 401 认证失效统一码 */
  UNAUTHENTICATED: 'AUTH.UNAUTHENTICATED',
  /** 422 校验失败 */
  VALIDATION_FAILED: 'VALIDATION.FAILED',
} as const

/** 前端本地生成的稳定错误码（后端不会返回） */
export const CLIENT_ERROR_CODES = {
  /** 网络不可达 / 请求被拦截 */
  NETWORK_ERROR: 'CLIENT.NETWORK_ERROR',
  /** 主动取消（切换页签、刷新页签等） */
  CANCELLED: 'CLIENT.CANCELLED',
  /** 响应体不是合法 JSON */
  MALFORMED_RESPONSE: 'CLIENT.MALFORMED_RESPONSE',
  /** 未知后端错误（无 code 字段） */
  UNKNOWN: 'CLIENT.UNKNOWN',
} as const

/** 分页默认页大小；与后端协议一致 */
export const DEFAULT_PAGE_SIZE = 20

/** 分页页大小上下界（含）；与后端协议一致 */
export const PAGE_SIZE_MIN = 1
export const PAGE_SIZE_MAX = 100
