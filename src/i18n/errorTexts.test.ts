/**
 * API errorCode 本地化映射（规格 §7.1/§7.4/§12）单测：
 * 覆盖全部错误码、en-US 资源完整性、未知错误回退与语言切换后的文案切换。
 * getApiErrorText 绑定应用级单例，逐用例重置模块获得全新单例。
 */
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_ERROR_CODES } from '@/constants/request.constants'

// 本文件逐用例 resetModules 后动态 import 重建 i18next 模块图；
// 全量套件并行时冷导入在负载较高的机器上可能超过默认 5 秒，放宽本文件超时
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  dayjs.locale('en')
  document.documentElement.lang = ''
  document.title = ''
})

describe('API_ERROR_MESSAGE_KEYS（规格 §7.1 全部错误码）', () => {
  it('恰好覆盖 §7.1 定义的全部错误码，无缺失、无多余', async () => {
    const { API_ERROR_MESSAGE_KEYS } = await import('./errorTexts')
    expect(Object.keys(API_ERROR_MESSAGE_KEYS).sort()).toEqual([...Object.values(API_ERROR_CODES)].sort())
  })

  it('en-US common 资源维护了全部错误文案与兜底文案', async () => {
    const { API_ERROR_FALLBACK_TEXT, API_ERROR_MESSAGE_KEYS } = await import('./errorTexts')
    const common = (await import('./locales/en-US/common')).default
    for (const text of Object.values(API_ERROR_MESSAGE_KEYS)) {
      expect(common[text], `en-US common 缺少错误文案「${text}」`).toBeTruthy()
    }
    expect(common[API_ERROR_FALLBACK_TEXT]).toBeTruthy()
  })
})

describe('getApiErrorText', () => {
  it('zh-CN：已知 errorCode 返回中文文案 key 本身', async () => {
    const { appI18n, changeAppLanguage } = await import('./i18n')
    const { getApiErrorText, API_ERROR_MESSAGE_KEYS } = await import('./errorTexts')
    await changeAppLanguage(appI18n, 'zh-CN')
    expect(getApiErrorText('AUTH_FORBIDDEN')).toBe(API_ERROR_MESSAGE_KEYS.AUTH_FORBIDDEN)
    expect(getApiErrorText('VALIDATION_FAILED')).toBe(API_ERROR_MESSAGE_KEYS.VALIDATION_FAILED)
  })

  it('en-US：切换后返回英文文案', async () => {
    const { appI18n, changeAppLanguage } = await import('./i18n')
    const { getApiErrorText } = await import('./errorTexts')
    await changeAppLanguage(appI18n, 'en-US')
    expect(getApiErrorText('AUTH_FORBIDDEN')).toBe('You do not have permission to perform this action.')
    expect(getApiErrorText('INTERNAL_ERROR')).toBe('Internal server error. Please try again later.')
  })

  it('未知或缺失 errorCode 回退固定兜底文案', async () => {
    const { appI18n, changeAppLanguage } = await import('./i18n')
    const { API_ERROR_FALLBACK_TEXT, getApiErrorText } = await import('./errorTexts')
    await changeAppLanguage(appI18n, 'zh-CN')
    expect(getApiErrorText('NOT_A_KNOWN_CODE')).toBe(API_ERROR_FALLBACK_TEXT)
    expect(getApiErrorText(undefined)).toBe(API_ERROR_FALLBACK_TEXT)
    expect(getApiErrorText(null)).toBe(API_ERROR_FALLBACK_TEXT)
    expect(getApiErrorText('')).toBe(API_ERROR_FALLBACK_TEXT)
  })

  it('en-US 资源未加载时回退中文 key（缺译回退中文，规格 §17.17）', async () => {
    // 单例按 navigator.language 初始化为 en-US 但尚未预加载任何资源
    const { getApiErrorText, API_ERROR_MESSAGE_KEYS } = await import('./errorTexts')
    expect(getApiErrorText('AUTH_FORBIDDEN')).toBe(API_ERROR_MESSAGE_KEYS.AUTH_FORBIDDEN)
  })
})
