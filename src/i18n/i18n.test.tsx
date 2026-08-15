/**
 * i18next 初始化、命名空间预加载、切换语言与环境同步（规格 §12）单测。
 * 覆盖：中文即 key 配置、缺 key 回退、context/复数/<Trans> 约定、
 * 预加载幂等与并发、切换前并集加载、dayjs/<html lang>/document.title 同步。
 */
import dayjs from 'dayjs'
import { I18nextProvider, Trans, useTranslation } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  COMMON_NAMESPACE,
  I18N_BASE_NAMESPACES,
  MENU_NAMESPACE,
  changeAppLanguage,
  createI18n,
  ensureNamespacesLoaded,
  setDocumentTitle,
} from './i18n'

afterEach(() => {
  // dayjs 全局 locale、<html lang> 与 document.title 是进程级状态，逐用例复位
  dayjs.locale('en')
  document.documentElement.lang = ''
  document.title = ''
})

describe('初始化（规格 §12：中文文案即 key）', () => {
  it('keySeparator 与 nsSeparator 均为 false，zh-CN 缺 key 返回 key 本身', () => {
    const i18n = createI18n({ navigatorLanguage: 'zh-CN' })
    expect(i18n.options.keySeparator).toBe(false)
    expect(i18n.options.nsSeparator).toBe(false)
    // 键中的 `.` 与 `:` 不作分隔符，整串即键
    expect(i18n.t('系统.v1:用户管理')).toBe('系统.v1:用户管理')
  })

  it('缺 key 的插值同样生效：中文模板 key 直接返回插值结果', () => {
    const i18n = createI18n({ navigatorLanguage: 'zh-CN' })
    expect(i18n.t('共 {{count}} 条', { count: 5 })).toBe('共 5 条')
  })

  it('初始语言按规范化 navigator.language 选择', () => {
    expect(createI18n({ navigatorLanguage: 'en-US' }).language).toBe('en-US')
    expect(createI18n({ navigatorLanguage: 'zh-TW' }).language).toBe('zh-CN')
    expect(createI18n({ navigatorLanguage: 'en-GB' }).language).toBe('zh-CN')
  })

  it('持久化语言设置优先于 navigator.language', () => {
    expect(createI18n({ persistedLanguage: 'zh-CN', navigatorLanguage: 'en-US' }).language).toBe('zh-CN')
    expect(createI18n({ persistedLanguage: 'en-US', navigatorLanguage: 'zh-TW' }).language).toBe('en-US')
  })

  it('初始化即同步初始语言的 dayjs locale 与 <html lang>', () => {
    createI18n({ navigatorLanguage: 'zh-CN' })
    expect(dayjs.locale()).toBe('zh-cn')
    expect(document.documentElement.lang).toBe('zh-CN')
  })
})

describe('命名空间预加载（规格 §12）', () => {
  it('en-US：预加载基础命名空间后返回英文，未加载前回退中文 key', async () => {
    const i18n = createI18n({ navigatorLanguage: 'en-US' })
    expect(i18n.t('取消')).toBe('取消')
    await ensureNamespacesLoaded(i18n, I18N_BASE_NAMESPACES)
    expect(i18n.t('取消')).toBe('Cancel')
    expect(i18n.t('仪表盘', { ns: MENU_NAMESPACE })).toBe('Dashboard')
  })

  it('幂等且并发安全：重复与并发调用不重复加载', async () => {
    const i18n = createI18n({ navigatorLanguage: 'en-US' })
    await Promise.all([ensureNamespacesLoaded(i18n, ['menu']), ensureNamespacesLoaded(i18n, ['menu'])])
    await ensureNamespacesLoaded(i18n, ['menu'])
    expect(i18n.hasResourceBundle('en-US', MENU_NAMESPACE)).toBe(true)
  })

  it('zh-CN 不维护资源文件：预加载直接返回且不登记任何资源', async () => {
    const i18n = createI18n({ navigatorLanguage: 'zh-CN' })
    await ensureNamespacesLoaded(i18n, I18N_BASE_NAMESPACES)
    expect(i18n.hasResourceBundle('en-US', COMMON_NAMESPACE)).toBe(false)
  })

  it('资源文件缺失的命名空间以错误拒绝', async () => {
    const i18n = createI18n({ navigatorLanguage: 'en-US' })
    await expect(ensureNamespacesLoaded(i18n, ['not-exist-ns'])).rejects.toThrow(/not-exist-ns/)
  })
})

