/**
 * 主题配置集中地（规格 §10.2）：全项目唯一允许出现色值字面量的实现文件。
 *
 * - 预设主题色、默认主题色与对比度校验都定义于此；其他 CSS/TSX 的颜色只能
 *   来自 theme.useToken()、var(--ant-*) 或本文件导出的取值。
 * - settings 变化实时组装 ConfigProvider theme（无「应用」按钮），本文件提供
 *   纯组装函数与文档属性同步函数，React 接线位于 App/ThemeProvider。
 * - antd v6 默认即 CSS Variables 模式，不使用任何 v5 兼容 patch。
 *
 * 视觉令牌基线 v2（SPEC_UI2 §4，slash-admin 设计语言翻译）：
 * - 灰阶画布衬白卡：colorBgLayout 亮 CANVAS_BG_LIGHT / 暗 CANVAS_BG_DARK 字面覆盖；
 * - 柔和阴影与细边并存：boxShadow* 阶梯统一 gray500/16–24%（亮）与 black/40–72%（暗）；
 * - 大圆角卡片体系：borderRadius 6 / borderRadiusLG 12 / borderRadiusSM 4；
 * - 彩色发光阴影：实心主按钮 hover 的主色发光经 hexToRgbaString(colorPrimary, 0.24) 派生；
 * - Inter Variable 自托管字体栈 + 基准字号 14px（规格 §10.1/SPEC_UI2 §4.5）。
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
 * 预设主题色（规格 §10.1 要求至少 6 个；SPEC_UI2 §4.4 共 8 个、meadow 绿置首为默认）：
 * 全部通过白字对比度校验（对比度见 theme.test.ts 逐项断言），保证实心按钮文字可读。
 * 预设 key/labelKey 变化需同步 en-US 资源（common 命名空间）。
 */
