/**
 * 主题解析与应用：把 settings.theme（light / dark / system 三态）解析为具体值，
 * 同步到 <html data-theme>，并镜像到 localStorage 供 index.html 恢复偏好。
 * 主题偏好独立于外观实现；当前所有偏好均使用深色外观。
 */

import { useEffect, useState } from 'react'
import { useAppSelector } from '@/hooks/useAppSelector'
import type { ResolvedTheme } from '@/constants/designTokens'

/** 主题镜像 key，index.html 内联脚本按此读取；改动需同步内联脚本 */
export const THEME_STORAGE_KEY = 'apex-admin:theme:v2'

export function useTheme(): ResolvedTheme {
  const theme = useAppSelector((state) => state.settings.theme)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  /* system 态跟随系统偏好实时切换 */
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  /* 同步解析后的主题偏好，保留未来接入其他主题样式的入口 */
  document.documentElement.dataset.theme = resolved

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  return resolved
}
