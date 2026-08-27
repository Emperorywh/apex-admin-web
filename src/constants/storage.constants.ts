/**
 * Storage 常量：key、前缀和持久化 schema 版本。
 */

/** 所有 localStorage key 的统一前缀 */
export const STORAGE_PREFIX = 'apex-admin'

/** 语言偏好 key；值为 'zh-CN' | 'en-US' */
export const STORAGE_KEYS = {
  LANGUAGE: `${STORAGE_PREFIX}:lang`,
} as const

/** redux-persist 持久化 key */
export const PERSIST_KEYS = {
  AUTH: `${STORAGE_PREFIX}:auth`,
  SETTINGS: `${STORAGE_PREFIX}:settings`,
} as const

/** 持久化 schema 版本；结构不兼容变更时递增并补 migration */
export const PERSIST_SCHEMA_VERSION = 1
