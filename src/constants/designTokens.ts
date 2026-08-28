/**
 * 设计令牌桥：视觉令牌的唯一事实源是 src/styles/globals.css 的 --app-* 变量（双主题）。
 * 本文件不维护第二份色值/圆角/字体，只在渲染期把当前主题下已解析的 CSS 变量
 * 接到 antd ThemeConfig，消除「globals.css 一份、App.tsx 一份」的双源漂移。
 *
 * 读取时机约定：getAntdTheme 必须在 React 渲染期调用——此时 globals.css 已加载，
 * 且 useTheme 已在同一渲染期把 data-theme 同步到 <html>，计算样式即为目标主题。
 */

import { theme as antdTheme, type ThemeConfig } from 'antd'

type ResolvedTheme = 'light' | 'dark'

/** 读取 <html> 上的计算 CSS 变量；变量缺失（CSS 未加载）时返回 undefined 走 antd 默认值 */
function cssVar(name: string): string | undefined {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value === '' ? undefined : value
}

function cssVarPx(name: string): number | undefined {
  const value = cssVar(name)
  if (value === undefined) return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** 由 globals.css 令牌生成 antd 主题（CSS Variables 模式） */
export function getAntdTheme(resolved: ResolvedTheme): ThemeConfig {
  const isDark = resolved === 'dark'
  return {
    cssVar: {},
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: cssVar('--app-blue'),
      colorInfo: cssVar('--app-blue'),
      colorSuccess: cssVar('--app-green'),
      colorWarning: cssVar('--app-orange'),
      colorError: cssVar('--app-red'),
      colorText: cssVar('--app-text'),
      fontFamily: cssVar('--app-font'),
      /* 半径层级与 globals.css 同心关系一致：badge 5 ⊂ control 7 ⊂ panel 12 */
      borderRadiusSM: cssVarPx('--app-radius-badge'),
      borderRadius: cssVarPx('--app-radius-control'),
      borderRadiusLG: cssVarPx('--app-radius-panel'),
      ...(isDark ? { colorBgBase: cssVar('--app-antd-bg-base') } : {}),
    },
    components: {
      /* 卡片退成「内容纸」：去边框（分组由窗口层承担），纸面用玻璃渐变让窗口透出 */
      Card: {
        colorBorderSecondary: 'transparent',
        colorBgContainer: cssVar('--app-card-bg'),
      },
      /* 表格坐在卡片纸上：纸面必须不透明（固定列/表头遮底），行线与悬停走令牌 */
      Table: {
        colorBgContainer: cssVar('--app-table-bg'),
        headerBg: cssVar('--app-table-header-bg'),
        headerSplitColor: 'transparent',
        borderColor: cssVar('--app-line-soft'),
        rowHoverBg: cssVar('--app-table-hover-bg'),
      },
    },
  }
}
