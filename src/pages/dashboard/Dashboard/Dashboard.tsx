/**
 * 仪表盘页：AGV 调度统计总览。
 * 顶部 KPI 指标卡 + 趋势/分布/排行/告警图表面板；
 * 数据由 useDashboardOverview 提供（激活态 30 秒静默轮询）。
 */

import { useTranslation } from 'react-i18next'
import { Button, Skeleton } from 'antd'
import {
  CircleCheckBig,
  Hourglass,
  ListTodo,
  Route,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { StatCard, type StatCardTone } from '@/features/dashboard/components/StatCard/StatCard'
import { TrendAreaChart } from '@/features/dashboard/components/TrendAreaChart/TrendAreaChart'
import { DailyBarChart } from '@/features/dashboard/components/DailyBarChart/DailyBarChart'
import { StatusDonutChart } from '@/features/dashboard/components/StatusDonutChart/StatusDonutChart'
import { RankBars, type RankBarItem } from '@/features/dashboard/components/RankBars/RankBars'
import { RecentAlarmList } from '@/features/dashboard/components/RecentAlarmList/RecentAlarmList'
import { useDashboardOverview } from '@/features/dashboard/hooks/useDashboardOverview'
import type { DashboardOrderType, VehicleRuntimeState } from '@/types/dashboard/dashboard.types'
import styles from '@/pages/dashboard/Dashboard/Dashboard.module.css'

/** 任务类型 → 译文 key 与条形色 */
const ORDER_TYPE_META: Record<DashboardOrderType, { label: string; color: string }> = {
  WORK: { label: '工作', color: 'var(--app-blue)' },
  PARK: { label: '回桩', color: 'var(--app-green)' },
  CHARGE: { label: '充电', color: 'var(--app-orange)' },
  MOVE: { label: '空跑', color: 'var(--app-yellow)' },
}

/** 车辆运行状态 → 译文 key */
const VEHICLE_STATE_LABELS: Record<VehicleRuntimeState, string> = {
  IDLE: '空闲',
  RUNNING: '运行中',
  CHARGING: '充电中',
  ALARM: '告警',
  OFFLINE: '离线',
}

interface KpiCardConfig {
  key: string
  icon: LucideIcon
  tone: StatCardTone
  label: string
  suffix?: string
  invertDelta?: boolean
}

const KPI_CARDS: KpiCardConfig[] = [
  { key: 'todayOrders', icon: ListTodo, tone: 'blue', label: '今日任务' },
  { key: 'processing', icon: Route, tone: 'green', label: '执行中' },
  { key: 'queued', icon: Hourglass, tone: 'orange', label: '排队中' },
  { key: 'completionRate', icon: CircleCheckBig, tone: 'green', label: '完成率', suffix: '%' },
  { key: 'onlineVehicles', icon: Truck, tone: 'blue', label: '在线车辆' },
  { key: 'activeAlarms', icon: TriangleAlert, tone: 'red', label: '活跃告警', invertDelta: true },
]

/** 图表面板壳：玻璃卡片 + 标题行 + 固定高度内容区 */
function DashboardPanel({
  title,
  spanClass,
  bodyHeight,
  children,
}: {
  title: string
  spanClass: string
  bodyHeight: number
  children: ReactNode
}) {
  return (
    <section className={`ds-card ${styles.panel} ${spanClass}`}>
      <h3 className={`ds-card-title ${styles.panelTitle}`}>{title}</h3>
      <div className={styles.panelBody} style={{ height: bodyHeight }}>
        {children}
      </div>
    </section>
  )
}

export default function Dashboard() {
  const { t } = useTranslation('dashboard')
  const { t: tCommon } = useTranslation('common')
  const { overview, loading, error, reload } = useDashboardOverview()

  const firstLoad = loading && overview === null

  const vehicleStateLabelMap = Object.fromEntries(
    Object.entries(VEHICLE_STATE_LABELS).map(([state, label]) => [state, t(label)]),
  ) as Record<VehicleRuntimeState, string>

  const orderTypeItems: RankBarItem[] = (overview?.orderTypes ?? []).map((slice) => ({
    key: slice.orderType,
    label: t(ORDER_TYPE_META[slice.orderType].label),
    value: slice.count,
    color: ORDER_TYPE_META[slice.orderType].color,
  }))

  const vehicleRankItems: RankBarItem[] = (overview?.vehicleRank ?? []).map((item, index) => ({
    key: `${item.vehicleName}-${index}`,
    label: item.vehicleName,
    description: item.groupName,
    value: item.completedCount,
  }))

  if (firstLoad) {
    return (
      <div>
        <div className={styles.kpiRow}>
          {KPI_CARDS.map((card) => (
            <StatCard
              key={card.key}
              icon={card.icon}
              tone={card.tone}
              label={t(card.label)}
              value=""
              loading
            />
          ))}
        </div>
        <div className={styles.grid}>
          <DashboardPanel title={t('任务趋势（24 小时）')} spanClass={styles.span8} bodyHeight={272}>
            <Skeleton active title={false} paragraph={{ rows: 6 }} />
          </DashboardPanel>
          <DashboardPanel title={t('车辆状态分布')} spanClass={styles.span4} bodyHeight={272}>
            <Skeleton active title={false} paragraph={{ rows: 5 }} />
          </DashboardPanel>
          <DashboardPanel title={t('近7日任务统计')} spanClass={styles.span7} bodyHeight={262}>
            <Skeleton active title={false} paragraph={{ rows: 5 }} />
          </DashboardPanel>
          <DashboardPanel title={t('任务类型分布')} spanClass={styles.span5} bodyHeight={262}>
            <Skeleton active title={false} paragraph={{ rows: 5 }} />
          </DashboardPanel>
          <DashboardPanel title={t('车辆任务排行')} spanClass={styles.span7} bodyHeight={262}>
            <Skeleton active title={false} paragraph={{ rows: 5 }} />
          </DashboardPanel>
          <DashboardPanel title={t('最新告警')} spanClass={styles.span5} bodyHeight={262}>
            <Skeleton active title={false} paragraph={{ rows: 5 }} />
          </DashboardPanel>
        </div>
      </div>
    )
  }

  if (error && overview === null) {
    return (
      <div className={styles.errorBlock}>
        <TriangleAlert size={28} strokeWidth={2} />
        <Button danger onClick={reload}>
          {tCommon('加载失败，点击重试')}
        </Button>
      </div>
    )
  }

  if (!overview) return null

  return (
    <div>
      <div className={styles.kpiRow}>
        {KPI_CARDS.map((card) => {
          const metric = overview.kpi[card.key as keyof typeof overview.kpi]
          return (
            <StatCard
              key={card.key}
              icon={card.icon}
              tone={card.tone}
              label={t(card.label)}
              value={card.suffix ? metric.value.toFixed(1) : metric.value.toLocaleString()}
              suffix={card.suffix}
              deltaPercent={metric.deltaPercent}
              invertDelta={card.invertDelta}
            />
          )
        })}
      </div>

      <div className={styles.grid}>
        <DashboardPanel title={t('任务趋势（24 小时）')} spanClass={styles.span8} bodyHeight={272}>
          <TrendAreaChart
            points={overview.hourlyTrend}
            createdLabel={t('新建任务')}
            completedLabel={t('完成任务')}
          />
        </DashboardPanel>
        <DashboardPanel title={t('车辆状态分布')} spanClass={styles.span4} bodyHeight={272}>
          <StatusDonutChart
            slices={overview.vehicleStatus}
            labels={vehicleStateLabelMap}
            totalLabel={t('车辆总数')}
          />
        </DashboardPanel>
        <DashboardPanel title={t('近7日任务统计')} spanClass={styles.span7} bodyHeight={262}>
          <DailyBarChart stats={overview.dailyStats} completedLabel={t('已完成')} failedLabel={t('失败')} />
        </DashboardPanel>
        <DashboardPanel title={t('任务类型分布')} spanClass={styles.span5} bodyHeight={262}>
          <RankBars items={orderTypeItems} />
        </DashboardPanel>
        <DashboardPanel title={t('车辆任务排行')} spanClass={styles.span7} bodyHeight={262}>
          <RankBars items={vehicleRankItems} />
        </DashboardPanel>
        <DashboardPanel title={t('最新告警')} spanClass={styles.span5} bodyHeight={262}>
          <RecentAlarmList alarms={overview.recentAlarms} />
        </DashboardPanel>
      </div>
    </div>
  )
}
