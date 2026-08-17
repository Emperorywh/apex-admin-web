/**
 * 统计卡片（规格 §14.2 Dashboard 统计卡片区；视觉 SPEC_UI2 §8 slash workbench 式）：
 * 彩色浅底圆角图标块（语义色/主色 10% 浅底派生 + 彩色图标）+ 大数字 + 环比文案 +
 * 迷你趋势图（Sparkline，静态 SVG 无 Effect 负担）。
 * 标题为中文文案 key，经 dashboard 命名空间翻译（规格 §12）；
 * 颜色一律来自 antd CSS 变量与 color-mix 派生（SPEC_UI2 §4.3），不出现色值字面量。
 */
import { Card, Skeleton } from 'antd'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DASHBOARD_I18N_NAMESPACE } from '@/constants/dashboard/dashboard.constants'
import { Sparkline } from '@/features/dashboard/components/Sparkline/Sparkline'
import styles from './OverviewCard.module.css'

/** 图标块语义取色：经 CSS 变量派生（见 OverviewCard.module.css tone 系列类） */
export type OverviewCardTone = 'primary' | 'success' | 'warning' | 'error'

export interface OverviewCardProps {
  /** 统计项标题：中文文案 key（经 dashboard 命名空间翻译） */
  title: string
  /** 统计值：非负整数计数（规格 §14.1） */
  value: number
  /** 统计项图标 */
  icon: LucideIcon
  /** 图标块语义取色（SPEC_UI2 §8 彩色浅底图标块） */
  tone?: OverviewCardTone
  /** 迷你趋势序列（SPEC_UI2 §8）：不传或点数不足时不渲染 Sparkline */
  trend?: readonly number[]
  /** 环比文案（由页面按趋势序列派生，如「+3 近14日」） */
  delta?: string
  /** 数据加载中：数值区域显示骨架占位 */
  loading?: boolean
}

export function OverviewCard({
  title,
  value,
  icon: Icon,
  tone = 'primary',
  trend,
  delta,
  loading = false,
}: OverviewCardProps) {
  const { t } = useTranslation(DASHBOARD_I18N_NAMESPACE)
  return (
    <Card className={styles.card}>
      <div className={styles.content}>
        <span className={`${styles.iconBlock} ${styles[tone]}`} aria-hidden="true">
          <Icon size={22} />
        </span>
        <div className={styles.meta}>
          <span className={styles.title}>{t(title)}</span>
          {loading ? (
            <Skeleton active title={{ width: '50%' }} paragraph={false} className={styles.skeleton} />
          ) : (
            <span className={styles.value}>{value.toLocaleString()}</span>
          )}
          {delta !== undefined && !loading && <span className={styles.delta}>{delta}</span>}
        </div>
        {trend !== undefined && !loading && (
          <div className={styles.trend}>
            {/* tone 与 antd 语义 token 名一一对应（primary/success/warning/error） */}
            <Sparkline data={trend} color={`var(--ant-color-${tone})`} />
          </div>
        )}
      </div>
    </Card>
  )
}
