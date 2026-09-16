/**
 * 系统站点图标（G04）：挂载于 App 根部，读取 favicon 位置的系统图片。
 * 未配置/读取失败时保持 index.html 里的 /favicon.ico 默认值（源行为回退）。
 * App 根组件常驻不卸载，Object URL 生命周期由 useSystemImage 管理。
 */

import { useEffect } from 'react'
import { useSystemImage } from '@/hooks/useSystemImage'

/** 站点图标默认资源：与 index.html 初始声明一致，避免闪烁 */
const DEFAULT_FAVICON_URL = '/favicon.ico'

export function SystemFavicon() {
  const { url } = useSystemImage('favicon', DEFAULT_FAVICON_URL)

  useEffect(() => {
    // 复用 index.html 已声明的 icon link；缺失时补建（防御性，正常不触发）
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = url
  }, [url])

  /* 无渲染输出：仅负责同步 <link rel="icon"> */
  return null
}
