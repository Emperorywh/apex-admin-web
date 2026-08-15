/**
 * 主题 Provider（规格 §10.2）：由 settings 实时组装 ConfigProvider theme，
 * 无「应用」按钮；同时把解析后的主题同步到文档属性（data-theme/color-scheme/
 * 背景色/rem 基准/字体 CSS 变量），并在 Provider 启动后立即以 Redux 设置校正
 * index.html 启动镜像留下的首帧状态（规格 §8.3）。
 *
 * 跟随系统（规格 §10.2/§17.15）：仅 themeMode === 'system' 时订阅
 * prefers-color-scheme media query；手动选亮/暗即停止跟随，重选「跟随系统」恢复。
 * 镜像写回由 store 订阅完成（store 创建即写、settings 变化重写），本组件只负责消费。
 */
import { ConfigProvider } from 'antd'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSelector } from 'react-redux'
import {
  buildAntdThemeConfig,
  applyThemeToDocument,
  readSystemPrefersDark,
  resolveRuntimeThemeMode,
  subscribeSystemPrefersDark,
} from '@/config/theme'
import { getAntdLocale } from '@/i18n/localeSync'
import { SETTINGS_THEME_MODES } from '@/store/slices/settings.slice'
import type { RootState } from '@/store/store'

/**
 * 系统深色偏好 Hook：active 为 false（手动选择亮/暗）时不订阅，
 * 恢复 true 时先读一次当前值再监听后续变化。
 */
function useSystemPrefersDark(active: boolean): boolean {
  const [prefersDark, setPrefersDark] = useState(() => readSystemPrefersDark())

  useEffect(() => {
    if (!active) {
      return undefined
    }
    setPrefersDark(readSystemPrefersDark())
    return subscribeSystemPrefersDark(() => {
      setPrefersDark(readSystemPrefersDark())
    })
  }, [active])

  return prefersDark
}

/** antd locale 与 theme 绑定到 Redux 设置：位于 Redux Provider 与 PersistGate 之内（规格 §7.2） */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const settings = useSelector((state: RootState) => state.settings)
  const followSystem = settings.themeMode === SETTINGS_THEME_MODES.SYSTEM
  const systemPrefersDark = useSystemPrefersDark(followSystem)
  const resolvedMode = resolveRuntimeThemeMode(settings.themeMode, systemPrefersDark)

  const themeConfig = useMemo(
    () => buildAntdThemeConfig(settings, resolvedMode),
    [settings, resolvedMode],
  )

  useEffect(() => {
    applyThemeToDocument(settings, resolvedMode)
  }, [settings, resolvedMode])

  return (
    <ConfigProvider locale={getAntdLocale(settings.language)} theme={themeConfig}>
      {children}
    </ConfigProvider>
  )
}
