/**
 * 彩色图标瓷片：页签栏与 Dock 共用的「App 图标」样式（四色渐变底 + 白色字形）。
 * 路由 → 色调映射见同目录 iconTones.ts，避免页签与 Dock 各自维护副本。
 */

import type { CSSProperties, ReactNode } from 'react'
import type { IconTone } from '@/layouts/BasicLayout/components/IconTile/iconTones'
import styles from '@/layouts/BasicLayout/components/IconTile/IconTile.module.css'

interface IconTileProps {
  tone: IconTone
  /** 瓷片边长（px） */
  size?: number
  /** 圆角（px） */
  radius?: number
  children: ReactNode
}

export function IconTile({ tone, size = 22, radius = 5, children }: IconTileProps) {
  const style: CSSProperties = { width: size, height: size, borderRadius: radius }
  return (
    <span className={`${styles.tile} ${styles[tone]}`} style={style} aria-hidden="true">
      {children}
    </span>
  )
}
