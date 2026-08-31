/**
 * DailyBarChart：近 7 日「完成 / 失败」分组柱状图，按天分组悬浮显示。
 */

import { useState } from 'react'
import { useElementWidth } from '@/features/dashboard/hooks/useElementWidth'
import { ChartTooltip } from '@/features/dashboard/components/ChartTooltip/ChartTooltip'
import { buildAxis } from '@/features/dashboard/utils/chartGeometry'
import type { DailyOrderStat } from '@/types/dashboard/dashboard.types'
import styles from '@/features/dashboard/components/DailyBarChart/DailyBarChart.module.css'

const HEIGHT = 236
const PADDING = { top: 14, right: 14, bottom: 26, left: 38 } as const
const BAR_WIDTH = 14
const BAR_GAP = 6
const BAR_RADIUS = 3

interface DailyBarChartProps {
  stats: DailyOrderStat[]
  completedLabel: string
  failedLabel: string
}

/** 顶角圆角矩形路径（底边直角贴住轴线） */
function roundedTopRect(x: number, y: number, width: number, height: number): string {
  const r = Math.min(BAR_RADIUS, width / 2, height)
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height}`,
    'Z',
  ].join(' ')
}

export function DailyBarChart({ stats, completedLabel, failedLabel }: DailyBarChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const axis = buildAxis(stats.reduce((max, stat) => Math.max(max, stat.completed, stat.failed), 1))
  const innerW = Math.max(0, width - PADDING.left - PADDING.right)
  const innerH = HEIGHT - PADDING.top - PADDING.bottom
  const baseline = PADDING.top + innerH

  const band = stats.length > 0 ? innerW / stats.length : innerW
  const yAt = (value: number) => baseline - (value / axis.max) * innerH
  const groupCenterAt = (index: number) => PADDING.left + band * index + band / 2

  const hoverStat = hoverIndex !== null ? stats[hoverIndex] : null

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'var(--app-green)' }} />
          {completedLabel}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'var(--app-red)' }} />
          {failedLabel}
        </span>
      </div>
      <div ref={wrapRef} className={styles.canvas} onMouseLeave={() => setHoverIndex(null)}>
        {width > 0 ? (
          <svg width={width} height={HEIGHT} role="img">
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
            {stats.map((stat, index) => {
              const groupCenter = groupCenterAt(index)
              const completedX = groupCenter - BAR_GAP / 2 - BAR_WIDTH
              const failedX = groupCenter + BAR_GAP / 2
              const completedHeight = Math.max(0, baseline - yAt(stat.completed))
              const failedHeight = Math.max(0, baseline - yAt(stat.failed))
              return (
                <g key={stat.date}>
                  <path
                    className={styles.barCompleted}
                    d={roundedTopRect(completedX, yAt(stat.completed), BAR_WIDTH, completedHeight)}
                  />
                  <path
                    className={styles.barFailed}
                    d={roundedTopRect(failedX, yAt(stat.failed), BAR_WIDTH, failedHeight)}
                  />
                  <text className={styles.axisText} x={groupCenter} y={HEIGHT - 8} textAnchor="middle">
                    {stat.date.slice(5)}
                  </text>
                  {/* 悬浮命中区：整段柱带透明矩形 */}
                  <rect
                    x={PADDING.left + band * index}
                    y={PADDING.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHoverIndex(index)}
                  />
                  {hoverIndex === index ? (
                    <rect
                      className={styles.bandHighlight}
                      x={PADDING.left + band * index + 2}
                      y={PADDING.top}
                      width={Math.max(0, band - 4)}
                      height={innerH}
                    />
                  ) : null}
                </g>
              )
            })}
          </svg>
        ) : null}
        {hoverStat && hoverIndex !== null ? (
          <ChartTooltip
            x={groupCenterAt(hoverIndex)}
            y={Math.min(yAt(hoverStat.completed), yAt(hoverStat.failed))}
            containerWidth={width}
            title={hoverStat.date}
            rows={[
              { label: completedLabel, value: String(hoverStat.completed), color: 'var(--app-green)' },
              { label: failedLabel, value: String(hoverStat.failed), color: 'var(--app-red)' },
            ]}
          />
        ) : null}
      </div>
    </div>
  )
}
