/**
 * 统计卡片（规格 §14.2 Dashboard 统计卡片区；视觉 SPEC-UI §7）：图标 + 标题 + 数值，
 * 细边框小圆角卡片（全局 Card token）。标题为中文文案 key，经 dashboard 命名空间翻译（规格 §12）；
 * 颜色一律来自 antd CSS 变量（规格 §10.2），样式见 OverviewCard.module.css。
 */
import { Card, Skeleton } from 'antd'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DASHBOARD_I18N_NAMESPACE } from '@/constants/dashboard/dashboard.constants'
import styles from './OverviewCard.module.css'

export interface OverviewCardProps {
  /** 统计项标题：中文文案 key（经 dashboard 命名空间翻译） */
  title: string
  /** 统计值：非负整数计数（规格 §14.1） */
  value: number
  /** 统计项图标 */
  icon: LucideIcon
  /** 数据加载中：数值区域显示骨架占位 */
  loading?: boolean
}

export function OverviewCard({ title, value, icon: Icon, loading = false }: OverviewCardProps) {
  const { t } = useTranslation(DASHBOARD_I18N_NAMESPACE)
  return (
    <Card className={styles.card}>
      <div className={styles.content}>
        <span className={styles.iconWrap} aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className={styles.meta}>
          <span className={styles.title}>{t(title)}</span>
          {loading ? (
            <Skeleton active title={{ width: '50%' }} paragraph={false} className={styles.skeleton} />
          ) : (
            <span className={styles.value}>{value.toLocaleString()}</span>
          )}
        </div>
      </div>
    </Card>
  )
}
