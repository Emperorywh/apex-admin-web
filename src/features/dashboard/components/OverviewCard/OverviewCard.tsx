/**
 * 统计卡片（SPEC_UI2 §8 slash workbench 式）：彩色浅底圆角图标块（语义色/主色
 * 10% 浅底派生 + 彩色图标）+ 大数字 + 环比文案 + 迷你趋势图（Sparkline）。
 * 标题为中文文案 key，经 dashboard 命名空间翻译（规格 §12）；
 * 颜色一律来自 antd CSS 变量（规格 §10.2/SPEC_UI2 §4.3），样式见 OverviewCard.module.css。
 */
import { Card, Skeleton } from 'antd'
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DASHBOARD_I18N_NAMESPACE } from '@/constants/dashboard/dashboard.constants'
import { Sparkline } from '@/features/dashboard/components/Sparkline/Sparkline'
import styles from './OverviewCard.module.css'

/** 卡片色调：主色/成功/警示/信息四档，浅底与图标色经 antd 派生 token（SPEC_UI2 §8） */
export type OverviewCardTone = 'primary' | 'success' | 'warning' | 'info'

/** 色调 → 图标块/趋势图取色（antd token CSS 变量，非色值字面量） */
const TONE_COLOR_VARS: Record<OverviewCardTone, string> = {
  primary: 'var(--ant-color-primary)',
  success: 'var(--ant-color-success)',
  warning: 'var(--ant-color-warning)',
  info: 'var(--ant-color-info)',
}

export interface OverviewCardProps {
  /** 统计项标题：中文文案 key（经 dashboard 命名空间翻译） */
  title: string
  /** 统计值：非负整数计数（规格 §14.1） */
  value: number
  /** 统计项图标 */
  icon: LucideIcon
  /** 卡片色调（默认 primary） */
  tone?: OverviewCardTone
  /** 迷你趋势序列（按时间升序）；缺省不渲染趋势图 */
  trend?: readonly number[]
  /** 环比变化百分比（正负数）；缺省不渲染环比文案 */
  deltaPercent?: number
  /** 数据加载中：数值区域显示骨架占位 */
  loading?: boolean
}

export function OverviewCard({
  title,
  value,
  icon: Icon,
  tone = 'primary',
  trend,
  deltaPercent,
  loading = false,
}: OverviewCardProps) {
  const { t } = useTranslation(DASHBOARD_I18N_NAMESPACE)
  const toneColor = TONE_COLOR_VARS[tone]
  return (
    <Card className={styles.card}>
      <div className={styles.content}>
        <span className={styles.iconWrap} data-tone={tone} aria-hidden="true">
          <Icon size={22} />
        </span>
        <div className={styles.meta}>
          <span className={styles.title}>{t(title)}</span>
          {loading ? (
            <Skeleton active title={{ width: '50%' }} paragraph={false} className={styles.skeleton} />
          ) : (
            <span className={styles.value}>{value.toLocaleString()}</span>
          )}
          {deltaPercent !== undefined && (
            <span className={styles.delta} data-down={deltaPercent < 0}>
              {deltaPercent < 0 ? (
                <TrendingDown size={14} aria-hidden />
              ) : (
                <TrendingUp size={14} aria-hidden />
              )}
              {t('较上期 {{percent}}%', { percent: `${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(1)}` })}
            </span>
          )}
        </div>
        {trend !== undefined && trend.length >= 2 && (
          <span className={styles.trend} aria-hidden="true">
            <Sparkline data={trend} color={toneColor} />
          </span>
        )}
      </div>
    </Card>
  )
}
