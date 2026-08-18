/**
 * 迷你趋势图（SPEC_UI2 §8）：自绘 SVG sparkline 小组件——无新依赖、无 Effect
 * 负担，避开 Activity 隐藏页 Effect 清理与多 ECharts 实例开销；描边动画为纯 CSS
 * （stroke-dash 描画 + 渐变面积淡入，缓存页允许纯 CSS 动效，§10 红线；
 * prefers-reduced-motion 由全局降级规则关闭）。
 * 颜色由调用方以 CSS 变量注入（var(--ant-color-*)），本组件不出现色值字面量。
 */
import { useId } from 'react'
import styles from './Sparkline.module.css'

export interface SparklineProps {
  /** 数值序列（按时间升序）；少于 2 个点时不渲染曲线 */
  data: readonly number[]
  /** 描边/面积取色：调用方传 antd token CSS 变量（如 var(--ant-color-primary)） */
  color: string
  /** 画布宽度 px（SVG viewBox 同步），默认 96 */
  width?: number
  /** 画布高度 px，默认 36 */
  height?: number
}

// 路径纯函数与组件同文件：供同目录单测直接断言，局部禁用该告警
// oxlint-disable-next-line react/only-export-components
export function buildSparklinePath(
  data: readonly number[],
  width: number,
  height: number,
): { line: string; area: string } | null {
  if (data.length < 2) {
    return null
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pad = 2
  const stepX = (width - pad * 2) / (data.length - 1)
  const points = data.map((value, index) => {
    const x = pad + index * stepX
    const y = pad + (1 - (value - min) / span) * (height - pad * 2)
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const
  })
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')
  const area = `${line} L${points[points.length - 1][0]} ${height - pad} L${points[0][0]} ${height - pad} Z`
  return { line, area }
}

export function Sparkline({ data, color, width = 96, height = 36 }: SparklineProps) {
  const gradientId = `sparkline-fill-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const path = buildSparklinePath(data, width, height)
  if (path === null) {
    return null
  }
  return (
    <svg
      className={styles.sparkline}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="presentation"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.24 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path className={styles.area} d={path.area} fill={`url(#${gradientId})`} />
      <path className={styles.line} d={path.line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
