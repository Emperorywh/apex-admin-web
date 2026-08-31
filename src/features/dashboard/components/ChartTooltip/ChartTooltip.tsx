/**
 * ChartTooltip：图表悬浮提示（容器内绝对定位的小玻璃卡片），
 * 由各图表组件计算锚点像素坐标后传入，越靠近右缘自动翻到锚点左侧。
 */

import type { CSSProperties } from 'react'
import styles from '@/features/dashboard/components/ChartTooltip/ChartTooltip.module.css'

export interface ChartTooltipRow {
  label: string
  value: string
  /** 行首色点（CSS 颜色值，通常传 --app-* 变量） */
  color?: string
}

interface ChartTooltipProps {
  /** 锚点在容器内的像素坐标 */
  x: number
  y: number
  /** 容器总宽，用于靠右翻面与越界收拢 */
  containerWidth: number
  title: string
  rows: ChartTooltipRow[]
}

const TOOLTIP_WIDTH = 150
const TOOLTIP_GAP = 14

export function ChartTooltip({ x, y, containerWidth, title, rows }: ChartTooltipProps) {
  const flip = x + TOOLTIP_GAP + TOOLTIP_WIDTH > containerWidth
  const left = flip ? x - TOOLTIP_GAP - TOOLTIP_WIDTH : x + TOOLTIP_GAP
  const style: CSSProperties = {
    left,
    top: Math.max(4, y - 18),
  }
  return (
    <div className={styles.tooltip} style={style} role="status">
      <div className={styles.title}>{title}</div>
      {rows.map((row) => (
        <div key={row.label} className={styles.row}>
          {row.color ? <span className={styles.dot} style={{ background: row.color }} /> : null}
          <span className={styles.label}>{row.label}</span>
          <span className={styles.value}>{row.value}</span>
        </div>
      ))}
    </div>
  )
}
