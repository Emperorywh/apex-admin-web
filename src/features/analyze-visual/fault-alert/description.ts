/**
 * 告警描述多语言解析（P36 私有；旧 FaultAlert/model/selectors.ts
 * resolveFaultDescription 等价迁移，明细表描述列与行展开详情共用）。
 *
 * 回退链（旧实现同口径，与回放 ErrorEntryTable 组件一致）：
 * 当前语言 → zh_CN → en_US → errorDescription 原文；
 * translationValue 为空白视为未命中，继续回退；全部未命中返回原文（可能为空串）。
 * 错误建议（errorHintTranslations）同链路复用。
 */

import type { AlarmErrorModelDto, AlarmTranslationDto } from '@/services/report-fault/report-fault.service.types'

/**
 * 把任意风格的语言标识归一化为 "lang_REGION"（lang 小写、region 大写）。
 * 后端 translationKey 下发 en_US / zh_CN（下划线分隔），项目 locale 为
 * zh-CN / en-US / zh-TW / ja-JP / ko-KR（连字符），比较前先归一化两侧。
 */
function normalizeLocaleKey(key: string | undefined): string {
  if (!key) return ''
  const parts = key.replace(/-/g, '_').split('_')
  const lang = (parts[0] || '').toLowerCase()
  const region = (parts[1] || '').toUpperCase()
  return region ? `${lang}_${region}` : lang
}

/** 在译文列表中按回退链取第一个非空白命中值；未命中返回 undefined */
function pickTranslation(
  translations: AlarmTranslationDto[] | undefined,
  locale: string,
): string | undefined {
  const list = Array.isArray(translations) ? translations : []
  const want = normalizeLocaleKey(locale)
  for (const target of [want, 'zh_CN', 'en_US']) {
    if (!target) continue
    const hit = list.find((item) => item && normalizeLocaleKey(item.translationKey) === target)
    if (hit && typeof hit.translationValue === 'string' && hit.translationValue.trim() !== '') {
      return hit.translationValue
    }
  }
  return undefined
}

/**
 * 解析告警描述展示文本：译文回退链未命中时退回 errorDescription 原文。
 * 服务端原文/日志类内容不猜测翻译（规格 18.3），全空返回空串（单元格留白）。
 */
export function resolveAlarmText(
  model: AlarmErrorModelDto | null | undefined,
  pick: 'description' | 'hint',
  locale: string,
): string {
  if (!model) return ''
  if (pick === 'description') {
    return (
      pickTranslation(model.errorDescriptionTranslations, locale) ??
      (typeof model.errorDescription === 'string' ? model.errorDescription : '')
    )
  }
  // 错误建议无原文兜底字段，仅译文回退链（zh_CN → en_US），未命中留白
  return pickTranslation(model.errorHintTranslations, locale) ?? ''
}
