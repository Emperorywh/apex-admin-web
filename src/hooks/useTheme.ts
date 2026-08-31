/**
 * 主题解析与应用：把 settings.theme（light / dark / system 三态）解析为具体值，
 * 落到 <html data-theme> 供全局 CSS 变量消费，并镜像到 localStorage 供 index.html
 * 内联脚本在首帧渲染前读取（防闪烁）。
 */

import { useEffect, useState } from 'react'
import { useAppSelector } from '@/hooks/useAppSelector'
import type { ResolvedTheme } from '@/constants/designTokens'

/** 主题镜像 key，index.html 内联脚本按此读取；改动需同步内联脚本 */
export const THEME_STORAGE_KEY = 'apex-admin:theme'

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

  /* 渲染期同步 data-theme（幂等）：全局 CSS 变量在同一渲染期即取到目标主题，
     若延迟到 effect 会闪一帧旧配色 */
  document.documentElement.dataset.theme = resolved

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  return resolved
}
