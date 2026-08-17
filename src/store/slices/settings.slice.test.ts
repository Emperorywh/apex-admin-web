import { describe, expect, it } from 'vitest'
import { DEFAULT_COLOR_PRIMARY } from '@/config/theme'
import {
  SETTINGS_LANGUAGES,
  SETTINGS_LAYOUTS,
  SETTINGS_THEME_MODES,
  initialSettingsState,
  settingsChanged,
  settingsSlice,
} from '@/store/slices/settings.slice'

const { reducer } = settingsSlice

describe('settings.slice', () => {
  it('初始状态：跟随系统主题、色板首项默认主题色（SPEC-UI §4.4 靛蓝）、侧边布局、面包屑开、zh-CN', () => {
    expect(initialSettingsState).toEqual({
      themeMode: SETTINGS_THEME_MODES.SYSTEM,
      colorPrimary: DEFAULT_COLOR_PRIMARY,
      layout: SETTINGS_LAYOUTS.SIDE,
      breadcrumbEnabled: true,
      language: SETTINGS_LANGUAGES.ZH_CN,
    })
  })

  it('枚举常量与规格 §10.1 取值一致（字体无设置项，不落枚举）', () => {
    expect(Object.values(SETTINGS_THEME_MODES)).toEqual(['light', 'dark', 'system'])
    expect(Object.values(SETTINGS_LAYOUTS)).toEqual(['side', 'top'])
    expect(Object.values(SETTINGS_LANGUAGES)).toEqual(['zh-CN', 'en-US'])
  })

  it('settingsChanged 以 Partial 合并，未提及字段保持原值（实时生效，无应用按钮）', () => {
    const state = reducer(initialSettingsState, settingsChanged({ themeMode: SETTINGS_THEME_MODES.DARK, language: SETTINGS_LANGUAGES.EN_US }))
    expect(state.themeMode).toBe(SETTINGS_THEME_MODES.DARK)
    expect(state.language).toBe(SETTINGS_LANGUAGES.EN_US)
    expect(state.layout).toBe(SETTINGS_LAYOUTS.SIDE)
    expect(state.breadcrumbEnabled).toBe(true)
  })

  it('settingsChanged 连续变更逐次生效', () => {
    const switched = reducer(initialSettingsState, settingsChanged({ layout: SETTINGS_LAYOUTS.TOP }))
    const tuned = reducer(switched, settingsChanged({ breadcrumbEnabled: false }))
    expect(tuned.layout).toBe(SETTINGS_LAYOUTS.TOP)
    expect(tuned.breadcrumbEnabled).toBe(false)
    expect(tuned.themeMode).toBe(SETTINGS_THEME_MODES.SYSTEM)
  })
})
