/**
 * 车辆告警码多语言描述支持的语言类型选项（P08）。
 *
 * locale 取值与后端约定枚举一致（与本项目国际化语言代码一一对应）；
 * 标签为各语言自称（原样不译），选项顺序与旧实现保持一致。
 */

import type { SelectProps } from 'antd'

/** 多语言描述行可选语言（locale 原样提交协议，标签为语言自称） */
export const ALARM_LOCALE_OPTIONS: NonNullable<SelectProps['options']> = [
  { label: '简体中文', value: 'zh_CN' },
  { label: 'English', value: 'en_US' },
  { label: '日本語', value: 'ja_JP' },
  { label: '한국어', value: 'ko_KR' },
  { label: '繁體中文', value: 'zh_TW' },
]

/** 按语言代码取展示名；未匹配时原样返回（未知 locale 不猜语义，规格 11.2） */
export function getAlarmLocaleLabel(locale?: string): string {
  const found = ALARM_LOCALE_OPTIONS.find((item) => item?.value === locale)
  return (found?.label as string) || locale || ''
}
