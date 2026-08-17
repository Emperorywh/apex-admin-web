/**
 * 界面设置切片（规格 §8.1/§10.1）：主题模式、主题色、布局、面包屑与语言。
 * 全量持久化；Redux 是运行时单一数据源，主题启动镜像只是首帧前的只读副本（规格 §8.3）。
 * 设置变化实时组装 ConfigProvider theme，无「应用」按钮；Fullscreen 属于 app slice，不属于本切片。
 * 字体不提供设置项（规格 §10.1）：基准字号与系统字体栈为固定常量，收敛于 config/theme.ts。
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { DEFAULT_COLOR_PRIMARY } from '@/config/theme'

/** 主题模式：亮 / 暗 / 跟随系统，默认跟随系统（规格 §10.1） */
export const SETTINGS_THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const
export type SettingsThemeMode = (typeof SETTINGS_THEME_MODES)[keyof typeof SETTINGS_THEME_MODES]

/** 布局：侧边 / 顶部，BasicLayout 热切换（规格 §10.1） */
export const SETTINGS_LAYOUTS = {
  SIDE: 'side',
  TOP: 'top',
} as const
export type SettingsLayout = (typeof SETTINGS_LAYOUTS)[keyof typeof SETTINGS_LAYOUTS]

/** 界面语言：zh-CN 默认 / en-US（规格 §12） */
export const SETTINGS_LANGUAGES = {
  ZH_CN: 'zh-CN',
  EN_US: 'en-US',
} as const
export type SettingsLanguage = (typeof SETTINGS_LANGUAGES)[keyof typeof SETTINGS_LANGUAGES]

/** settings 切片状态：与规格 §8.1 表逐项对应，全量持久化 */
export interface SettingsState {
  themeMode: SettingsThemeMode
  /** 主题色（十六进制）；预设色板与取色器由主题任务集中到 src/config/theme.ts（规格 §10.2） */
  colorPrimary: string
  layout: SettingsLayout
  breadcrumbEnabled: boolean
  language: SettingsLanguage
}

export const initialSettingsState: SettingsState = {
  themeMode: SETTINGS_THEME_MODES.SYSTEM,
  // 默认主题色来自 config/theme.ts 预设色板首项（色值字面量唯一集中地，规格 §10.2）
  colorPrimary: DEFAULT_COLOR_PRIMARY,
  layout: SETTINGS_LAYOUTS.SIDE,
  breadcrumbEnabled: true,
  language: SETTINGS_LANGUAGES.ZH_CN,
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState: initialSettingsState,
  reducers: {
    /** 设置变更：Partial 合并保持类型安全，实时生效无「应用」按钮（规格 §10.2） */
    settingsChanged(state, action: PayloadAction<Partial<SettingsState>>) {
      Object.assign(state, action.payload)
    },
  },
})

export const { settingsChanged } = settingsSlice.actions
