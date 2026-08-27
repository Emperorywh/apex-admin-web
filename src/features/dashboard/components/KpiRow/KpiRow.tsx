/**
 * KPI 行：四联指标卡容器（复刻设计稿 kpi-row）。
 */

import { OverviewCard } from '@/features/dashboard/components/OverviewCard/OverviewCard'
import type { KpiMetric } from '@/types/dashboard/dashboard.types'
import styles from '@/features/dashboard/components/KpiRow/KpiRow.module.css'

interface KpiRowProps {
  metrics: KpiMetric[]
}

export function KpiRow({ metrics }: KpiRowProps) {
  return (
    <div className="ds-card">
      <div className={styles.row}>
        {metrics.map((metric) => (
          <OverviewCard key={metric.id} metric={metric} />
        ))}
      </div>
    </div>
  )
}
