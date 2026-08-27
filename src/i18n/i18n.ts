/**
 * i18next 初始化与语言治理。
 *
 * - key 即中文文案：keySeparator/nsSeparator 关闭，zh-CN 不维护资源文件
 * - en-US 资源按命名空间懒加载（路由通过 meta.i18nNamespaces 声明）
 * - 切换语言先预加载基础与已打开页签命名空间并集，再 changeLanguage（SPEC §6）
 */

import i18next, { type BackendModule, type CallbackError } from 'i18next'
import dayjs from 'dayjs'
import { initReactI18next } from 'react-i18next'
import 'dayjs/locale/zh-cn'

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: AppLanguage = 'zh-CN'

/** 语言偏好 localStorage key */
const STORAGE_KEY_LANGUAGE = 'apex-admin:lang'

/** 基础命名空间，所有页面共享 */
export const BASE_NAMESPACES = ['common', 'menu'] as const

/** en-US 命名空间懒加载表 */
const enUsLoaders: Record<string, () => Promise<{ default: Record<string, string> }>> = {
  common: () => import('@/i18n/locales/en-US/common'),
  menu: () => import('@/i18n/locales/en-US/menu'),
  auth: () => import('@/i18n/locales/en-US/auth'),
  dashboard: () => import('@/i18n/locales/en-US/dashboard'),
  profile: () => import('@/i18n/locales/en-US/profile'),
  system: () => import('@/i18n/locales/en-US/system'),
  error: () => import('@/i18n/locales/en-US/error'),
}

/** zh-* 一律映射 zh-CN；其余未支持语言回退 zh-CN（SPEC §6） */
export function normalizeLanguage(raw: string | null | undefined): AppLanguage {
  if (raw?.toLowerCase().startsWith('en')) return 'en-US'
  return 'zh-CN'
}

function readStoredLanguage(): AppLanguage {
  try {
    return normalizeLanguage(localStorage.getItem(STORAGE_KEY_LANGUAGE))
  } catch {
    return DEFAULT_LANGUAGE
  }
}

function persistLanguage(language: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY_LANGUAGE, language)
  } catch {
    // 隐私模式等场景下静默失败
  }
}

/** 命名空间懒加载后端：zh-CN 直接返回空资源（key 即文案） */
const lazyBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    if (language === 'zh-CN') {
      callback(null, {})
      return
    }
    const loader = enUsLoaders[namespace]
    if (!loader) {
      callback(new Error(`未知命名空间：${namespace}`), null)
      return
    }
    loader()
      .then((mod) => callback(null, mod.default))
      .catch((err: unknown) => callback(err as CallbackError, null))
  },
}

const initialLanguage = readStoredLanguage()

if (!i18next.isInitialized) {
  void i18next.use(lazyBackend).use(initReactI18next).init({
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    ns: [...BASE_NAMESPACES],
    defaultNS: 'common',
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: true },
    partialBundledLanguages: true,
  })
  dayjs.locale(initialLanguage === 'zh-CN' ? 'zh-cn' : 'en')
  document.documentElement.lang = initialLanguage
}

/** 预加载指定语言的命名空间集合（zh-CN 无需加载） */
export async function preloadNamespaces(language: AppLanguage, namespaces: readonly string[]): Promise<void> {
  if (language === 'zh-CN') return
  const pending = [...new Set(namespaces)].map(
    (namespace) =>
      new Promise<void>((resolve, reject) => {
        i18next.services.backendConnector.read(language, namespace, (err: unknown) => {
          if (err) reject(err)
          else resolve()
        })
      }),
  )
  await Promise.all(pending)
}

/**
 * 切换语言：先加载基础与额外命名空间并集，再统一 changeLanguage，
 * 同时切换 dayjs locale 与 document lang，避免缓存页签出现半中文半英文。
 */
export async function changeAppLanguage(
  language: AppLanguage,
  extraNamespaces: readonly string[] = [],
): Promise<void> {
  await preloadNamespaces(language, [...BASE_NAMESPACES, ...extraNamespaces])
  await i18next.changeLanguage(language)
  persistLanguage(language)
  dayjs.locale(language === 'zh-CN' ? 'zh-cn' : 'en')
  document.documentElement.lang = language
}

export default i18next
