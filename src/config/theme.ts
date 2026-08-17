/**
 * 主题配置集中地（规格 §10.2）：全项目唯一允许出现色值字面量的实现文件。
 *
 * - 预设主题色、默认主题色与对比度校验都定义于此；其他 CSS/TSX 的颜色只能
 *   来自 theme.useToken()、var(--ant-*) 或本文件导出的取值。
 * - settings 变化实时组装 ConfigProvider theme（无「应用」按钮），本文件提供
 *   纯组装函数与文档属性同步函数，React 接线位于 App/ThemeProvider。
 * - antd v6 默认即 CSS Variables 模式，不使用任何 v5 兼容 patch。
 *
 * 视觉令牌基线 v2（SPEC-UI2 §4，取代 SPEC-UI §4 冲突条文）：
 * - 大圆角卡片体系：borderRadius 6（常规组件）/ borderRadiusLG 12（卡片与大容器）；
 * - 灰阶画布衬白卡：colorBgLayout 亮 #F4F6F8 / 暗 #09090B，层次靠画布灰 vs 卡片白；
 * - 柔和阴影与细边并存：卡片 = 1px 细边 + 柔和浅阴影（slash shadow-sm 级），
 *   浮层保留 antd 阴影阶梯；主色发光阴影经 CSS 变量派生供按钮 hover 等消费；
 * - Inter Variable 自托管 + 基准字号 14px（SPEC-UI2 §4.5）。
 */
import { theme } from 'antd'
import type { ThemeConfig } from 'antd'
import type { SettingsState, SettingsThemeMode } from '@/store/slices/settings.slice'

/** 预设主题色条目：color 为六位十六进制；labelKey 即中文 i18n key（规格 §12） */
export interface ThemePresetColor {
  readonly key: string
  readonly color: string
  readonly labelKey: string
}

/**
 * 预设主题色（规格 §10.1 要求至少 6 个；SPEC-UI2 §4.4 刷新为 8 色，slash 招牌绿置首）：
 * 全部通过白字对比度校验（对比度见 theme.test.ts 逐项断言），保证实心按钮文字可读。
 * meadow 原野绿 #00A76F 与白字对比度 ≈3.11（≥3 阈值贴线通过）。
 * 预设 key/labelKey 变化需同步 en-US 资源（common 命名空间）。
 */
export const THEME_PRESET_COLORS: readonly ThemePresetColor[] = [
  { key: 'meadow', color: '#00a76f', labelKey: '原野绿' },
  { key: 'indigo', color: '#4f46e5', labelKey: '靛蓝' },
  { key: 'azure', color: '#1677ff', labelKey: '湛蓝' },
  { key: 'violet', color: '#7c3aed', labelKey: '紫罗兰' },
  { key: 'sunset', color: '#ea580c', labelKey: '落日橙' },
  { key: 'crimson', color: '#dc2626', labelKey: '绯红' },
  { key: 'teal', color: '#0d9488', labelKey: '青碧' },
  { key: 'magenta', color: '#db2777', labelKey: '品红' },
]

/** 默认主题色：第一个预设（settings 切片初始值引用，避免色值字面量散落） */
export const DEFAULT_COLOR_PRIMARY: string = THEME_PRESET_COLORS[0].color

/**
 * 灰阶画布底色（SPEC-UI2 §4.1）：亮为 slash 风格浅灰画布、暗为 near-black。
 * 字面值须与 index.html 启动镜像脚本的首帧背景保持一致（SPEC-UI2 §11 红线）。
 */
export const CANVAS_BG_LIGHT = '#F4F6F8'
export const CANVAS_BG_DARK = '#09090B'

/**
 * 卡片柔和浅阴影（SPEC-UI2 §4.1，slash shadow-sm 级）：亮为低透明中性灰
 * （gray500/16% 风格）、暗为低透明黑；浮层阴影阶梯保留 antd 默认（boxShadowSecondary 系）。
 */
export const CARD_SHADOW_LIGHT = '0 1px 2px 0 rgba(145, 158, 171, 0.16), 0 2px 6px 0 rgba(145, 158, 171, 0.12)'
export const CARD_SHADOW_DARK = '0 1px 2px 0 rgba(0, 0, 0, 0.32), 0 2px 6px 0 rgba(0, 0, 0, 0.24)'

/** 主色发光阴影透明度（SPEC-UI2 §4.1：主色派生 /24%，hex8 alpha 通道 0x3D≈24%） */
const PRIMARY_GLOW_ALPHA_HEX = '3D'

/** 主色发光阴影：实心主按钮 hover / 彩色徽标用（SPEC-UI2 §4.1），非法色入参返回无阴影 */
export function buildPrimaryGlowShadow(colorPrimary: string): string {
  if (!isHexColor(colorPrimary)) {
    return 'none'
  }
  return `0 4px 10px -2px ${colorPrimary}${PRIMARY_GLOW_ALPHA_HEX}`
}

/**
 * 菜单彩色图标取色板（SPEC-UI2 §5）：菜单彩色 SVG 资产以 currentColor 着色
 * （双层低透明度 + 实色构成双色面性观感），彩色经本取色板按图标名稳定派生。
 * 色值字面量收敛于本文件（SPEC-UI2 §4.3 红线）。
 */
