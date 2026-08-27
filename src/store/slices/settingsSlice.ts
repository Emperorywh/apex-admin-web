/**
 * 应用设置状态。locale 字段持久化。
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AppLanguage } from '@/i18n/i18n'

interface SettingsState {
  locale: AppLanguage
}

const initialState: SettingsState = {
  locale: 'zh-CN',
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    localeChanged(state, action: PayloadAction<AppLanguage>) {
      state.locale = action.payload
    },
  },
})

export const { localeChanged } = settingsSlice.actions
export default settingsSlice.reducer
