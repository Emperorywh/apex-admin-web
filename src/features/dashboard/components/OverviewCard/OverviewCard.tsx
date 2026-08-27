/**
 * KPI 指标卡：标签 + 数值 + 环比 + sparkline（复刻设计稿 kpi）。
 */

import { useTranslation } from 'react-i18next'
import type { KpiMetric } from '@/types/dashboard/dashboard.types'
import styles from '@/features/dashboard/components/OverviewCard/OverviewCard.module.css'

interface OverviewCardProps {
  metric: KpiMetric
}

export function OverviewCard({ metric }: OverviewCardProps) {
  const { t } = useTranslation('dashboard')
  const trendClass =
    metric.trend === 'up' ? styles.up : metric.trend === 'down' ? styles.down : undefined

  return (
    <div className={styles.kpi}>
      <div className={styles.body}>
        <div className={styles.label}>{t(metric.label)}</div>
        <div className={styles.value}>
          {metric.value}
          {metric.unit ? <small>{t(metric.unit)}</small> : null}
        </div>
        <div className={styles.foot}>
          {t(metric.footer)}
          {metric.trendText ? <span className={trendClass}>{t(metric.trendText)}</span> : null}
        </div>
      </div>
      <svg className={styles.spark} viewBox="0 0 160 56" fill="none" aria-hidden="true">
        <path d={metric.sparkPath} stroke="#2f7fff" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}
