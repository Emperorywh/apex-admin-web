/**
 * i18next 初始化与命名空间基础设施（规格 §12）。
 *
 * - 中文文案即 key：keySeparator 与 nsSeparator 均为 false，键中的 `.` 与 `:` 不作分隔符；
 *   zh-CN 不维护资源文件，缺 key 返回 key 本身（缺失键同样参与插值）。
 * - en-US 资源按命名空间懒加载：src/i18n/locales/en-US/<ns>.ts 文件名即命名空间，
 *   common 与 menu 为基础命名空间，路由命名空间经 meta.i18nNamespaces 声明后新增文件即可扩展。
 * - 首次进入英文页面前由调用方预加载 common、menu 与目标路由命名空间，
 *   加载完成后一次性渲染（PageLoading 期间显示）。
 * - 切换语言前先加载 common、menu 与所有已打开页签声明命名空间的并集再 changeLanguage，
 *   避免缓存页签出现半中文半英文；切换同时同步 dayjs locale、antd locale 取值、
 *   <html lang> 与 document.title。
 */
import { createInstance, type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { SETTINGS_LANGUAGES, type SettingsLanguage } from '@/store/slices/settings.slice'
import { normalizeSupportedLanguage, readNavigatorLanguage, resolveInitialLanguage } from './languages'
import { applyDayjsLocale, syncDocumentLanguage } from './localeSync'

/** 基础命名空间之一：通用文案与 API errorCode 本地化文案（规格 §12） */
export const COMMON_NAMESPACE = 'common'

/** 基础命名空间之二：路由标题、菜单与面包屑文案（规格 §12） */
export const MENU_NAMESPACE = 'menu'

/** 基础命名空间全集：首次进入英文页面与切换语言前必须就绪（规格 §12） */
export const I18N_BASE_NAMESPACES = [COMMON_NAMESPACE, MENU_NAMESPACE] as const

/**
 * en-US 命名空间懒加载注册表：文件名（不含扩展名）即命名空间，
 * 新增 <ns>.ts 文件即可扩展路由命名空间，无需修改本文件。
 */
const enUsNamespaceLoaders = import.meta.glob<Record<string, string>>('./locales/en-US/*.ts', {
  import: 'default',
})

/** 进行中的命名空间加载：同一命名空间并发调用共享同一 Promise，失败后清除以便重试 */
const inFlightNamespaceLoads = new Map<string, Promise<void>>()

/** 加载单个 en-US 命名空间并登记到实例；资源文件缺失的命名空间以错误拒绝 */
function loadEnUsNamespace(i18n: I18nInstance, namespace: string): Promise<void> {
  const cacheKey = `${SETTINGS_LANGUAGES.EN_US}:${namespace}`
  const inFlight = inFlightNamespaceLoads.get(cacheKey)
  if (inFlight !== undefined) {
    return inFlight
  }
  if (i18n.hasResourceBundle(SETTINGS_LANGUAGES.EN_US, namespace)) {
    return Promise.resolve()
  }
  const loader = enUsNamespaceLoaders[`./locales/en-US/${namespace}.ts`]
  const load = loader
    ? loader().then((resources) => {
        i18n.addResourceBundle(SETTINGS_LANGUAGES.EN_US, namespace, resources, true, true)
      })
    : Promise.reject(new Error(`未找到 en-US 命名空间资源文件：src/i18n/locales/en-US/${namespace}.ts`))
  const settled = load.finally(() => {
    inFlightNamespaceLoads.delete(cacheKey)
  })
  inFlightNamespaceLoads.set(cacheKey, settled)
  return settled
}

/** 命名空间列表去重，保持首次出现顺序 */
function uniqueNamespaces(namespaces: readonly string[]): string[] {
  return [...new Set(namespaces)]
}

export interface CreateI18nOptions {
  /** 持久化恢复的语言设置；undefined 表示尚未恢复或无持久化（规格 §12：持久化优先） */
  persistedLanguage?: SettingsLanguage
  /** 浏览器首选语言；缺省读取 navigator.language */
  navigatorLanguage?: string
}

/** 当前文档标题：中文标题 key 与所属命名空间；语言切换时据此重译（规格 §12） */
interface DocumentTitle {
  key: string
  ns: string
}

/** 每个实例独立的当前标题登记，避免工厂实例之间互相串值 */
const documentTitles = new WeakMap<I18nInstance, DocumentTitle>()

/** 按登记的标题 key 重译 document.title；未设置标题时不改动 */
function reapplyDocumentTitle(i18n: I18nInstance): void {
  const title = documentTitles.get(i18n)
  if (title === undefined) {
    return
  }
  document.title = i18n.t(title.key, { ns: title.ns })
}

/**
 * 创建并初始化 i18next 实例：
 * - 同步完成初始化（无 backend，资源全部经 ensureNamespacesLoaded 显式预加载）；
 * - languageChanged 时同步 dayjs locale、<html lang> 并重译 document.title；
 * - 初始语言的 dayjs 与 <html lang> 同样立即对齐，避免首屏日期语言漂移。
 */
export function createI18n(options: CreateI18nOptions = {}): I18nInstance {
  const instance = createInstance()
  instance.use(initReactI18next)
  const initialLanguage = resolveInitialLanguage(
    options.persistedLanguage,
    options.navigatorLanguage ?? readNavigatorLanguage(),
  )
  instance.init({
    lng: initialLanguage,
    fallbackLng: SETTINGS_LANGUAGES.ZH_CN,
    supportedLngs: [SETTINGS_LANGUAGES.ZH_CN, SETTINGS_LANGUAGES.EN_US],
    ns: [...I18N_BASE_NAMESPACES],
    defaultNS: COMMON_NAMESPACE,
    // 中文文案即 key：键中的 `.` 与 `:` 不被解释为层级/命名空间分隔符（规格 §12）
    keySeparator: false,
    nsSeparator: false,
    // React 自带 XSS 转义，插值不做二次转义；<Trans> 富文本依赖该设置
    interpolation: { escapeValue: false },
    // 渲染时机由调用方的预加载闸门控制（PageLoading），不由 i18next suspense 挂起
    react: { useSuspense: false },
    // 初始资源为空对象：本模块不注册 backend，en-US 资源全部经 ensureNamespacesLoaded
    // 手动登记；空 resources 使 init 与 changeLanguage 同步完成，且不触发 backend 加载告警
    resources: {},
  })
  instance.on('languageChanged', (lng) => {
    applyDayjsLocale(lng)
    syncDocumentLanguage(lng)
    reapplyDocumentTitle(instance)
  })
  applyDayjsLocale(initialLanguage)
  syncDocumentLanguage(initialLanguage)
  return instance
}

export interface EnsureNamespacesOptions {
  /**
   * 目标语言；缺省取实例当前语言。
   * zh-CN 不维护资源文件，目标语言非 en-US 时直接视为已就绪。
   */
  language?: string
}

/**
 * 预加载命名空间（规格 §12）：
 * - 首次进入英文页面前预加载 common、menu 与目标路由命名空间，加载完成后调用方
 *   一次性渲染页面（PageLoading 期间显示）；
 * - 幂等且并发安全：已加载或加载中的命名空间不会重复加载；
 * - en-US 下资源文件缺失的命名空间以错误拒绝，调用方需修正声明或补齐资源文件。
 */
export function ensureNamespacesLoaded(
  i18n: I18nInstance,
  namespaces: readonly string[],
  options: EnsureNamespacesOptions = {},
): Promise<void> {
  const language = options.language ?? i18n.resolvedLanguage ?? i18n.language
  if (normalizeSupportedLanguage(language) !== SETTINGS_LANGUAGES.EN_US) {
    return Promise.resolve()
  }
  const loads = uniqueNamespaces(namespaces).map((namespace) => loadEnUsNamespace(i18n, namespace))
  return Promise.all(loads).then(() => undefined)
}

export interface ChangeAppLanguageOptions {
  /**
   * 除基础命名空间外需在切换前一并加载的命名空间：
   * 调用方应传入所有已打开页签声明命名空间的并集（规格 §12），
   * 避免 changeLanguage 后缓存页签出现半中文半英文。
   */
  extraNamespaces?: readonly string[]
}

/**
 * 切换应用语言（规格 §12）：先加载 common、menu 与 extraNamespaces 的并集，
 * 资源全部就绪后再 changeLanguage 一次性切换；切换同时经 languageChanged
 * 同步 dayjs locale、<html lang> 与 document.title（antd locale 取值由
 * ConfigProvider 按 getAntdLocale(当前语言) 跟随）。未支持语言值统一回退 zh-CN。
 */
export async function changeAppLanguage(
  i18n: I18nInstance,
  language: string,
  options: ChangeAppLanguageOptions = {},
): Promise<void> {
  const target = normalizeSupportedLanguage(language)
  const namespaces = uniqueNamespaces([...I18N_BASE_NAMESPACES, ...(options.extraNamespaces ?? [])])
  await ensureNamespacesLoaded(i18n, namespaces, { language: target })
  await i18n.changeLanguage(target)
}

/**
 * 设置当前页面标题（规格 §12）：中文标题 key 按 menu 命名空间翻译，
 * 语言切换时自动重译；路由/页签任务在路由变化时调用。
 */
export function setDocumentTitle(i18n: I18nInstance, key: string, ns: string = MENU_NAMESPACE): void {
  documentTitles.set(i18n, { key, ns })
  reapplyDocumentTitle(i18n)
}

/**
 * 应用级 i18next 单例：模块导入即按 navigator 语言完成同步初始化。
 * App 接线任务把它交给 I18nextProvider，并在持久化恢复完成后按需调用
 * changeAppLanguage 同步持久化语言设置。
 */
export const appI18n = createI18n()
