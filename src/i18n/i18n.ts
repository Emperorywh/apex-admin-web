/**
 * i18next 初始化与语言治理（五语运行时，T016）。
 *
 * - key 即中文文案：keySeparator/nsSeparator 关闭，zh-CN 不维护资源文件
 * - en-US / zh-TW / ja-JP / ko-KR 资源按命名空间懒加载
 *   （路由通过 meta.i18nNamespaces 声明，资源文件位于 src/i18n/locales/<语言>/<命名空间>.ts）
 * - 切换语言先预加载基础与已打开页签命名空间并集，再 changeLanguage；
 *   changeLanguage 完成前界面保持旧语言完整文案，异步旧语言响应不会覆盖新语言
 * - dayjs locale 与 document lang 随切换同步，保证缓存页签日期文案一致
 */

import i18next, { type BackendModule, type CallbackError } from 'i18next'
import dayjs from 'dayjs'
import { initReactI18next } from 'react-i18next'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import 'dayjs/locale/zh-tw'
import 'dayjs/locale/ja'
import 'dayjs/locale/ko'

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US', 'zh-TW', 'ja-JP', 'ko-KR'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]
/** 非 zh-CN 语言：需要维护资源文件并参与懒加载 */
export type LoadedLanguage = Exclude<AppLanguage, 'zh-CN'>
export const DEFAULT_LANGUAGE: AppLanguage = 'zh-CN'

/** 语言偏好 localStorage key */
const STORAGE_KEY_LANGUAGE = 'apex-admin:lang'

/** 基础命名空间，所有页面共享 */
export const BASE_NAMESPACES = ['common', 'menu'] as const

/**
 * dayjs locale 映射表（对齐旧系统 app.tsx DAYJS_LOCALE_MAP）：
 * 跟随语言切换同步更新日期格式化与星期文案，覆盖全部五语，
 * 避免日/韩/繁中界面混入简中日期文案。
 */
export const DAYJS_LOCALE_MAP: Record<AppLanguage, string> = {
  'zh-CN': 'zh-cn',
  'en-US': 'en',
  'zh-TW': 'zh-tw',
  'ja-JP': 'ja',
  'ko-KR': 'ko',
}

/**
 * 五语资源懒加载表（Vite 静态分析 import.meta.glob，按语言×命名空间拆 chunk）：
 * 文件路径约定 `./locales/<语言>/<命名空间>.ts`，新增命名空间或语言文件后自动纳入。
 */
const localeModules = import.meta.glob<{ default: Record<string, string> }>('./locales/*/*.ts')

/** 按语言与命名空间解析资源加载器；未登记的路径视为未知命名空间 */
function resolveLocaleLoader(
  language: LoadedLanguage,
  namespace: string,
): (() => Promise<{ default: Record<string, string> }>) | undefined {
  return localeModules[`./locales/${language}/${namespace}.ts`]
}

/**
 * 语言归一化：zh-* 一律落 zh-CN 或 zh-TW；ja/ko 前缀各归其位；
 * 其余未支持语言回退默认语言。与旧系统 umi 插件行为对齐（默认 zh-CN）。
 */
export function normalizeLanguage(raw: string | null | undefined): AppLanguage {
  const value = raw?.trim().toLowerCase()
  if (!value) return DEFAULT_LANGUAGE
  if (value.startsWith('en')) return 'en-US'
  if (value.startsWith('ja')) return 'ja-JP'
  if (value.startsWith('ko')) return 'ko-KR'
  if (value.startsWith('zh-tw') || value.startsWith('zh_tw') || value.startsWith('zh-hant')) return 'zh-TW'
  return 'zh-CN'
}

/** 读取持久化语言偏好（无偏好或不可读时回退默认语言）；供 i18n 初始化与 settings 切片共用 */
export function readStoredLanguage(): AppLanguage {
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

/** 命名空间懒加载后端：zh-CN 直接返回空资源（key 即文案），其余语言读对应资源模块 */
const lazyBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    if (language === 'zh-CN') {
      callback(null, {})
      return
    }
    const loader = resolveLocaleLoader(language as LoadedLanguage, namespace)
    if (!loader) {
      callback(new Error(`未知命名空间：${language}/${namespace}`), null)
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
  dayjs.locale(DAYJS_LOCALE_MAP[initialLanguage])
  document.documentElement.lang = initialLanguage
}

/** 预加载指定语言的命名空间集合（zh-CN 无需加载；backendConnector.load 自带缓存与去重） */
export async function preloadNamespaces(language: AppLanguage, namespaces: readonly string[]): Promise<void> {
  if (language === 'zh-CN') return
  const unique = [...new Set(namespaces)]
  if (!unique.length) return
  await new Promise<void>((resolve, reject) => {
    i18next.services.backendConnector.load([language], unique, (err: unknown) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

/**
 * 切换语言：先加载基础与额外命名空间并集，再统一 changeLanguage，
 * 同时切换 dayjs locale 与 document lang，避免缓存页签出现混合语言。
 * changeLanguage 在资源全部就绪后一次性生效：切换期间完成中的旧语言
 * 异步响应只会写回旧语言缓存，不会把新界面文案覆盖成旧语言。
 */
export async function changeAppLanguage(
  language: AppLanguage,
  extraNamespaces: readonly string[] = [],
): Promise<void> {
  await preloadNamespaces(language, [...BASE_NAMESPACES, ...extraNamespaces])
  await i18next.changeLanguage(language)
  persistLanguage(language)
  dayjs.locale(DAYJS_LOCALE_MAP[language])
  document.documentElement.lang = language
}

export default i18next
