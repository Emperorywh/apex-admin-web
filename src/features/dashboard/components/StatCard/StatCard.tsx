/**
 * StatCard：仪表盘顶部 KPI 指标卡（图标瓷片 + 数值 + 较昨日涨跌）。
 */

import { useTranslation } from 'react-i18next'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import styles from '@/features/dashboard/components/StatCard/StatCard.module.css'

export type StatCardTone = 'blue' | 'green' | 'orange' | 'red'

interface StatCardProps {
  icon: LucideIcon
  tone: StatCardTone
  label: string
  value: string
  /** 数值后缀（如 %），以小号弱化展示 */
  suffix?: string
  /** 较昨日变化百分比；null/undefined 不展示涨跌行 */
  deltaPercent?: number | null
  /** 上涨视为坏方向（如告警数），涨跌颜色反转 */
  invertDelta?: boolean
  loading?: boolean
}

export function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  suffix,
  deltaPercent,
  invertDelta = false,
  loading = false,
}: StatCardProps) {
  const { t } = useTranslation('dashboard')

  const deltaGood = deltaPercent !== null && deltaPercent !== undefined && (deltaPercent >= 0) !== invertDelta
  const DeltaIcon = deltaPercent === null || deltaPercent === undefined || deltaPercent === 0
    ? Minus
    : deltaPercent > 0
      ? TrendingUp
      : TrendingDown
  const deltaClass =
    deltaPercent === null || deltaPercent === undefined || deltaPercent === 0
      ? styles.deltaNeutral
      : deltaGood
        ? styles.deltaGood
        : styles.deltaBad

  return (
    <div className={`${styles.card} ds-card`}>
      <span className={`${styles.tile} ${styles[`tile${tone}`]}`}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <div className={styles.body}>
        <div className={styles.label}>{label}</div>
        {loading ? (
          <div className={`${styles.value} ${styles.valueLoading}`} aria-label={label} />
        ) : (
          <div className={styles.value}>
            {value}
            {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
          </div>
        )}
        {deltaPercent === null || deltaPercent === undefined || loading ? null : (
          <div className={`${styles.delta} ${deltaClass}`}>
            <DeltaIcon size={12} strokeWidth={2.5} />
            <span>
              {t('较昨日')} {deltaPercent > 0 ? '+' : ''}
              {deltaPercent.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