export const THEME_PRESET_COLORS: readonly ThemePresetColor[] = [
  { key: 'meadow', color: '#00A76F', labelKey: '原野绿' },
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
 * slash 灰阶画布（SPEC_UI2 §4.1/§4.3）：亮 ≈ background.neutral / 暗 ≈ near-black，
 * 在 colorBgLayout 字面覆盖；启动镜像（index.html 内联脚本）字面量同步本取值（SPEC_UI2 §11 红线）。
 */
export const CANVAS_BG_LIGHT = '#F4F6F8'
export const CANVAS_BG_DARK = '#09090B'

/** slash 柔和阴影基色 RGB 通道（gray500 #919EAB / near-black），仅本文件可出现字面量 */
const SHADOW_CHANNEL_LIGHT = '145, 158, 171'

/**
 * 阴影阶梯（SPEC_UI2 §4.1）：卡片 shadow-sm 级、浮层保留阶梯；
 * 亮 = gray500 低透明，暗 = black 加深，亮/暗各自独立调优（§3.5）。
 * 经 applyThemeToDocument 写入 --app-shadow-* CSS 变量供 CSS Modules 消费（§4.3 色值纪律）。
 */
export interface AppShadowSet {
  /** 卡片浅阴影（slash shadow-sm/card 级） */
  readonly card: string
  /** 浮层阶梯（dropdown/popover/迷你浮层卡片） */
  readonly raised: string
  /** 顶级浮层（modal/drawer） */
  readonly overlay: string
}

export function buildAppShadows(resolvedMode: ResolvedThemeMode): AppShadowSet {
  if (resolvedMode === 'dark') {
    return {
      card: '0 0 2px 0 rgba(0, 0, 0, 0.6), 0 12px 24px -4px rgba(0, 0, 0, 0.4)',
      raised: '0 0 2px 0 rgba(0, 0, 0, 0.72), 0 20px 40px -4px rgba(0, 0, 0, 0.48)',
      overlay: '0 8px 16px 0 rgba(0, 0, 0, 0.32), 0 24px 48px -8px rgba(0, 0, 0, 0.56)',
    }
  }
  return {
    card: `0 0 2px 0 rgba(${SHADOW_CHANNEL_LIGHT}, 0.2), 0 12px 24px -4px rgba(${SHADOW_CHANNEL_LIGHT}, 0.12)`,
    raised: `0 0 2px 0 rgba(${SHADOW_CHANNEL_LIGHT}, 0.24), 0 20px 40px -4px rgba(${SHADOW_CHANNEL_LIGHT}, 0.24)`,
    overlay: `0 8px 16px 0 rgba(${SHADOW_CHANNEL_LIGHT}, 0.16), 0 24px 48px -8px rgba(${SHADOW_CHANNEL_LIGHT}, 0.28)`,
  }
}

/** 六位十六进制 → rgba() 字符串：主色发光阴影等透明度合成的唯一换算处（SPEC_UI2 §4.1） */
export function hexToRgbaString(hex: string, alpha: number): string {
  const digits = hex.slice(1)
  const rgb = Number.parseInt(digits, 16)
  return `rgba(${(rgb >> 16) & 0xff}, ${(rgb >> 8) & 0xff}, ${rgb & 0xff}, ${alpha})`
}

/** 主色发光阴影（slash 签名，SPEC_UI2 §4.1）：实心主按钮 hover、彩色徽标，colorPrimary 24% */
export function buildPrimaryGlow(colorPrimary: string): string {
  return `0 8px 16px 0 ${hexToRgbaString(colorPrimary, 0.24)}`
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
 * 固定字体族（规格 §10.1/SPEC_UI2 §4.5，字体不提供设置项）：
 * Inter Variable 自托管拉丁子集在前，中文回退系统中文字体；
 * antd token 与 body CSS 变量共用同一来源。
 */
export const BASE_FONT_FAMILY =
  '"Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif'

/** 固定基准字号（规格 §10.1/SPEC_UI2 §4.5）：rem 基准（html font-size）与 antd fontSize 同值，单位 px */
export const BASE_FONT_SIZE_PX = 14

/** 参与主题组装的设置子集：语言与面包屑不进入 antd token */
export type ThemeSettings = Pick<SettingsState, 'colorPrimary'>

/**
 * 由设置实时组装 ConfigProvider theme（规格 §10.2，无「应用」按钮）：
 * 亮/暗经 algorithm、主题色经 colorPrimary；字号与字体族为固定常量（规格 §10.1）。
 * antd v6 默认 CSS Variables 模式，无需显式开启，也不使用 v5 patch。
 *
 * 组件级覆盖只从「当前算法 + 当前主题色」派生的 map token 取值，不写死色值，
 * 亮/暗两套自动各自成立（规格 §10.2/SPEC_UI2 §4.3 色值纪律）：
 * - 壳层导航已弃用 antd Menu 完全自绘（SPEC_UI2 §6.1），Menu 覆盖随之移除；
 *   业务页内 antd Menu/Dropdown 保持算法默认；
 * - Tag 的无边框浅底重制经全局 token 半径 + CSS 变量完成（SPEC_UI2 §4.2）。
 */
export function buildAntdThemeConfig(settings: ThemeSettings, resolvedMode: ResolvedThemeMode): ThemeConfig {
  const algorithm = resolvedMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm
  // 以当前算法 + 主题色预解析一轮派生 token，组件覆盖从派生值取（亮/暗各自正确）
  const derived = theme.getDesignToken({ algorithm, token: { colorPrimary: settings.colorPrimary } })
  const shadows = buildAppShadows(resolvedMode)
  return {
    algorithm,
    token: {
      colorPrimary: settings.colorPrimary,
      fontSize: BASE_FONT_SIZE_PX,
      fontFamily: BASE_FONT_FAMILY,
      // 大圆角卡片体系（SPEC_UI2 §3.3）：常规组件 6，卡片/大容器 12，小组件 4
      borderRadius: 6,
      borderRadiusLG: 12,
      borderRadiusSM: 4,
      // 灰阶画布（SPEC_UI2 §4.1）：亮 CANVAS_BG_LIGHT / 暗 CANVAS_BG_DARK 字面覆盖
      colorBgLayout: resolvedMode === 'dark' ? CANVAS_BG_DARK : CANVAS_BG_LIGHT,
      // 柔和阴影阶梯（SPEC_UI2 §4.1）：浮层保留阶梯，卡片浅阴影经 --app-shadow-card
      boxShadow: shadows.overlay,
      boxShadowSecondary: shadows.raised,
      boxShadowTertiary: shadows.card,
    },
    components: {
      // 表格（SPEC_UI2 §4.2）：表头纸面底 + 细下边框、行高随 14px 密度收敛、行 hover 浅底
      Table: {
        headerBg: derived.colorBgContainer,
        cellPaddingBlock: 12,
        cellPaddingInline: 16,
        rowHoverBg: derived.colorFillTertiary,
      },
      // 卡片（SPEC_UI2 §4.2）：12px 圆角（全局 borderRadiusLG）+ 细边浅阴影（--app-shadow-card）
      Card: {
        paddingLG: 20,
      },
      // 按钮（SPEC_UI2 §4.2）：实心主按钮主色发光阴影（slash 签名）；圆角走全局 6px
      Button: {
        primaryShadow: buildPrimaryGlow(settings.colorPrimary),
        defaultShadow: 'none',
        dangerShadow: 'none',
      },
    },
  }
}

/**
 * 把解析后的主题同步到文档（规格 §10.2/§8.3）：data-theme、color-scheme、
 * 初始背景色（html/body，取自当前算法的 colorBgLayout，与 index.html 启动镜像
 * 脚本写入的取值一致）、rem 基准（html font-size = 固定基准字号）与 body 文本色；
 * 固定字体族经 body CSS 变量 --app-font-family 供 globals.css 消费（规格 §10.1）。
 * 阴影阶梯与主色发光经 --app-shadow-card/-raised 与 --app-glow-primary CSS 变量供
 * CSS Modules 消费（SPEC_UI2 §4.3：色值字面量只允许出现在本文件）。
 */
export function applyThemeToDocument(settings: ThemeSettings, resolvedMode: ResolvedThemeMode): void {
  const tokens = theme.getDesignToken(buildAntdThemeConfig(settings, resolvedMode))
  const shadows = buildAppShadows(resolvedMode)
  const root = document.documentElement
  root.setAttribute('data-theme', resolvedMode)
  root.style.colorScheme = resolvedMode
  root.style.backgroundColor = tokens.colorBgLayout
  root.style.fontSize = `${tokens.fontSize}px`
  root.style.setProperty('--app-shadow-card', shadows.card)
  root.style.setProperty('--app-shadow-raised', shadows.raised)
  root.style.setProperty('--app-glow-primary', buildPrimaryGlow(settings.colorPrimary))
  document.body.style.backgroundColor = tokens.colorBgLayout
  document.body.style.color = tokens.colorText
  document.body.style.setProperty('--app-font-family', tokens.fontFamily)
}
