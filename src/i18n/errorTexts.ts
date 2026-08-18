/**
 * API errorCode → 前端本地化文案（规格 §7.1/§7.4/§12）：
 * 已知错误码映射为中文文案 key（中文即 key，en-US 文案维护在 locales/en-US/common.ts）；
 * 未知错误或缺失 errorCode 回退固定兜底文案，后端 message 只用于诊断、不作已翻译文案。
 * 统一提示（TASK-006）消费本助手，请求层不得直接依赖 i18next 内部结构。
 */
import { API_ERROR_CODES, type ApiErrorCode } from '@/constants/request.constants'
import { COMMON_NAMESPACE, appI18n } from './i18n'

/**
 * 已知 errorCode 的中文文案 key 全集。
 * Record<ApiErrorCode, string> 保证覆盖 §7.1 全部错误码（v1.14 真实后端点分码），缺一即编译失败；
 * 新增错误码必须同步更新 request.constants.ts、本映射与 en-US 资源文件。
 */
export const API_ERROR_MESSAGE_KEYS: Record<ApiErrorCode, string> = {
  [API_ERROR_CODES.PARAMETER_INVALID]: '请求参数不合法',
  [API_ERROR_CODES.VALIDATION_FAILED]: '请求参数校验失败',
  [API_ERROR_CODES.AUTH_INVALID_CREDENTIALS]: '用户名或密码错误',
  [API_ERROR_CODES.AUTH_UNAUTHENTICATED]: '登录状态已过期，请重新登录',
  [API_ERROR_CODES.AUTH_REFRESH_FAILED]: '登录已失效，请重新登录',
  [API_ERROR_CODES.AUTH_SESSION_NOT_FOUND]: '会话不存在，请重新登录',
  [API_ERROR_CODES.AUTH_FORBIDDEN]: '没有权限执行此操作',
  [API_ERROR_CODES.AUTH_LAST_SUPER_ADMIN]: '无法移除最后一个可用的超级管理员',
  [API_ERROR_CODES.COMMON_NOT_FOUND]: '请求的资源不存在',
  [API_ERROR_CODES.COMMON_CONFLICT]: '操作与当前状态冲突，请刷新后重试',
  [API_ERROR_CODES.DB_UNIQUE_VIOLATION]: '数据已存在，请检查后重试',
  [API_ERROR_CODES.DB_CONNECTION_ERROR]: '数据库暂时不可用，请稍后重试',
  [API_ERROR_CODES.SYSTEM_INTERNAL]: '服务器内部错误，请稍后重试',
}

/** 未知错误或缺失 errorCode 的固定兜底文案（规格 §7.4） */
export const API_ERROR_FALLBACK_TEXT = '请求失败，请稍后重试'

/**
 * 取 errorCode 的本地化文案：
 * 已知错误码返回映射文案（en-US 资源就绪时为英文，否则回退中文 key）；
 * 未知或缺失 errorCode 返回固定兜底文案。
 */
export function getApiErrorText(errorCode: string | null | undefined): string {
  const key = errorCode !== null && errorCode !== undefined ? API_ERROR_MESSAGE_KEYS[errorCode as ApiErrorCode] : undefined
  return appI18n.t(key ?? API_ERROR_FALLBACK_TEXT, { ns: COMMON_NAMESPACE })
}
