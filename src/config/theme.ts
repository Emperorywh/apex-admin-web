/**
 * 主题配置集中地（规格 §10.2）：全项目唯一允许出现色值字面量的实现文件。
 *
 * - 预设主题色、默认主题色与对比度校验都定义于此；其他 CSS/TSX 的颜色只能
 *   来自 theme.useToken()、var(--ant-*) 或本文件导出的取值。
 * - settings 变化实时组装 ConfigProvider theme（无「应用」按钮），本文件提供
 *   纯组装函数与文档属性同步函数，React 接线位于 App/ThemeProvider。
 * - antd v6 默认即 CSS Variables 模式，不使用任何 v5 兼容 patch。
 */
import { theme } from 'antd'
import type { ThemeConfig } from 'antd'
import type { SettingsFontFamily, SettingsFontSize, SettingsState, SettingsThemeMode } from '@/store/slices/settings.slice'

/** 预设主题色条目：color 为六位十六进制；labelKey 即中文 i18n key（规格 §12） */
export interface ThemePresetColor {
  readonly key: string
  readonly color: string
  readonly labelKey: string
}

/**
 * 预设主题色（规格 §10.1 要求至少 6 个）：
 * 全部通过白字对比度校验（对比度见 theme.test.ts 逐项断言），保证实心按钮文字可读。
 */
export const THEME_PRESET_COLORS: readonly ThemePresetColor[] = [
  { key: 'azure', color: '#1677ff', labelKey: '湛蓝' },
  { key: 'emerald', color: '#389e0d', labelKey: '翡翠绿' },
  { key: 'violet', color: '#722ed1', labelKey: '酱紫' },
  { key: 'sunset', color: '#d46b08', labelKey: '日暮橙' },
  { key: 'crimson', color: '#f5222d', labelKey: '绯红' },
  { key: 'teal', color: '#08979c', labelKey: '青碧' },
  { key: 'magenta', color: '#c41d7f', labelKey: '洋红' },
  { key: 'gold', color: '#ad6800', labelKey: '鎏金' },
]

/** 默认主题色：第一个预设（settings 切片初始值引用，避免色值字面量散落） */
export const DEFAULT_COLOR_PRIMARY: string = THEME_PRESET_COLORS[0].color

/** 主题色上实心文字的基准色：取 antd colorTextLightSolid（亮/暗算法下均为白色） */
export function getPrimarySolidTextColor(): string {
  return theme.getDesignToken().colorTextLightSolid
}

/**
 * 自定义主题色对比度可读性阈值（规格 §11.3，WCAG 2.1 AA）：
 * 取非文本 UI 组件与大字号文本的 3:1 下限；实心按钮文字按大字号口径校验。
 */
export const PRIMARY_COLOR_MIN_CONTRAST_RATIO = 3

/** 六位十六进制颜色格式：自定义取色持久化的合法域（规格 §10.2） */
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/** 校验六位十六进制颜色（含 # 前缀，大小写不限） */
export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value)
}

