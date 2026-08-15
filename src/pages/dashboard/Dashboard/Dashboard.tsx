/**
 * Dashboard 页面（规格 §14.2/§15）：唯一默认 affix 页签（规格 §4.2），页面权限 dashboard:view。
 * 统计卡片区（userCount/enabledUserCount/roleCount/todayLoginCount，OverviewCard）+
 * 三类图表（登录趋势折线、用户增长柱形、角色分布环形）；数据统一来自
 * GET /dashboard/overview（useDashboard），图表经 useECharts 渲染并随页签激活态与
 * 主题变化重建（规格 §9.2/§15）；标题文案经 dashboard 命名空间翻译（规格 §12）。
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
        <Col xs={12} xl={6}>
          <OverviewCard
            title="用户总数"
            value={overview?.stats.userCount ?? 0}
            icon={UsersRound}
            loading={loading && overview === null}
          />
        </Col>
        <Col xs={12} xl={6}>
          <OverviewCard
            title="启用用户"
            value={overview?.stats.enabledUserCount ?? 0}
            icon={UserCheck}
            loading={loading && overview === null}
          />
        </Col>
        <Col xs={12} xl={6}>
          <OverviewCard
            title="角色数量"
            value={overview?.stats.roleCount ?? 0}
            icon={ShieldCheck}
            loading={loading && overview === null}
          />
        </Col>
        <Col xs={12} xl={6}>
          <OverviewCard
            title="今日登录"
            value={overview?.stats.todayLoginCount ?? 0}
            icon={LogIn}
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
