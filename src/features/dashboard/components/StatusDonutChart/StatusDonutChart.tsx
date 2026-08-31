/**
 * StatusDonutChart：车辆状态分布环形图。
 * 中心默认展示车辆总数，悬浮分段（或图例）时切换为该状态的数量与占比。
 */

import { useState } from 'react'
import { donutSlicePath } from '@/features/dashboard/utils/chartGeometry'
import type { VehicleRuntimeState, VehicleStatusSlice } from '@/types/dashboard/dashboard.types'
import styles from '@/features/dashboard/components/StatusDonutChart/StatusDonutChart.module.css'

/** 状态 → 主题色（CSS 变量） */
const STATE_COLORS: Record<VehicleRuntimeState, string> = {
  IDLE: 'var(--app-blue)',
  RUNNING: 'var(--app-green)',
  CHARGING: 'var(--app-orange)',
  ALARM: 'var(--app-red)',
  OFFLINE: 'var(--app-text-4)',
}

const SIZE = 172
const CENTER = SIZE / 2
const OUTER_RADIUS = 78
const INNER_RADIUS = 56
/** 分段间隔角（度） */
const PAD_ANGLE = 2

interface StatusDonutChartProps {
  slices: VehicleStatusSlice[]
  /** 状态 → 译文（由页面注入，保持组件无翻译职责） */
  labels: Record<VehicleRuntimeState, string>
  totalLabel: string
}

export function StatusDonutChart({ slices, labels, totalLabel }: StatusDonutChartProps) {
  const [hoverState, setHoverState] = useState<VehicleRuntimeState | null>(null)

  const total = slices.reduce((sum, slice) => sum + slice.count, 0)
  const active = hoverState ?? null
  const activeSlice = active ? slices.find((slice) => slice.state === active) : null

  // 角度从正上方顺时针铺开；仅有单一段时退化为整圆环
  let cursor = 0
  const segments = slices.map((slice) => {
    const sweep = total > 0 ? (slice.count / total) * 360 : 0
    const start = cursor + PAD_ANGLE / 2
    const end = cursor + Math.max(0, sweep - PAD_ANGLE / 2)
    cursor += sweep
    return { slice, start, end, fullRing: sweep >= 360 - PAD_ANGLE }
  })

  return (
    <div className={styles.wrap}>
      <div className={styles.donutArea}>
        <svg width={SIZE} height={SIZE} role="img">
          {total === 0 ? (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={(OUTER_RADIUS + INNER_RADIUS) / 2}
              fill="none"
              className={styles.emptyRing}
              strokeWidth={OUTER_RADIUS - INNER_RADIUS}
            />
          ) : (
            segments.map(({ slice, start, end, fullRing }) => {
              const dimmed = active !== null && active !== slice.state
              return (
                <path
                  key={slice.state}
                  className={styles.segment}
                  d={
                    fullRing
                      ? donutSlicePath(CENTER, CENTER, OUTER_RADIUS, INNER_RADIUS, 0, 359.999)
                      : donutSlicePath(CENTER, CENTER, OUTER_RADIUS, INNER_RADIUS, start, Math.max(end, start + 0.01))
                  }
                  style={{
                    fill: STATE_COLORS[slice.state],
                    opacity: dimmed ? 0.35 : 1,
                    transform: active === slice.state ? 'scale(1.035)' : 'scale(1)',
                    transformOrigin: `${CENTER}px ${CENTER}px`,
                  }}
                  onMouseEnter={() => setHoverState(slice.state)}
                  onMouseLeave={() => setHoverState(null)}
                />
              )
            })
          )}
        </svg>
        <div className={styles.centerContent}>
          <div className={styles.centerValue}>{activeSlice ? activeSlice.count : total}</div>
          <div className={styles.centerLabel}>{activeSlice ? labels[activeSlice.state] : totalLabel}</div>
        </div>
      </div>
      <ul className={styles.legend}>
        {slices.map((slice) => {
          const percent = total > 0 ? Math.round((slice.count / total) * 100) : 0
          return (
            <li
              key={slice.state}
              className={active === slice.state ? `${styles.legendRow} ${styles.legendRowActive}` : styles.legendRow}
              onMouseEnter={() => setHoverState(slice.state)}
              onMouseLeave={() => setHoverState(null)}
            >
              <span className={styles.legendDot} style={{ background: STATE_COLORS[slice.state] }} />
              <span className={styles.legendLabel}>{labels[slice.state]}</span>
              <span className={styles.legendValue}>{slice.count}</span>
              <span className={styles.legendPercent}>{percent}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