/** sRGB 分量线性化（WCAG 2.1 相对亮度定义） */
function linearizeSrgbChannel(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** 计算六位十六进制颜色的 WCAG 相对亮度（0–1）；三位缩写先归一为六位 */
export function relativeLuminance(hex: string): number {
  const digits = hex.length === 4 ? hex.slice(1).split('').map((digit) => digit + digit).join('') : hex.slice(1)
  const rgb = Number.parseInt(digits, 16)
  const r = linearizeSrgbChannel((rgb >> 16) & 0xff)
  const g = linearizeSrgbChannel((rgb >> 8) & 0xff)
  const b = linearizeSrgbChannel(rgb & 0xff)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 两色 WCAG 对比度（1–21） */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/** 主题色与实心文字的实际对比度：供设置面板展示与测试断言 */
export function getPrimaryContrastRatio(color: string): number {
  return contrastRatio(color, getPrimarySolidTextColor())
}

/** 主题色可读性校验（规格 §11.3）：低于阈值时设置面板提示，但不阻止应用取色 */
export function isReadablePrimaryColor(color: string): boolean {
  return getPrimaryContrastRatio(color) >= PRIMARY_COLOR_MIN_CONTRAST_RATIO
}

/** 解析后的主题模式：跟随系统按 prefers-color-scheme 归约为亮/暗 */
export type ResolvedThemeMode = Exclude<SettingsThemeMode, 'system'>

/** 跟随系统监听的 media query */
const SYSTEM_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

/** 读取系统深色偏好：matchMedia 不可用按亮色处理（规格 §10.2） */
export function readSystemPrefersDark(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(SYSTEM_COLOR_SCHEME_QUERY).matches
}

/**
 * 订阅系统深色偏好变化，返回取消订阅函数；matchMedia 不可用时返回无操作函数。
 * 仅在 themeMode === 'system' 时由 ThemeProvider 订阅：手动选亮/暗即停止跟随，
 * 重新选「跟随系统」恢复监听（规格 §10.2/§17.15）。
 */
export function subscribeSystemPrefersDark(listener: () => void): () => void {
  if (typeof window.matchMedia !== 'function') {
    return () => undefined
  }
  const media = window.matchMedia(SYSTEM_COLOR_SCHEME_QUERY)
  media.addEventListener('change', listener)
  return () => {
    media.removeEventListener('change', listener)
  }
}

/** 解析运行时主题模式：跟随系统按入参系统偏好归约，手动选择原样返回 */
export function resolveRuntimeThemeMode(mode: SettingsThemeMode, systemPrefersDark: boolean): ResolvedThemeMode {
  if (mode === 'dark' || (mode === 'system' && systemPrefersDark)) {
    return 'dark'
  }
  return 'light'
}

/** 字体族完整栈（规格 §10.1）：system=系统默认 / sans=无衬线 / serif=衬线 / mono=等宽 */
export const THEME_FONT_FAMILY_STACKS: Record<SettingsFontFamily, string> = {
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  sans: "'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  serif: "Georgia, 'Times New Roman', 'Songti SC', SimSun, serif",
  mono: "ui-monospace, SFMono-Regular, Consolas, 'Courier New', monospace",
}

/** 字号档位到像素映射（规格 §10.1）：rem 基准（html font-size）与 antd fontSize 同值 */
export const THEME_FONT_SIZE_PX: Record<SettingsFontSize, number> = {
  small: 14,
  medium: 16,
  large: 18,
}

/** 参与主题组装的设置子集：语言与面包屑不进入 antd token */
export type ThemeSettings = Pick<SettingsState, 'colorPrimary' | 'fontSize' | 'fontFamily'>

/**
 * 由设置实时组装 ConfigProvider theme（规格 §10.2，无「应用」按钮）：
 * 亮/暗经 algorithm、主题色经 colorPrimary、字体族经 fontFamily、字号经 fontSize。
 * antd v6 默认 CSS Variables 模式，无需显式开启，也不使用 v5 patch。
 */
export function buildAntdThemeConfig(settings: ThemeSettings, resolvedMode: ResolvedThemeMode): ThemeConfig {
  return {
    algorithm: resolvedMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: settings.colorPrimary,
      fontSize: THEME_FONT_SIZE_PX[settings.fontSize],
      fontFamily: THEME_FONT_FAMILY_STACKS[settings.fontFamily],
    },
  }
}

/**
 * 把解析后的主题同步到文档（规格 §10.2/§8.3）：data-theme、color-scheme、
 * 初始背景色（html/body，取自当前算法的 colorBgLayout，与 index.html 启动镜像
 * 脚本写入的取值一致）、rem 基准（html font-size = 字号档位）与 body 文本色；
 * 字体族经 body CSS 变量 --app-font-family 供 globals.css 消费（规格 §10.1）。
 */
export function applyThemeToDocument(settings: ThemeSettings, resolvedMode: ResolvedThemeMode): void {
  const tokens = theme.getDesignToken(buildAntdThemeConfig(settings, resolvedMode))
  const root = document.documentElement
  root.setAttribute('data-theme', resolvedMode)
  root.style.colorScheme = resolvedMode
  root.style.backgroundColor = tokens.colorBgLayout
  root.style.fontSize = `${tokens.fontSize}px`
  document.body.style.backgroundColor = tokens.colorBgLayout
  document.body.style.color = tokens.colorText
  document.body.style.setProperty('--app-font-family', tokens.fontFamily)
}
