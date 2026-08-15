/** 语言规范化与初始语言选择规则（规格 §12）单测 */
import { describe, expect, it } from 'vitest'
import { SETTINGS_LANGUAGES } from '@/store/slices/settings.slice'
import { normalizeSupportedLanguage, readNavigatorLanguage, resolveInitialLanguage } from './languages'

describe('normalizeSupportedLanguage', () => {
  it('zh-* 与 zh 统一映射 zh-CN', () => {
    expect(normalizeSupportedLanguage('zh-CN')).toBe(SETTINGS_LANGUAGES.ZH_CN)
    expect(normalizeSupportedLanguage('zh')).toBe(SETTINGS_LANGUAGES.ZH_CN)
    expect(normalizeSupportedLanguage('zh-TW')).toBe(SETTINGS_LANGUAGES.ZH_CN)
    expect(normalizeSupportedLanguage('zh-HK')).toBe(SETTINGS_LANGUAGES.ZH_CN)
    expect(normalizeSupportedLanguage('zh-SG')).toBe(SETTINGS_LANGUAGES.ZH_CN)
  })

  it('仅 en-US（大小写不敏感）映射 en-US', () => {
    expect(normalizeSupportedLanguage('en-US')).toBe(SETTINGS_LANGUAGES.EN_US)
    expect(normalizeSupportedLanguage('en-us')).toBe(SETTINGS_LANGUAGES.EN_US)
    expect(normalizeSupportedLanguage('EN-US')).toBe(SETTINGS_LANGUAGES.EN_US)
  })

  it('其他未支持语言回退 zh-CN', () => {
    expect(normalizeSupportedLanguage('en')).toBe(SETTINGS_LANGUAGES.ZH_CN)
    expect(normalizeSupportedLanguage('en-GB')).toBe(SETTINGS_LANGUAGES.ZH_CN)
    expect(normalizeSupportedLanguage('ja-JP')).toBe(SETTINGS_LANGUAGES.ZH_CN)
    expect(normalizeSupportedLanguage('fr')).toBe(SETTINGS_LANGUAGES.ZH_CN)
  })

  it('空值回退 zh-CN', () => {
    expect(normalizeSupportedLanguage('')).toBe(SETTINGS_LANGUAGES.ZH_CN)
    expect(normalizeSupportedLanguage(undefined)).toBe(SETTINGS_LANGUAGES.ZH_CN)
  })
})

describe('resolveInitialLanguage', () => {
  it('持久化设置优先于 navigator.language', () => {
    expect(resolveInitialLanguage(SETTINGS_LANGUAGES.EN_US, 'zh-TW')).toBe(SETTINGS_LANGUAGES.EN_US)
    expect(resolveInitialLanguage(SETTINGS_LANGUAGES.ZH_CN, 'en-US')).toBe(SETTINGS_LANGUAGES.ZH_CN)
  })

  it('无持久化时按规范化 navigator.language 选择', () => {
    expect(resolveInitialLanguage(undefined, 'en-US')).toBe(SETTINGS_LANGUAGES.EN_US)
    expect(resolveInitialLanguage(undefined, 'zh-TW')).toBe(SETTINGS_LANGUAGES.ZH_CN)
    expect(resolveInitialLanguage(undefined, 'en-GB')).toBe(SETTINGS_LANGUAGES.ZH_CN)
  })

  it('无任何语言来源时回退 zh-CN', () => {
    expect(resolveInitialLanguage(undefined, undefined)).toBe(SETTINGS_LANGUAGES.ZH_CN)
  })
})

describe('readNavigatorLanguage', () => {
  it('jsdom 环境下返回 navigator.language 字符串', () => {
    expect(typeof readNavigatorLanguage()).toBe('string')
  })
})
