/** 环境级 locale 同步（规格 §12）单测：dayjs、antd locale 取值与 <html lang> */
import dayjs from 'dayjs'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { afterEach, describe, expect, it } from 'vitest'
import { applyDayjsLocale, getAntdLocale, syncDocumentLanguage } from './localeSync'

afterEach(() => {
  // dayjs 全局 locale 与 <html lang> 是进程级状态，逐用例复位
  dayjs.locale('en')
  document.documentElement.lang = ''
})

describe('applyDayjsLocale', () => {
  it('zh-CN 同步为 dayjs zh-cn，en-US 同步为内置 en', () => {
    applyDayjsLocale('zh-CN')
    expect(dayjs.locale()).toBe('zh-cn')
    applyDayjsLocale('en-US')
    expect(dayjs.locale()).toBe('en')
  })

  it('未支持语言规范化后同步 zh-cn', () => {
    applyDayjsLocale('fr-FR')
    expect(dayjs.locale()).toBe('zh-cn')
  })
})

describe('getAntdLocale', () => {
  it('按语言返回官方 locale 对象，供 ConfigProvider 跟随切换', () => {
    expect(getAntdLocale('zh-CN')).toBe(zhCN)
    expect(getAntdLocale('en-US')).toBe(enUS)
  })

  it('未支持语言回退 zh_CN', () => {
    expect(getAntdLocale('ja-JP')).toBe(zhCN)
  })
})

describe('syncDocumentLanguage', () => {
  it('同步 <html lang> 为规范化语言值', () => {
    syncDocumentLanguage('en-US')
    expect(document.documentElement.lang).toBe('en-US')
    syncDocumentLanguage('zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
    syncDocumentLanguage('de-DE')
    expect(document.documentElement.lang).toBe('zh-CN')
  })
})
