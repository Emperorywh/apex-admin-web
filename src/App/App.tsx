/**
 * 应用根组件：Provider 组合与 i18n 接线。
 * - antd ConfigProvider（CSS Variables 模式）+ App.useApp 反馈桥
 * - 语言切换：预加载基础与已打开页签命名空间并集后统一 changeLanguage
 */

import { Suspense, useEffect } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { RouterProvider } from 'react-router'
import { useTranslation } from 'react-i18next'
import { FeedbackBridge } from '@/components/FeedbackBridge/FeedbackBridge'
import PageLoading from '@/components/PageLoading/PageLoading'
import { getAntdTheme } from '@/constants/designTokens'
import { useTheme } from '@/hooks/useTheme'
import { changeAppLanguage } from '@/i18n/i18n'
import { findRouteMeta } from '@/router/projections'
import { appRouter } from '@/router/router'
import { store } from '@/store/store'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { localeChanged } from '@/store/slices/settingsSlice'

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
    <ConfigProvider locale={antdLocale} theme={getAntdTheme(resolvedTheme)}>
      <AntdApp>
        <FeedbackBridge />
        <Suspense fallback={<PageLoading />}>
          <RouterProvider router={appRouter} />
        </Suspense>
      </AntdApp>
    </ConfigProvider>
  )
}
