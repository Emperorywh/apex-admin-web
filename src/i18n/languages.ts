/**
 * 语言选择与规范化（规格 §12）。
 * 语言固定为 zh-CN（默认）/ en-US：持久化设置优先；未持久化时按规范化后的
 * navigator.language 选择——zh-* 映射 zh-CN，其余未支持语言统一回退 zh-CN。
 */
import { SETTINGS_LANGUAGES, type SettingsLanguage } from '@/store/slices/settings.slice'

/** 读取浏览器首选语言；非浏览器环境（无 navigator）返回 undefined */
export function readNavigatorLanguage(): string | undefined {
  if (typeof navigator === 'undefined') {
    return undefined
  }
  return navigator.language || undefined
}

/**
 * 规范化为受支持语言（规格 §12）：
 * 'en-US'（大小写不敏感）→ en-US；其余取值（含 zh、zh-*、en、en-GB 与未知语言）
 * 统一回退 zh-CN。
 */
export function normalizeSupportedLanguage(language: string | undefined): SettingsLanguage {
  if (language !== undefined && language.toLowerCase() === SETTINGS_LANGUAGES.EN_US.toLowerCase()) {
    return SETTINGS_LANGUAGES.EN_US
  }
  return SETTINGS_LANGUAGES.ZH_CN
}

/**
 * 解析初始语言（规格 §12）：
 * 1. 持久化设置优先——settings.language 已通过 persist 迁移的枚举校验，直接采信；
 * 2. 否则按规范化后的 navigator.language 选择；
 * 3. 无浏览器语言或未支持语言一律回退 zh-CN。
 */
export function resolveInitialLanguage(
  persistedLanguage: SettingsLanguage | undefined,
  navigatorLanguage: string | undefined,
): SettingsLanguage {
  return persistedLanguage ?? normalizeSupportedLanguage(navigatorLanguage)
}
