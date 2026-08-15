/**
 * 环境级 locale 同步（规格 §12）：切换语言时同步 dayjs 全局 locale、
 * 提供 antd ConfigProvider 的 locale 取值，并同步 document.documentElement.lang。
 * document.title 的重译由 i18n.ts 持有的标题 key 完成，不在此处依赖 i18next 实例。
 */
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { SETTINGS_LANGUAGES, type SettingsLanguage } from '@/store/slices/settings.slice'
import { normalizeSupportedLanguage } from './languages'

/** dayjs 全局 locale 名映射：en 为 dayjs 内置默认 locale，无需额外注册资源模块 */
const DAYJS_LOCALE_NAMES: Record<SettingsLanguage, string> = {
  [SETTINGS_LANGUAGES.ZH_CN]: 'zh-cn',
  [SETTINGS_LANGUAGES.EN_US]: 'en',
}

/** 同步 dayjs 全局 locale（规格 §12）：日期组件与格式化随语言切换 */
export function applyDayjsLocale(language: string): void {
  dayjs.locale(DAYJS_LOCALE_NAMES[normalizeSupportedLanguage(language)])
}

/** antd locale 对象类型：由 zh_CN 与 en_US 官方资源组成 */
export type AntdLocale = typeof zhCN | typeof enUS

/** 取 antd locale 对象：ConfigProvider 的 locale 取值经本函数随当前语言切换（规格 §12） */
export function getAntdLocale(language: string): AntdLocale {
  return normalizeSupportedLanguage(language) === SETTINGS_LANGUAGES.EN_US ? enUS : zhCN
}

/** 同步 <html lang>（规格 §12）：未支持语言值先规范化再写入 */
export function syncDocumentLanguage(language: string): void {
  document.documentElement.lang = normalizeSupportedLanguage(language)
}
