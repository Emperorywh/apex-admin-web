/**
 * 应用设置状态。locale / theme 字段持久化。
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AppLanguage } from '@/i18n/i18n'

/** 主题三态：light / dark 为具体值，system 跟随系统偏好（由 useTheme 解析） */
export type AppTheme = 'light' | 'dark' | 'system'

interface SettingsState {
  locale: AppLanguage
  theme: AppTheme
}

const initialState: SettingsState = {
  locale: 'zh-CN',
  theme: 'light',
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    localeChanged(state, action: PayloadAction<AppLanguage>) {
      state.locale = action.payload
    },
    themeChanged(state, action: PayloadAction<AppTheme>) {
      state.theme = action.payload
    },
  },
})

export const { localeChanged, themeChanged } = settingsSlice.actions
export default settingsSlice.reducer
