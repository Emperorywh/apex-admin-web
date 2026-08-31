/**
 * Dashboard 页面（AGV 调度概览，纯前端模式）：
 * 数据来自 dashboard.demoData 的确定性演示数据（无请求层、无随机数）。
 * 统计卡片区（在线 AGV / 今日任务 / 平均任务时长 / 今日异常，SPEC_UI2 §8 workbench
 * 式：彩色浅底图标块 + 大数值 + 环比文案 + Sparkline 迷你趋势）+ 七个图表面板
 * （24H 吞吐折线、状态环形、区域柱形、利用率排行条形、任务类型玫瑰、区域时段热力、
 * 完成率仪表盘）；图表经 useECharts 渲染并随页签激活态与主题变化重建（规格 §9.2/§15）；
 * 文案经 dashboard 命名空间翻译（规格 §12）。
 */
import { useCallback, useMemo, useRef } from 'react'
import { Card, Col, Row, theme } from 'antd'
import { Bot, Route, Timer, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AGV_DASHBOARD_DEMO_DATA } from '@/constants/dashboard/dashboard.demoData'
import { DASHBOARD_I18N_NAMESPACE } from '@/constants/dashboard/dashboard.constants'
import { OverviewCard } from '@/features/dashboard/components/OverviewCard/OverviewCard'
import { useECharts } from '@/hooks/useECharts'
import { usePageActive } from '@/hooks/usePageActive'
import type { EChartsCoreOption } from 'echarts/core'
import {
  buildAreaTaskOption,
  buildCompletionGaugeOption,
  buildDashboardChartTheme,
  buildHeatmapOption,
  buildStatusDistributionOption,
  buildTaskTypeOption,
  buildThroughputOption,
  buildUtilizationOption,
} from './Dashboard.charts'
import styles from './Dashboard.module.css'

/** 图表面板：Card 标题 + 图表容器 */
function ChartPanel({ title, option, active }: { title: string; option: EChartsCoreOption; active: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  useECharts(containerRef, option, { active })
  return (
    <Card title={title} className={styles.chartCard}>
      <div ref={containerRef} className={styles.chartContainer} role="img" aria-label={title} />
    </Card>
  )
}

/** 带符号差值文案：如 +16 / -0.6 / +0（绝对值环比展示用） */
function signedDelta(current: number, previous: number): string {
  const diff = Number((current - previous).toFixed(1))
  return `${diff >= 0 ? '+' : ''}${diff}`
}

/** 带符号百分比差值文案：如 +6.3 / -1.2（比率环比展示用，保留一位小数） */
function signedPercentDelta(current: number, previous: number): string {
  if (previous === 0) {
    return '+0'
  }
  const percent = Number((((current - previous) / previous) * 100).toFixed(1))
  return `${percent >= 0 ? '+' : ''}${percent}`
}

export function Dashboard() {
  const { t } = useTranslation(DASHBOARD_I18N_NAMESPACE)
  // 页签激活态：隐藏页图表暂停 resize 监听，重新激活后延迟重建/resize（规格 §9.2/§15）
  const active = usePageActive()
  const { token } = theme.useToken()
  const snapshot = AGV_DASHBOARD_DEMO_DATA
  const { stats } = snapshot
  const chartTheme = useMemo(() => buildDashboardChartTheme(token), [token])
  const translate = useCallback((key: string): string => t(key), [t])

  const completionRate =
    stats.todayTaskCount === 0 ? 0 : Number(((stats.todayCompletedCount / stats.todayTaskCount) * 100).toFixed(1))

  const options = useMemo(
    () => ({
      throughput: buildThroughputOption(snapshot, chartTheme, translate),
      status: buildStatusDistributionOption(snapshot, chartTheme, translate),
      area: buildAreaTaskOption(snapshot, chartTheme, translate),
      utilization: buildUtilizationOption(snapshot, chartTheme),
      taskType: buildTaskTypeOption(snapshot, chartTheme, translate),
      heatmap: buildHeatmapOption(snapshot, chartTheme, translate),
      completion: buildCompletionGaugeOption(
        snapshot,
        chartTheme,
        t('较昨日 {{diff}}%', { diff: signedPercentDelta(completionRate, stats.yesterdayCompletionRate) }),
      ),
    }),
    [snapshot, chartTheme, translate, t, completionRate, stats.yesterdayCompletionRate],
  )

  return (
    <div className={styles.dashboard}>
      <Row gutter={[12, 12]}>
        <Col xs={12} xl={6}>
          <OverviewCard
            title="在线AGV"
            value={stats.agvOnline}
            suffix="台"
            icon={Bot}
            tone="primary"
            trend={snapshot.onlineTrend}
            delta={t('在线率 {{percent}}%', { percent: ((stats.agvOnline / stats.agvTotal) * 100).toFixed(1) })}
          />
        </Col>
        <Col xs={12} xl={6}>
          <OverviewCard
            title="今日任务"
            value={stats.todayTaskCount}
            suffix="单"
            icon={Route}
            tone="success"
            trend={snapshot.cumulativeTaskTrend}
            delta={t('较昨日 {{diff}}%', {
              diff: signedPercentDelta(stats.todayTaskCount, stats.yesterdayTaskCount),
            })}
          />
        </Col>
        <Col xs={12} xl={6}>
          <OverviewCard
            title="平均任务时长"
            value={stats.avgTaskDurationMin}
            suffix="分钟"
            icon={Timer}
            tone="warning"
            trend={snapshot.durationTrend}
            delta={t('较昨日 {{diff}}', {
              diff: signedDelta(stats.avgTaskDurationMin, stats.yesterdayAvgTaskDurationMin),
            })}
          />
        </Col>
        <Col xs={12} xl={6}>
          <OverviewCard
            title="今日异常"
            value={stats.todayAlarmCount}
            suffix="次"
            icon={TriangleAlert}
            tone="error"
            trend={snapshot.alarmTrend}
            delta={t('较昨日 {{diff}}', { diff: signedDelta(stats.todayAlarmCount, stats.yesterdayAlarmCount) })}
          />
        </Col>
      </Row>
      <Row gutter={[12, 12]}>
        <Col xs={24} xl={16}>
          <ChartPanel title={t('任务吞吐趋势')} option={options.throughput} active={active} />
        </Col>
        <Col xs={24} xl={8}>
          <ChartPanel title={t('AGV状态分布')} option={options.status} active={active} />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <ChartPanel title={t('区域任务量分布')} option={options.area} active={active} />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <ChartPanel title={t('AGV利用率排行')} option={options.utilization} active={active} />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <ChartPanel title={t('任务类型分布')} option={options.taskType} active={active} />
        </Col>
        <Col xs={24} xl={16}>
          <ChartPanel title={t('区域时段任务热力')} option={options.heatmap} active={active} />
        </Col>
        <Col xs={24} xl={8}>
          <ChartPanel title={t('任务完成率')} option={options.completion} active={active} />
        </Col>
      </Row>
    </div>
  )
}