describe('切换语言（规格 §12：并集加载后一次性切换）', () => {
  it('先加载并集再 changeLanguage：languageChanged 触发时资源已就绪', async () => {
    const i18n = createI18n({ navigatorLanguage: 'zh-CN' })
    let loadedWhenSwitched = false
    i18n.on('languageChanged', () => {
      loadedWhenSwitched =
        i18n.hasResourceBundle('en-US', COMMON_NAMESPACE) && i18n.hasResourceBundle('en-US', MENU_NAMESPACE)
    })
    await changeAppLanguage(i18n, 'en-US')
    expect(i18n.language).toBe('en-US')
    expect(loadedWhenSwitched).toBe(true)
    expect(i18n.t('取消')).toBe('Cancel')
  })

  it('extraNamespaces 并集在切换前一并加载', async () => {
    const i18n = createI18n({ navigatorLanguage: 'zh-CN' })
    await changeAppLanguage(i18n, 'en-US', { extraNamespaces: [MENU_NAMESPACE] })
    expect(i18n.hasResourceBundle('en-US', MENU_NAMESPACE)).toBe(true)
  })

  it('切换同时同步 dayjs locale、<html lang> 与 document.title', async () => {
    const i18n = createI18n({ navigatorLanguage: 'zh-CN' })
    setDocumentTitle(i18n, '用户管理')
    expect(document.title).toBe('用户管理')
    await changeAppLanguage(i18n, 'en-US')
    expect(document.documentElement.lang).toBe('en-US')
    expect(dayjs.locale()).toBe('en')
    expect(document.title).toBe('User Management')
    await changeAppLanguage(i18n, 'zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(dayjs.locale()).toBe('zh-cn')
    expect(document.title).toBe('用户管理')
  })

  it('未设置标题时语言切换不改动 document.title', async () => {
    const i18n = createI18n({ navigatorLanguage: 'zh-CN' })
    document.title = ''
    await changeAppLanguage(i18n, 'en-US')
    expect(document.title).toBe('')
  })

  it('未支持语言值切换回退 zh-CN', async () => {
    const i18n = createI18n({ navigatorLanguage: 'en-US' })
    await changeAppLanguage(i18n, 'fr-FR')
    expect(i18n.language).toBe('zh-CN')
  })
})

describe('语境差异 / 复数 / 富文本约定（规格 §12）', () => {
  it('context：资源 key 为 <中文>_<context>，未维护语境回退基础翻译', async () => {
    const i18n = createI18n({ navigatorLanguage: 'en-US' })
    await ensureNamespacesLoaded(i18n, [COMMON_NAMESPACE])
    expect(i18n.t('启用', { context: 'status' })).toBe('Enabled')
    expect(i18n.t('启用', { context: 'button' })).toBe('Enable')
    expect(i18n.t('禁用', { context: 'status' })).toBe('Disabled')
    expect(i18n.t('禁用', { context: 'button' })).toBe('Disable')
    // 未维护 context 的短语回退基础 key 的翻译
    expect(i18n.t('取消', { context: 'button' })).toBe('Cancel')
  })

  it('zh-CN 模式下 context 短语返回无后缀的中文 key', () => {
    const i18n = createI18n({ navigatorLanguage: 'zh-CN' })
    expect(i18n.t('启用', { context: 'button' })).toBe('启用')
    expect(i18n.t('启用', { context: 'status' })).toBe('启用')
  })

  it('复数 _one/_other：中文返回插值 key，英文按单复数分支', async () => {
    const zh = createI18n({ navigatorLanguage: 'zh-CN' })
    expect(zh.t('{{count}} 条记录', { count: 1 })).toBe('1 条记录')
    expect(zh.t('{{count}} 条记录', { count: 5 })).toBe('5 条记录')
    const en = createI18n({ navigatorLanguage: 'en-US' })
    await ensureNamespacesLoaded(en, [COMMON_NAMESPACE])
    expect(en.t('{{count}} 条记录', { count: 1 })).toBe('1 record')
    expect(en.t('{{count}} 条记录', { count: 5 })).toBe('5 records')
  })

  it('富文本 <Trans>：按子节点序号复用组件，中文模式回退子节点原文', async () => {
    const zh = createI18n({ navigatorLanguage: 'zh-CN' })
    const { container: zhContainer } = render(
      <I18nextProvider i18n={zh}>
        <Trans i18nKey="已阅读并同意<1>服务条款</1>">
          已阅读并同意
          <a href="/terms">服务条款</a>
        </Trans>
      </I18nextProvider>,
    )
    expect(zhContainer.textContent).toBe('已阅读并同意服务条款')
    expect(screen.getByText('服务条款')).toHaveAttribute('href', '/terms')

    const en = createI18n({ navigatorLanguage: 'en-US' })
    await ensureNamespacesLoaded(en, [COMMON_NAMESPACE])
    const { container: enContainer } = render(
      <I18nextProvider i18n={en}>
        <Trans i18nKey="已阅读并同意<1>服务条款</1>">
          已阅读并同意
          <a href="/terms">服务条款</a>
        </Trans>
      </I18nextProvider>,
    )
    expect(enContainer.textContent).toBe('I have read and agree to the Terms of Service')
    expect(screen.getByText('Terms of Service')).toHaveAttribute('href', '/terms')
  })
})

describe('React 树语言订阅', () => {
  it('useTranslation 随 changeLanguage 自动重渲染', async () => {
    const i18n = createI18n({ navigatorLanguage: 'zh-CN' })
    function LanguageProbe() {
      const { t } = useTranslation()
      return <span>{t('确定')}</span>
    }
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageProbe />
      </I18nextProvider>,
    )
    expect(screen.getByText('确定')).toBeInTheDocument()
    await changeAppLanguage(i18n, 'en-US')
    await waitFor(() => expect(screen.getByText('OK')).toBeInTheDocument())
  })
})
