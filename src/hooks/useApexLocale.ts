/**
 * ApexTableReact 当前语言文案 Hook（T00.5 表格公共设施）。
 *
 * 用法（页面任务直接组装到包组件，本 hook 不包裹表格）：
 *   const apexLocale = useApexLocale()
 *   <ApexTableReact locale={apexLocale} ... />
 *
 * - 文案随 i18next 当前语言联动；语言切换时 useTranslation 订阅触发重渲染，
 *   表格控件文案即时更新，不需要刷新页面（DoD「动态重算」）；
 * - 资源解析见 resolveApexLocale：未知语言回退简中，五语言资源在 T00.8
 *   扩展语言清单后自动生效。
 */

import { useTranslation } from 'react-i18next'
import type { ApexLocale } from 'apex-table-react'
import { resolveApexLocale } from '@/i18n/locales/apexTable/apexTableLocales'

export function useApexLocale(): ApexLocale {
  // useTranslation 与 i18next 语言事件绑定：resolvedLanguage 变化即重渲染
  const { i18n } = useTranslation()
  // resolvedLanguage 理论上恒有值；兜底原始 language（resolveApexLocale 自身还会兜底）
  return resolveApexLocale(i18n.resolvedLanguage ?? i18n.language)
}