export const MENU_ICON_ACCENT_COLORS: readonly string[] = [
  '#00A76F', // meadow 原野绿（slash 招牌绿）
  '#2170D8', // azure
  '#7A5AF8', // violet
  '#FFAB00', // amber
  '#18BFB4', // teal
  '#E8618C', // pink
  '#00B8D9', // cyan
  '#F46722', // orange
]

/**
 * 由图标名稳定派生取色板下标（SPEC-UI2 §5.5）：同一图标名在两次渲染间
 * 与亮/暗主题下取色一致（字符码累计取模，无随机性）。
 */
export function deriveMenuIconAccentColor(iconName: string): string {
  let hash = 0
  for (let i = 0; i < iconName.length; i += 1) {
    hash = (hash * 31 + iconName.charCodeAt(i)) % 100003
  }
  return MENU_ICON_ACCENT_COLORS[hash % MENU_ICON_ACCENT_COLORS.length]
}

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

/**
 * 固定字体族（规格 §10.1，字体不提供设置项；SPEC-UI2 §4.5）：
 * Inter Variable 自托管（@fontsource-variable/inter 拉丁子集），中文回退系统中文字体。
 */
export const BASE_FONT_FAMILY =
  "'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif"

/** 固定基准字号（规格 §10.1；SPEC-UI2 §4.5 降密度 16→14）：rem 基准与 antd fontSize 同值，单位 px */
export const BASE_FONT_SIZE_PX = 14

/** 卡片/大容器圆角（SPEC-UI2 §3.3） */
export const CARD_BORDER_RADIUS = 12

/** 常规组件圆角（SPEC-UI2 §3.3） */
export const CONTROL_BORDER_RADIUS = 6

/** 参与主题组装的设置子集：语言与面包屑不进入 antd token */
export type ThemeSettings = Pick<SettingsState, 'colorPrimary'>

/**
 * 由设置实时组装 ConfigProvider theme（规格 §10.2，无「应用」按钮）。
 * 亮/暗经 algorithm、主题色经 colorPrimary；字号与字体族为固定常量（规格 §10.1）。
 * antd v6 默认 CSS Variables 模式，无需显式开启，也不使用 v5 patch。
 *
 * 视觉令牌基线 v2（SPEC-UI2 §4.1/§4.2）：
 * - 圆角体系：borderRadius 6 / borderRadiusLG 12（SM 维持 antd 派生 4）；
 * - 灰阶画布：colorBgLayout 亮/暗各以具名字面值覆盖，卡片纸面维持算法 colorBgContainer；
 * - 柔和阴影：基础 boxShadow 换卡片级浅阴影（浮层 boxShadowSecondary 阶梯保留默认）；
 * - 组件覆盖只从「当前算法 + 当前主题色」派生的 map token 取值或使用本文件具名导出，
 *   不散落色值，亮/暗两套自动各自成立（SPEC-UI2 §4.3 色值纪律）。
 */
export function buildAntdThemeConfig(settings: ThemeSettings, resolvedMode: ResolvedThemeMode): ThemeConfig {
  const algorithm = resolvedMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm
  // 以当前算法 + 主题色预解析一轮派生 token，组件覆盖从派生值取（亮/暗各自正确）
  const derived = theme.getDesignToken({ algorithm, token: { colorPrimary: settings.colorPrimary } })
  return {
    algorithm,
    token: {
      colorPrimary: settings.colorPrimary,
      fontSize: BASE_FONT_SIZE_PX,
      fontFamily: BASE_FONT_FAMILY,
      borderRadius: CONTROL_BORDER_RADIUS,
      borderRadiusLG: CARD_BORDER_RADIUS,
      colorBgLayout: resolvedMode === 'dark' ? CANVAS_BG_DARK : CANVAS_BG_LIGHT,
      boxShadow: resolvedMode === 'dark' ? CARD_SHADOW_DARK : CARD_SHADOW_LIGHT,
    },
    components: {
      // 表格（SPEC-UI2 §4.2）：表头纸面底 + 细下边框、行高随 14px 密度收敛、行 hover 浅底
      Table: {
        headerBg: derived.colorBgContainer,
        cellPaddingBlock: 10,
        cellPaddingInline: 16,
        rowHoverBg: derived.colorFillQuaternary,
      },
      // 卡片（SPEC-UI2 §4.2）：12px 圆角走全局 borderRadiusLG，内边距 20–24 收敛节奏
      Card: {
        bodyPadding: 24,
      },
      // 按钮（SPEC-UI2 §4.2）：去 antd 实心按钮 0 2px 0 硬影（扁平基线），
      // 实心主按钮 hover 主色发光经 globals.css 的 --app-primary-glow 变量叠加
      Button: {
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
        fontWeight: 500,
      },
    },
  }
}

/**
 * 把解析后的主题同步到文档（规格 §10.2/§8.3）：data-theme、color-scheme、
 * 初始背景色（html/body，取自当前算法的 colorBgLayout，与 index.html 启动镜像
 * 脚本写入的取值一致）、rem 基准（html font-size = 固定基准字号）与 body 文本色；
 * 固定字体族经 body CSS 变量 --app-font-family 供 globals.css 消费（规格 §10.1），
 * 主色发光阴影经 --app-primary-glow 供实心主按钮 hover 等全局样式消费（SPEC-UI2 §4.1）。
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
  document.body.style.setProperty('--app-primary-glow', buildPrimaryGlowShadow(tokens.colorPrimary))
}
