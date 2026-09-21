/**
 * antd 与自定义组件共享 globals.css 的色彩、字体和控件尺寸。
 * 保留主题偏好接线；当前仅提供深色外观，其他偏好统一回退到深色。
 */

import { theme, type ThemeConfig } from 'antd'

/** 解析后的具体主题；settings.theme（light/dark/system 三态）经 system 偏好解析后的结果 */
export type ResolvedTheme = 'light' | 'dark'

const THEME_ALGORITHMS: Partial<Record<ResolvedTheme, ThemeConfig['algorithm']>> = {
  dark: theme.darkAlgorithm,
}

/** 按解析后的主题生成 antd ThemeConfig（主题切换时重建） */
export function buildAppTheme(resolvedTheme: ResolvedTheme): ThemeConfig {
  const styles = getComputedStyle(document.documentElement)
  const token = (name: string) => styles.getPropertyValue(`--app-${name}`).trim()

  return {
    algorithm: THEME_ALGORITHMS[resolvedTheme] ?? theme.darkAlgorithm,
    token: {
      colorPrimary: token('cyan'),
      colorInfo: token('blue'),
      colorSuccess: token('green'),
      colorWarning: token('orange'),
      colorError: token('red'),
      colorBgBase: token('bg'),
      colorBgContainer: token('card-bg'),
      colorBgElevated: token('pop-bg-solid'),
      colorText: token('text'),
      colorTextSecondary: token('text-2'),
      colorTextTertiary: token('text-3'),
      colorBorder: token('line'),
      colorBorderSecondary: token('divider'),
      fontFamily: token('font'),
      fontSize: Number.parseInt(token('fs-body'), 10),
      borderRadius: Number.parseInt(token('radius-control'), 10),
    },
  }
}
