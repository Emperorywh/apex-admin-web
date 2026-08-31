/**
 * TrendAreaChart：24 小时滚动窗口「新建 / 完成任务」双序列平滑面积图。
 * 按容器实际像素宽度渲染，悬浮显示引导线与提示卡片。
 */

import { useId, useState } from 'react'
import { useElementWidth } from '@/features/dashboard/hooks/useElementWidth'
import { ChartTooltip } from '@/features/dashboard/components/ChartTooltip/ChartTooltip'
import { buildAxis, smoothLinePath, type ChartPoint } from '@/features/dashboard/utils/chartGeometry'
import type { HourlyTrendPoint } from '@/types/dashboard/dashboard.types'
import styles from '@/features/dashboard/components/TrendAreaChart/TrendAreaChart.module.css'

const HEIGHT = 248
const PADDING = { top: 14, right: 14, bottom: 26, left: 38 } as const

interface TrendAreaChartProps {
  points: HourlyTrendPoint[]
  createdLabel: string
  completedLabel: string
}

export function TrendAreaChart({ points, createdLabel, completedLabel }: TrendAreaChartProps) {
  const gradientId = useId()
  const [wrapRef, width] = useElementWidth<HTMLDivElement>()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const axis = buildAxis(points.reduce((max, point) => Math.max(max, point.created, point.completed), 1))
  const innerW = Math.max(0, width - PADDING.left - PADDING.right)
  const innerH = HEIGHT - PADDING.top - PADDING.bottom
  const baseline = PADDING.top + innerH

  const xAt = (index: number) =>
    PADDING.left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW)
  const yAt = (value: number) => baseline - (value / axis.max) * innerH

  const lineOf = (pick: (point: HourlyTrendPoint) => number) => {
    const linePoints: ChartPoint[] = points.map((point, index) => ({ x: xAt(index), y: yAt(pick(point)) }))
    const line = smoothLinePath(linePoints)
    if (!line || linePoints.length === 0) return { line: '', area: '' }
    const area = `${line} L ${linePoints[linePoints.length - 1].x} ${baseline} L ${linePoints[0].x} ${baseline} Z`
    return { line, area }
  }
  const seriesPaths = {
    created: lineOf((point) => point.created),
    completed: lineOf((point) => point.completed),
  }

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'var(--app-blue)' }} />
          {createdLabel}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'var(--app-green)' }} />
          {completedLabel}
        </span>
      </div>
      <div
        ref={wrapRef}
        className={styles.canvas}
        onMouseMove={(event) => {
          if (points.length === 0 || innerW <= 0) return
          const rect = event.currentTarget.getBoundingClientRect()
          const ratio = (event.clientX - rect.left - PADDING.left) / innerW
          const index = Math.round(ratio * (points.length - 1))
          setHoverIndex(Math.min(points.length - 1, Math.max(0, index)))
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {width > 0 ? (
          <svg width={width} height={HEIGHT} role="img">
            <defs>
              <linearGradient id={`${gradientId}-created`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--app-blue)', stopOpacity: 0.3 }} />
                <stop offset="100%" style={{ stopColor: 'var(--app-blue)', stopOpacity: 0.02 }} />
              </linearGradient>
              <linearGradient id={`${gradientId}-completed`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--app-green)', stopOpacity: 0.26 }} />
                <stop offset="100%" style={{ stopColor: 'var(--app-green)', stopOpacity: 0.02 }} />
              </linearGradient>
            </defs>
            {axis.ticks.map((tick) => (
              <g key={tick}>
                <line
                  className={styles.gridLine}
                  x1={PADDING.left}
                  x2={PADDING.left + innerW}
                  y1={yAt(tick)}
                  y2={yAt(tick)}
                />
                <text className={styles.axisText} x={PADDING.left - 8} y={yAt(tick) + 3.5} textAnchor="end">
                  {tick}
                </text>
              </g>
            ))}
            {points.map((point, index) =>
              index % 4 === 0 ? (
                <text
                  key={point.time}
                  className={styles.axisText}
                  x={xAt(index)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                >
                  {point.time.slice(11, 13)}:00
                </text>
              ) : null,
            )}
            <path d={seriesPaths.created.area} fill={`url(#${gradientId}-created)`} />
            <path d={seriesPaths.completed.area} fill={`url(#${gradientId}-completed)`} />
            <path d={seriesPaths.created.line} className={styles.lineCreated} />
            <path d={seriesPaths.completed.line} className={styles.lineCompleted} />
            {hoverIndex !== null && hoverPoint ? (
              <g>
                <line
                  className={styles.guideLine}
                  x1={xAt(hoverIndex)}
                  x2={xAt(hoverIndex)}
                  y1={PADDING.top}
                  y2={baseline}
                />
                <circle className={styles.haloCreated} cx={xAt(hoverIndex)} cy={yAt(hoverPoint.created)} r={7} />
                <circle
                  className={styles.hoverDot}
                  style={{ fill: 'var(--app-blue)' }}
                  cx={xAt(hoverIndex)}
                  cy={yAt(hoverPoint.created)}
                  r={3.5}
                />
                <circle className={styles.haloCompleted} cx={xAt(hoverIndex)} cy={yAt(hoverPoint.completed)} r={7} />
                <circle
                  className={styles.hoverDot}
                  style={{ fill: 'var(--app-green)' }}
                  cx={xAt(hoverIndex)}
                  cy={yAt(hoverPoint.completed)}
                  r={3.5}
                />
              </g>
            ) : null}
          </svg>
        ) : null}
        {hoverPoint && hoverIndex !== null ? (
          <ChartTooltip
            x={xAt(hoverIndex)}
            y={Math.min(yAt(hoverPoint.created), yAt(hoverPoint.completed))}
            containerWidth={width}
            title={hoverPoint.time}
            rows={[
              { label: createdLabel, value: String(hoverPoint.created), color: 'var(--app-blue)' },
              { label: completedLabel, value: String(hoverPoint.completed), color: 'var(--app-green)' },
            ]}
          />
        ) : null}
      </div>
    </div>
  )
}
