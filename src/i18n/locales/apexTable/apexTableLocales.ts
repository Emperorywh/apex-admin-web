/**
 * ApexTableReact 多语言文案解析（T00.5 表格公共设施）。
 *
 * - 包 apex-table-react 内置仅 zhCN；en-US/zh-TW/ja-JP/ko-KR 由本项目交付（同目录分片）；
 * - 简体中文不复制第二份：zh-CN 直接复用包内 zhCN，保证包升级文案同步；
 * - 解析为纯函数：入参任意语言标记（BCP-47 宽松匹配），永返回完整 ApexLocale，
 *   未知语言回退 zhCN（与 i18n fallbackLng=zh-CN 一致，不做半套语言）；
 * - 本函数不依赖 i18next：T00.8 五语言基座扩展语言清单后此处自动可用。
 */

import type { ApexLocale } from 'apex-table-react'
import { zhCN } from 'apex-table-react'
import { enUS } from '@/i18n/locales/apexTable/enUS'
import { jaJP } from '@/i18n/locales/apexTable/jaJP'
import { koKR } from '@/i18n/locales/apexTable/koKR'
import { zhTW } from '@/i18n/locales/apexTable/zhTW'

/** 语言标记 → 表格文案资源的匹配规则（前缀匹配，地区变体自动归并） */
export function resolveApexLocale(language: string | null | undefined): ApexLocale {
  // 归一为小写便于匹配（zh-TW/zh-TW-Hant/en-US/en 等形态统一处理）
  const normalized = language?.toLowerCase() ?? ''

  // 繁体在前：zh-tw/zh-hk/zh-hant 归繁中，避免被 zh 通配吞掉
  if (
    normalized.startsWith('zh-tw') ||
    normalized.startsWith('zh-hk') ||
    normalized.startsWith('zh-hant') ||
    normalized === 'zh-hant-tw'
  ) {
    return zhTW
  }
  if (normalized.startsWith('en')) return enUS
  if (normalized.startsWith('ja')) return jaJP
  if (normalized.startsWith('ko')) return koKR

  // 其余 zh-*（zh-cn/zh/zh-sg 等）与未知语言一律简中：包内置是唯一简中事实源
  return zhCN
}
