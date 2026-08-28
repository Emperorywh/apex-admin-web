/**
 * 应用根组件：Provider 组合与 i18n 接线。
 * - antd ConfigProvider（CSS Variables 模式）+ App.useApp 反馈桥
 * - 语言切换：预加载基础与已打开页签命名空间并集后统一 changeLanguage（SPEC §6）
 */

import { Suspense, useEffect } from 'react'
import { App as AntdApp, ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { RouterProvider } from 'react-router'
import { useTranslation } from 'react-i18next'
import { FeedbackBridge } from '@/components/FeedbackBridge/FeedbackBridge'
import PageLoading from '@/components/PageLoading/PageLoading'
import { useTheme } from '@/hooks/useTheme'
import { changeAppLanguage } from '@/i18n/i18n'
import { findRouteMeta } from '@/router/projections'
import { appRouter } from '@/router/router'
import { store } from '@/store/store'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { localeChanged } from '@/store/slices/settingsSlice'

/**
 * antd 主题：按明暗选择算法，品牌色/圆角/字体对齐设计稿（CSS Variables 模式，SPEC §2）。
 * 文字色亮色下显式给定；暗色交给 darkAlgorithm，仅指定深蓝底/文字基色以贴合应用气质。
 */
const getAntdTheme = (isDark: boolean): ThemeConfig => ({
  cssVar: {},
  algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#1f6ef5',
    colorInfo: '#1f6ef5',
    colorSuccess: '#0f9f58',
    colorWarning: '#e8860c',
    colorError: '#e5484d',
    borderRadius: 10,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
    ...(isDark
      ? { colorBgBase: '#0d1422', colorTextBase: '#e9edf7' }
      : { colorText: '#101728' }),
  },
})

export default function App() {
  const dispatch = useAppDispatch()
  const locale = useAppSelector((state) => state.settings.locale)
  const resolvedTheme = useTheme()
  const { i18n } = useTranslation()

  /* 语言切换：读取一次当前页签集合计算命名空间并集，避免半翻译状态 */
  useEffect(() => {
    if (i18n.language === locale) return
    const namespaces = store
      .getState()
      .tabs.tabs.flatMap((tab) => findRouteMeta(tab.routeId)?.i18nNamespaces ?? [])
    void changeAppLanguage(locale, namespaces).then(() => {
      dispatch(localeChanged(locale)) // 幂等提交，确保状态一致
    })
  }, [dispatch, locale, i18n])

  const antdLocale = locale === 'zh-CN' ? zhCN : enUS

  return (
    <ConfigProvider locale={antdLocale} theme={getAntdTheme(resolvedTheme === 'dark')}>
      <AntdApp>
        <FeedbackBridge />
        <Suspense fallback={<PageLoading />}>
          <RouterProvider router={appRouter} />
        </Suspense>
      </AntdApp>
    </ConfigProvider>
  )
}
