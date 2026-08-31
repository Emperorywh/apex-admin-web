/**
 * RankBars：横向排行条（任务类型分布 / 车辆任务排行共用）。
 * label 由调用方完成翻译后传入，组件只负责呈现。
 */

import { useLayoutEffect, useState } from 'react'
import styles from '@/features/dashboard/components/RankBars/RankBars.module.css'

export interface RankBarItem {
  key: string
  label: string
  /** 次要说明（如车辆分组），可为空 */
  description?: string
  value: number
  /** 条形填充色（CSS 颜色值，通常传 --app-* 变量）；缺省为主题蓝 */
  color?: string
}

interface RankBarsProps {
  items: RankBarItem[]
}

export function RankBars({ items }: RankBarsProps) {
  const [mounted, setMounted] = useState(false)
  useLayoutEffect(() => setMounted(true), [])

  const max = items.reduce((current, item) => Math.max(current, item.value), 1)

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.key} className={styles.row}>
          <div className={styles.head}>
            <span className={styles.label} title={item.label}>
              {item.label}
              {item.description ? <span className={styles.description}>{item.description}</span> : null}
            </span>
            <span className={styles.value}>{item.value}</span>
          </div>
          <div className={styles.track}>
            <span
              className={styles.fill}
              style={{
                background: item.color ?? 'var(--app-blue)',
                width: mounted ? `${Math.max(3, (item.value / max) * 100)}%` : '0%',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
