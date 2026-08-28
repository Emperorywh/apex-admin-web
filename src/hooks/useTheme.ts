/**
 * 主题解析与应用：把 settings.theme（light / dark / system 三态）解析为具体值，
 * 落到 <html data-theme> 供 CSS 消费，并镜像到 localStorage 供 index.html
 * 内联脚本在首帧渲染前读取（防闪烁）。返回解析后的具体值（antd 算法切换用）。
 */

import { useEffect, useState } from 'react'
import { useAppSelector } from '@/hooks/useAppSelector'

/** 主题镜像 key，index.html 内联脚本按此读取；改动需同步内联脚本 */
export const THEME_STORAGE_KEY = 'apex-admin:theme'

export type ResolvedTheme = 'light' | 'dark'

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

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [resolved, theme])

  return resolved
}
