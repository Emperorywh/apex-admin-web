/**
 * Dashboard 页面（规格 §14.2/§15）：唯一默认 affix 页签（规格 §4.2），页面权限 dashboard:view。
 * 统计卡片区（userCount/enabledUserCount/roleCount/todayLoginCount，SPEC_UI2 §8 slash
 * workbench 式：彩色浅底图标块 + 大数字 + 环比文案 + Sparkline 迷你趋势图，趋势序列
 * 由 overview 既有时间序列推导）+ 三类图表（登录趋势折线、用户增长柱形、角色分布环形）；
 * 数据统一来自 GET /dashboard/overview（useDashboard），图表经 useECharts 渲染并随页签
 * 激活态与主题变化重建（规格 §9.2/§15）；标题文案经 dashboard 命名空间翻译（规格 §12）。
 */
import { useMemo, useRef } from 'react'
import { Button, Card, Col, Empty, Row, Spin, theme } from 'antd'
import { LogIn, ShieldCheck, UserCheck, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DASHBOARD_I18N_NAMESPACE } from '@/constants/dashboard/dashboard.constants'
import { OverviewCard } from '@/features/dashboard/components/OverviewCard/OverviewCard'
import { useDashboard } from '@/features/dashboard/hooks/useDashboard'
import { useECharts } from '@/hooks/useECharts'
import { usePageActive } from '@/hooks/usePageActive'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'
import type { EChartsCoreOption } from 'echarts/core'
import {
  buildDashboardChartTheme,
  buildLoginTrendOption,
  buildRoleDistributionOption,
  buildUserGrowthOption,
} from './Dashboard.charts'
import styles from './Dashboard.module.css'

/** 图表面板：Card 标题 + 图表容器；option 为 null（暂无数据）时不写入图表数据 */
function ChartPanel({ title, option, active }: { title: string; option: EChartsCoreOption | null; active: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  useECharts(containerRef, option, { active })
  return (
    <Card title={title} className={styles.chartCard}>
      <div ref={containerRef} className={styles.chartContainer} role="img" aria-label={title} />
    </Card>
  )
}

/** 序列取值数组：{ date, count }[] → number[]（按时间升序） */
function seriesValues(series: ReadonlyArray<{ count: number }>): number[] {
  return series.map((point) => point.count)
}

/** 带符号差值文案：如 +3 / -2 / +0（环比展示用） */
function signedDiff(diff: number): string {
  return `${diff >= 0 ? '+' : ''}${diff}`
}

/** 统计卡衍生数据：趋势序列与环比文案（全部由 overview 既有时间序列确定性推导） */
function deriveStatTrends(overview: DashboardOverview, t: (key: string, options?: Record<string, unknown>) => string) {
  const userGrowth = seriesValues(overview.userGrowth)
  const loginTrend = seriesValues(overview.loginTrend)
  // 启用用户无独立序列：按当前启用占比对增长序列等比缩放（确定性推导）
  const enabledRatio = overview.stats.userCount === 0 ? 0 : overview.stats.enabledUserCount / overview.stats.userCount
  const enabledSeries = userGrowth.map((count) => Math.round(count * enabledRatio))
  const growthDelta =
    userGrowth.length >= 2 ? userGrowth[userGrowth.length - 1] - userGrowth[0] : 0
  const loginDelta = loginTrend.length >= 2 ? loginTrend[loginTrend.length - 1] - loginTrend[loginTrend.length - 2] : 0
  return {
    userTrend: userGrowth,
    userDelta: t('近{{days}}日 {{diff}}', { days: userGrowth.length, diff: signedDiff(growthDelta) }),
    enabledTrend: enabledSeries,
    enabledDelta: t('近{{days}}日 {{diff}}', {
      days: enabledSeries.length,
      diff: signedDiff(enabledSeries.length >= 2 ? enabledSeries[enabledSeries.length - 1] - enabledSeries[0] : 0),
    }),
    loginTrend,
    loginDelta: t('较昨日 {{diff}}', { diff: signedDiff(loginDelta) }),
  }
}

export function Dashboard() {
  const { t } = useTranslation(DASHBOARD_I18N_NAMESPACE)
  const { overview, loading, refresh } = useDashboard()
  // 页签激活态：隐藏页图表暂停 resize 监听，重新激活后延迟重建/resize（规格 §9.2/§15）
  const active = usePageActive()
  const { token } = theme.useToken()
  const chartTheme = useMemo(() => buildDashboardChartTheme(token), [token])
  const loginTrendOption = useMemo(
    () => (overview === null ? null : buildLoginTrendOption(overview, chartTheme)),
    [overview, chartTheme],
  )
  const userGrowthOption = useMemo(
    () => (overview === null ? null : buildUserGrowthOption(overview, chartTheme)),
    [overview, chartTheme],
  )
  const roleDistributionOption = useMemo(
    () => (overview === null ? null : buildRoleDistributionOption(overview, chartTheme)),
    [overview, chartTheme],
  )
  const statTrends = useMemo(() => (overview === null ? null : deriveStatTrends(overview, t)), [overview, t])

  return (
    <div className={styles.dashboard}>
      <Row gutter={[12, 12]}>
        <Col xs={12} xl={6}>
          <OverviewCard
            title="用户总数"
            value={overview?.stats.userCount ?? 0}
            icon={UsersRound}
            tone="primary"
            trend={statTrends?.userTrend}
            delta={statTrends?.userDelta}
            loading={loading && overview === null}
          />
        </Col>
        <Col xs={12} xl={6}>
          <OverviewCard
            title="启用用户"
            value={overview?.stats.enabledUserCount ?? 0}
            icon={UserCheck}
            tone="success"
            trend={statTrends?.enabledTrend}
            delta={statTrends?.enabledDelta}
            loading={loading && overview === null}
          />
        </Col>
        <Col xs={12} xl={6}>
          <OverviewCard
            title="角色数量"
            value={overview?.stats.roleCount ?? 0}
            icon={ShieldCheck}
            tone="warning"
            loading={loading && overview === null}
          />
        </Col>
        <Col xs={12} xl={6}>
          <OverviewCard
            title="今日登录"
            value={overview?.stats.todayLoginCount ?? 0}
            icon={LogIn}
            tone="error"
            trend={statTrends?.loginTrend}
            delta={statTrends?.loginDelta}
            loading={loading && overview === null}
          />
        </Col>
      </Row>
      {overview === null ? (
        loading ? (
          <div className={styles.chartLoading}>
            <Spin />
          </div>
        ) : (
          <Card>
            <Empty description={t('概览数据加载失败')}>
              <Button type="primary" onClick={() => void refresh()}>
                {t('重试')}
              </Button>
            </Empty>
          </Card>
        )
      ) : (
        <Row gutter={[12, 12]}>
          <Col xs={24} xl={16}>
            <ChartPanel title={t('登录趋势')} option={loginTrendOption} active={active} />
          </Col>
          <Col xs={24} xl={8}>
            <ChartPanel title={t('角色分布')} option={roleDistributionOption} active={active} />
          </Col>
          <Col xs={24}>
            <ChartPanel title={t('用户增长')} option={userGrowthOption} active={active} />
          </Col>
        </Row>
      )}
    </div>
  )
}
