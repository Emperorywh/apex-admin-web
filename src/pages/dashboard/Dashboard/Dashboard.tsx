/**
 * Dashboard 页面（规格 §14.2/§15；视觉 SPEC_UI2 §8 全面重排）：唯一默认 affix 页签
 * （规格 §4.2），页面权限 dashboard:view。
 * 统计卡片区改 slash workbench 式（彩色浅底图标块 + 大数字 + 环比文案 + Sparkline
 * 迷你趋势）；三类图表（登录趋势折线、用户增长柱形、角色分布环形）卡片化重排。
 * 数据统一来自 GET /dashboard/overview（useDashboard）；demo 构建携带 statTrends
 * 私有扩展（SPEC_UI2 §8），真实后端缺省时回退 loginTrend/userGrowth 派生序列。
 * 图表经 useECharts 渲染并随页签激活态与主题变化重建（规格 §9.2/§15）；
 * 标题文案经 dashboard 命名空间翻译（规格 §12）。
 */
import { useMemo, useRef } from 'react'
import { Button, Card, Col, Empty, Row, Spin, theme } from 'antd'
import { LogIn, ShieldCheck, UserCheck, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DASHBOARD_I18N_NAMESPACE } from '@/constants/dashboard/dashboard.constants'
import { OverviewCard } from '@/features/dashboard/components/OverviewCard/OverviewCard'
import type { OverviewCardTone } from '@/features/dashboard/components/OverviewCard/OverviewCard'
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
  deriveDeltaPercent,
} from './Dashboard.charts'
import styles from './Dashboard.module.css'

/** 统计卡配置：标题 key / 图标 / 色调 / 趋势序列取数（demo 扩展优先，缺省回退派生） */
interface StatCardSpec {
  title: string
  icon: typeof UsersRound
  tone: OverviewCardTone
  statKey: keyof DashboardOverview['stats']
}

const STAT_CARDS: readonly StatCardSpec[] = [
  { title: '用户总数', icon: UsersRound, tone: 'primary', statKey: 'userCount' },
  { title: '启用用户', icon: UserCheck, tone: 'success', statKey: 'enabledUserCount' },
  { title: '角色数量', icon: ShieldCheck, tone: 'warning', statKey: 'roleCount' },
  { title: '今日登录', icon: LogIn, tone: 'info', statKey: 'todayLoginCount' },
]

/** demo 私有扩展形状校验（SPEC_UI2 §8）：逐字段为等长 number 数组才采纳 */
function readDemoStatTrends(overview: DashboardOverview): Partial<Record<keyof DemoStatTrends, number[]>> {
  const raw = (overview as { statTrends?: unknown }).statTrends
  if (typeof raw !== 'object' || raw === null) {
    return {}
  }
  const result: Partial<Record<keyof DemoStatTrends, number[]>> = {}
  for (const key of ['userCount', 'enabledUserCount', 'roleCount', 'todayLoginCount'] as const) {
    const series = (raw as Record<string, unknown>)[key]
    if (Array.isArray(series) && series.every((value) => typeof value === 'number')) {
      result[key] = series
    }
  }
  return result
}

type DemoStatTrends = { userCount: number[]; enabledUserCount: number[]; roleCount: number[]; todayLoginCount: number[] }

/**
 * 统计卡趋势序列取数（SPEC_UI2 §8）：demo statTrends 优先；缺省回退——
 * 用户总数/启用用户/角色数量用 userGrowth、今日登录用 loginTrend 的计数序列。
 */
function resolveStatTrend(
  overview: DashboardOverview,
  statKey: keyof DashboardOverview['stats'],
): readonly number[] | undefined {
  const demo = readDemoStatTrends(overview)[statKey]
  if (demo !== undefined) {
    return demo
  }
  if (statKey === 'todayLoginCount') {
    return overview.loginTrend.map((point) => point.count)
  }
  return overview.userGrowth.map((point) => point.count)
}

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

  return (
    <div className={styles.dashboard}>
      <Row gutter={[16, 16]}>
        {STAT_CARDS.map(({ title, icon, tone, statKey }) => {
          const trend = overview === null ? undefined : resolveStatTrend(overview, statKey)
          return (
            <Col xs={12} xl={6} key={statKey}>
              <OverviewCard
                title={title}
                value={overview?.stats[statKey] ?? 0}
                icon={icon}
                tone={tone}
                trend={trend}
                deltaPercent={deriveDeltaPercent(trend)}
                loading={loading && overview === null}
              />
            </Col>
          )
        })}
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
        <Row gutter={[16, 16]}>
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
