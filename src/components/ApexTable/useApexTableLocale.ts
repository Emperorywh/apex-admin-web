/**
 * 表格文案 Hook：把应用当前语言接到 ApexTable 内置文案（T016 合同 §6 唯一映射）。
 *
 * - 语言来源是 i18next 当前语言（App 切换时序由 T016 统一保证），
 *   经 `normalizeLanguage` 归一后查五语包，页面不自建第二份映射；
 * - `useTranslation` 订阅了语言变更事件，切换语言时本 Hook 触发重渲，
 *   表格以新 locale 重挂内置控件文案。
 */

import { useTranslation } from 'react-i18next'
import { normalizeLanguage } from '@/i18n/i18n'
import type { ApexLocale } from 'apex-table-react'
import { resolveApexTableLocale } from './apexTableLocales'

/** 返回当前语言对应的完整表格文案包 */
export function useApexTableLocale(): ApexLocale {
  const { i18n } = useTranslation()
  return resolveApexTableLocale(normalizeLanguage(i18n.language))
}
