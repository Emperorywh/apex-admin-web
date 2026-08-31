/**
 * 应用设置状态。locale / theme 字段持久化。
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { readStoredLanguage, type AppLanguage } from '@/i18n/i18n'

/** 主题三态：light / dark 为具体值，system 跟随系统偏好（由 useTheme 解析） */
export type AppTheme = 'light' | 'dark' | 'system'

interface SettingsState {
  locale: AppLanguage
  theme: AppTheme
}

/** locale 取持久化偏好：与 i18next 初始语言一致，否则 App 启动即把语言拉回 zh-CN 并覆盖存储 */
const initialState: SettingsState = {
  locale: readStoredLanguage(),
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
