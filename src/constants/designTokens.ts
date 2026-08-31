/**
 * antd 主题适配层：只做 antd 官方暗黑模式的算法切换（darkAlgorithm / defaultAlgorithm），
 * 其余 token 一律保持 antd 出厂默认，禁止在此覆盖圆角/品牌色/字体等 seed；
 * <html data-theme> 的 CSS 令牌由 globals.css 单源维护，两套体系互不注入。
 * 调用时机：useTheme 已在渲染期同步 <html data-theme>，同一帧内 CSS 与 antd 算法一起切换。
 */

import { theme, type ThemeConfig } from 'antd'

/** 解析后的具体主题；settings.theme（light/dark/system 三态）经 system 偏好解析后的结果 */
export type ResolvedTheme = 'light' | 'dark'

/** 按解析后的主题生成 antd ThemeConfig（主题切换时重建） */
export function buildAppTheme(resolvedTheme: ResolvedTheme): ThemeConfig {
  return {
    algorithm: resolvedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
  }
}
