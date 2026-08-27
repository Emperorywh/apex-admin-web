/**
 * 运营总览页：复刻设计稿的整页布局（主内容 + 实时事件侧栏）。
 */

import { Alert } from 'antd'
import { DashboardHeader } from '@/features/dashboard/components/DashboardHeader/DashboardHeader'
import { KpiRow } from '@/features/dashboard/components/KpiRow/KpiRow'
import { WorkflowPanel } from '@/features/dashboard/components/WorkflowPanel/WorkflowPanel'
import { TopologyPanel } from '@/features/dashboard/components/TopologyPanel/TopologyPanel'
import { SchedulePanel } from '@/features/dashboard/components/SchedulePanel/SchedulePanel'
import { AlertsPanel } from '@/features/dashboard/components/AlertsPanel/AlertsPanel'
import { EventFeedPanel } from '@/features/dashboard/components/EventFeedPanel/EventFeedPanel'
import { useDashboard } from '@/features/dashboard/hooks/useDashboard'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'
import styles from '@/pages/dashboard/Dashboard/Dashboard.module.css'

/** 数据未就绪时的占位模型（保持骨架尺寸与最终布局一致） */
const EMPTY_OVERVIEW: DashboardOverview = {
  kpis: [],
  workflow: {
    version: '—',
    runningFor: '—',
    performancePercent: 0,
    chainPercent: '—',
    stageLabels: [],
    nodes: [],
    edges: [],
    dots: [],
  },
  topology: { score: 0, scoreLabel: '—', healthItems: [], regions: [] },
  schedule: { year: 1970, month: 1, today: 1, todos: [] },
  alerts: [],
  events: [],
  alertCount: 0,
}

export default function Dashboard() {
  const { data, loading, error, refresh } = useDashboard()
  const overview = data ?? EMPTY_OVERVIEW

  return (
    <div className={styles.layout}>
      <section className={styles.main}>
        <DashboardHeader refreshing={loading} onRefresh={() => void refresh()} />
        {error ? <Alert type="error" showIcon message={error} className={styles.error} /> : null}
        <div className={styles.contentGrid}>
          <KpiRow metrics={overview.kpis} />
          <div className={styles.row2}>
            <WorkflowPanel model={overview.workflow} />
            <TopologyPanel model={overview.topology} />
          </div>
          <div className={styles.row3}>
            <SchedulePanel model={overview.schedule} />
            <AlertsPanel alerts={overview.alerts} pendingCount={overview.alertCount} />
          </div>
        </div>
      </section>
      <aside className={styles.side}>
        <EventFeedPanel initialEvents={overview.events} />
      </aside>
    </div>
  )
}
