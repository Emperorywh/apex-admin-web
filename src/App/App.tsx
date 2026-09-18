/**
 * 应用根组件：Provider 组合与 i18n 接线。
 * - antd ConfigProvider（locale）+ App.useApp 反馈桥
 * - 语言切换：预加载基础与已打开页签命名空间并集后统一 changeLanguage
 */

import { Suspense, useEffect, useMemo } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import type { Locale } from 'antd/es/locale'
import zhCN from 'antd/locale/zh_CN'
import zhTW from 'antd/locale/zh_TW'
import enUS from 'antd/locale/en_US'
import jaJP from 'antd/locale/ja_JP'
import koKR from 'antd/locale/ko_KR'
import { RouterProvider } from 'react-router'
import { useTranslation } from 'react-i18next'
import { FeedbackBridge } from '@/components/FeedbackBridge/FeedbackBridge'
import { ActivationRedirectListener } from '@/features/license-activation/components/ActivationRedirectListener/ActivationRedirectListener'
import PageLoading from '@/components/PageLoading/PageLoading'
import { Wallpaper } from '@/components/Wallpaper/Wallpaper'
import { useTheme } from '@/hooks/useTheme'
import { buildAppTheme } from '@/constants/designTokens'
import { changeAppLanguage, normalizeLanguage, type AppLanguage } from '@/i18n/i18n'
import { findRouteMeta } from '@/router/projections'
import { appRouter } from '@/router/router'
import { store } from '@/store/store'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { localeChanged } from '@/store/slices/settingsSlice'

/**
 * antd 组件库文案与语言一一对应（T00.8 五语言基座）：
 * ConfigProvider locale、dayjs locale、html lang、i18next 语言五者同帧切换。
 */
const ANTD_LOCALES: Record<AppLanguage, Locale> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR,
}

export default function App() {
  const dispatch = useAppDispatch()
  const locale = useAppSelector((state) => state.settings.locale)
  /* 副作用调用：解析并同步 <html data-theme>，供全局 CSS 变量消费；
     渲染期读取（data-theme 已更新后的）计算变量生成 antd 主题，与 CSS 同帧切换 */
  const resolvedTheme = useTheme()
  const antdTheme = useMemo(() => buildAppTheme(resolvedTheme), [resolvedTheme])
  const { i18n } = useTranslation()

  /* 语言切换：读取一次当前页签集合计算命名空间并集，避免半翻译状态 */
  useEffect(() => {
    if (i18n.language === locale) return
    const namespaces = store
      .getState()
      .tabs.tabs.flatMap((tab) => findRouteMeta(tab.routeId)?.i18nNamespaces ?? [])
    void changeAppLanguage(locale, namespaces)
      .then(() => {
        dispatch(localeChanged(locale)) // 幂等提交，确保状态一致
      })
      .catch(() => {
        /* 资源预加载失败（网络中断/资源缺失）：保留原语言——
           把 settings 回滚到 i18next 实际生效语言，恢复「设置=实际」一致，
           不出现 useSuspense 挂起或半翻译页面；重选语言即可再次尝试 */
        dispatch(localeChanged(normalizeLanguage(i18n.language)))
      })
  }, [dispatch, locale, i18n])

  const antdLocale = ANTD_LOCALES[locale]

  return (
    <ConfigProvider locale={antdLocale} theme={antdTheme}>
      <AntdApp>
        <Wallpaper />
        <FeedbackBridge />
        {/* P02 未激活引导（业务码 1001000 → 单飞提示 → SPA 导航授权页），常驻监听一次 */}
        <ActivationRedirectListener />
        <Suspense fallback={<PageLoading />}>
          <RouterProvider router={appRouter} />
        </Suspense>
      </AntdApp>
    </ConfigProvider>
  )
}
