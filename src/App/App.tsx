/**
 * 应用根组件：Provider 组合与 i18n 接线。
 * - antd ConfigProvider（locale）+ App.useApp 反馈桥
 * - 语言切换：预加载基础与已打开页签命名空间并集后统一 changeLanguage
 */

import { Suspense, useEffect, useMemo } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import zhTW from 'antd/locale/zh_TW'
import jaJP from 'antd/locale/ja_JP'
import koKR from 'antd/locale/ko_KR'
import { RouterProvider } from 'react-router'
import { useTranslation } from 'react-i18next'
import { FeedbackBridge } from '@/components/FeedbackBridge/FeedbackBridge'
import PageLoading from '@/components/PageLoading/PageLoading'
import { Wallpaper } from '@/components/Wallpaper/Wallpaper'
import { useTheme } from '@/hooks/useTheme'
import { buildAppTheme } from '@/constants/designTokens'
import { changeAppLanguage, type AppLanguage } from '@/i18n/i18n'
import { findRouteMeta } from '@/router/projections'
import { appRouter } from '@/router/router'
import { store } from '@/store/store'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { localeChanged } from '@/store/slices/settingsSlice'

/**
 * antd locale 映射表（对齐旧系统 app.tsx ANTD_LOCALE_MAP）：
 * 按当前语言注入 antd 组件内置文案（分页、日期选择器、弹窗按钮等），
 * 覆盖全部五语，避免日/韩/繁中界面混入简中组件文案。
 */
const ANTD_LOCALE_MAP: Record<AppLanguage, typeof zhCN> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'zh-TW': zhTW,
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
    void changeAppLanguage(locale, namespaces).then(() => {
      dispatch(localeChanged(locale)) // 幂等提交，确保状态一致
    })
  }, [dispatch, locale, i18n])

  const antdLocale = ANTD_LOCALE_MAP[locale]

  return (
    <ConfigProvider locale={antdLocale} theme={antdTheme}>
      <AntdApp>
        <Wallpaper />
        <FeedbackBridge />
        <Suspense fallback={<PageLoading />}>
          <RouterProvider router={appRouter} />
        </Suspense>
      </AntdApp>
    </ConfigProvider>
  )
}
