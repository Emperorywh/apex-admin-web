/**
 * 合并业务首页（P34）：模板仪表盘与旧实时看板合并到 /dashboard 的同一实例（D29）。
 *
 * 业务形态等价迁移旧 RealtimeDashboard（本轮逐面板核对）：
 * - 8 个 KPI（今日任务总数/完成率/在线·总 AGV/故障数/平均耗时/平均每小时完成/利用率/积压），
 *   计算口径集中在 features/dashboard/realtime.ts（图表与卡片共用一份快照）；
 * - AGV 状态分布环形图（中心在线数）+ 今日任务完成趋势双折线（今日 vs 昨日同时刻）；
 * - 实时告警滚动列表（未关闭告警 100 条上限，持续时长现算）；
 * - 旧「最近完成任务」表格从未渲染（恒为空、不可达），按 D24 不迁移（tasks/P34.md 登记）。
 *
 * 行为契约：
 * - 唯一 5 秒可见串行轮询（useRealtimeDashboard → useVisiblePolling）：
 *   隐藏暂停、恢复即查、失败退避；看板与告警两区域独立成败独立清空（DoD 6）；
 * - 失败态用 StateBlock（无重试按钮——按钮纪律：恢复依赖可见轮询自动重查）；
 * - 导航契约（页面宿主组装，features 域隔离）：今日任务总数卡 → 任务管理（P03）、
 *   告警来源车辆 → /vehicle-info（P39）、关联订单 → /order-info（P38）、
 *   告警面板标题行 → 故障告警页（P36 交付后启用的契约项），
 *   均按目标菜单码做权限过滤（无权限不渲染入口，DoD 3）。
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button, Empty, Skeleton, Tooltip } from 'antd'
import {
  Car,
  CircleHelp,
  Clock3,
  Gauge,
  Inbox,
  ListTodo,
  Percent,
  TriangleAlert,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { StateBlock } from '@/components/StateBlock/StateBlock'
import { PERM } from '@/constants/auth/permission.constants'
import { buildAccessContext, hasMenuAccess } from '@/router/routeAccess'
import { useAppSelector } from '@/hooks/useAppSelector'
import { buildOrderInfoPath } from '@/features/order-detail/orderDetailNavigation'
import { buildVehicleInfoPath } from '@/features/vehicle-detail/vehicleDetailNavigation'
import { useRealtimeDashboard } from '@/features/dashboard/hooks/useRealtimeDashboard'
import { buildKpiViewModel, buildScalarKpiViewModel } from '@/features/dashboard/kpiViewModel'
import type { KpiViewModel } from '@/features/dashboard/kpiViewModel'
import { RealtimeKpiCard } from '@/features/dashboard/components/RealtimeKpiCard'
import { VehicleStatusDonut } from '@/features/dashboard/components/VehicleStatusDonut'
import { TodayTrendLine } from '@/features/dashboard/components/TodayTrendLine'
import { OpenAlertList } from '@/features/dashboard/components/OpenAlertList'
import type { VehicleStatusKey } from '@/features/dashboard/realtime'
import styles from '@/pages/dashboard/Dashboard/Dashboard.module.css'

/** KPI 卡配置：图标 + 标签 key + 口径说明 key（文案走 dashboard 命名空间，中文 key 即文案） */
interface KpiCardConfig {
  key: string
  icon: LucideIcon
  labelKey: string
  hintKey: string
}

/** 8 张 KPI 卡（旧 2×4 布局，响应式栅格自动换行） */
const KPI_CARDS: KpiCardConfig[] = [
  { key: 'todayTaskTotal', icon: ListTodo, labelKey: '今日任务总数', hintKey: '今日任务总数·计算方式' },
  { key: 'todayCompletionRate', icon: Percent, labelKey: '今日任务完成率', hintKey: '今日任务完成率·计算方式' },
  { key: 'onlineVehicle', icon: Car, labelKey: '在线 AGV / 总 AGV', hintKey: '在线 AGV / 总 AGV·计算方式' },
  { key: 'faultVehicleCount', icon: TriangleAlert, labelKey: '故障 AGV 数', hintKey: '故障 AGV 数·计算方式' },
  { key: 'averageCompletedDurationMs', icon: Clock3, labelKey: '今日已完成任务平均耗时', hintKey: '今日已完成任务平均耗时·计算方式' },
  { key: 'averageHourlyCompletedCount', icon: TrendingUp, labelKey: '今日平均每小时完成任务数', hintKey: '今日平均每小时完成任务数·计算方式' },
  { key: 'fleetUtilization', icon: Gauge, labelKey: 'AGV 综合利用率', hintKey: 'AGV 综合利用率·计算方式' },
  { key: 'backlogCount', icon: Inbox, labelKey: '当前任务积压', hintKey: '当前任务积压·计算方式' },
]

/** 口径提示图标（面板标题行内联；Tooltip 键盘可达，KPI 卡同款交互） */
const HintIcon = CircleHelp

/** 图表面板壳：卡片 + 标题行（含口径提示与可选标题行动作）+ 固定高度内容区 */
function DashboardPanel({
  title,
  hint,
  hintLabel,
  spanClass,
  bodyHeight,
  action,
  children,
}: {
  title: string
  hint?: ReactNode
  hintLabel?: string
  spanClass: string
  bodyHeight: number
  /** 标题行右侧动作（如「查看全部告警」入口）；不传则不渲染 */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={`${styles.card} ${styles.panel} ${spanClass}`}>
      <h3 className={styles.panelTitle}>
        {title}
        {hint && hintLabel ? (
          // 口径提示：图标 + Tooltip（键盘聚焦受控展示，P33 MetricHint 同款交互）
          <PanelHint content={hint} label={hintLabel} />
        ) : null}
        {action ? <span className={styles.panelAction}>{action}</span> : null}
      </h3>
      <div className={styles.panelBody} style={{ height: bodyHeight }}>
        {children}
      </div>
    </section>
  )
}

/** 面板标题口径提示：键盘聚焦/悬停展示完整口径文案 */
function PanelHint({ content, label }: { content: ReactNode; label: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <Tooltip
      placement="bottom"
      overlayInnerStyle={{ maxWidth: 320, whiteSpace: 'pre-line' }}
      mouseEnterDelay={0.2}
      open={focused ? true : undefined}
      onOpenChange={(open) => {
        if (!open && focused) setFocused(false)
      }}
      title={content}
    >
      <span
        className={styles.panelHint}
        tabIndex={0}
        role="button"
        aria-label={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <HintIcon size={13} strokeWidth={2} aria-hidden="true" />
      </span>
    </Tooltip>
  )
}

export default function Dashboard() {
  const { t, i18n } = useTranslation('dashboard')
  const navigate = useNavigate()
  const auth = useAppSelector((state) => state.auth)
  const { snapshot, alerts, loading, boardError, alertsError } = useRealtimeDashboard()

  // 权限上下文（与守卫同一解析函数）：导航入口按目标菜单码过滤（DoD 3）
  const accessCtx = useMemo(() => buildAccessContext(auth), [auth])
  const canOpenOrders = hasMenuAccess(accessCtx, PERM.ORDER_RECORD_VIEW)
  const canOpenVehicles = hasMenuAccess(accessCtx, PERM.VEHICLE_LIST_VIEW)
  // P36 交付后启用（TASKS P34→P36 补验项）：告警面板 → 故障告警页入口
  const canOpenFaultPage = hasMenuAccess(accessCtx, PERM.DASHBOARD_FAULT_VIEW)

  const firstLoad = loading && snapshot === null
  const locale = i18n.language

  /* ------------------------------ KPI 展示模型 ------------------------------ */

  const kpiViews = useMemo<Record<string, KpiViewModel>>(() => {
    const empty: Record<string, KpiViewModel> = {}
    if (!snapshot) return empty
    const k = snapshot.kpis
    return {
      todayTaskTotal: buildKpiViewModel(k.todayTaskTotal, 'integer', locale),
      todayCompletionRate: buildKpiViewModel(k.todayCompletionRate, 'percentage', locale),
      // 复合展示「在线 / 总数」：两个整数各自千分位（旧实现同款拼接）
      onlineVehicle: {
        display: `${buildScalarKpiViewModel(k.onlineVehicleCount, 'integer', locale).display} / ${buildScalarKpiViewModel(k.totalVehicleCount, 'integer', locale).display}`,
        changeTone: 'neutral',
      },
      faultVehicleCount: buildScalarKpiViewModel(k.faultVehicleCount, 'integer', locale),
      averageCompletedDurationMs: buildKpiViewModel(k.averageCompletedDurationMs, 'duration', locale),
      averageHourlyCompletedCount: buildKpiViewModel(k.averageHourlyCompletedCount, 'decimal', locale),
      fleetUtilization: buildKpiViewModel(k.fleetUtilization, 'percentage', locale),
      backlogCount: buildScalarKpiViewModel(k.backlogCount, 'integer', locale),
    }
  }, [snapshot, locale])

  /** KPI 强调边框：故障数 > 0 红、积压 > 5 橙（旧实现阈值等价保留） */
  const kpiAccent = (key: string): 'danger' | 'warn' | undefined => {
    if (!snapshot) return undefined
    if (key === 'faultVehicleCount' && snapshot.kpis.faultVehicleCount > 0) return 'danger'
    if (key === 'backlogCount' && snapshot.kpis.backlogCount > 5) return 'warn'
    return undefined
  }

  /* ------------------------------ 图表入参 ------------------------------ */

  const statusLabels = useMemo(
    () =>
      ({
        running: t('运行'),
        idle: t('空闲'),
        charging: t('充电'),
        fault: t('故障'),
        offline: t('离线'),
      }) satisfies Record<VehicleStatusKey, string>,
    [t],
  )

  /* ------------------------------ 导航回调 ------------------------------ */

  const openOrders = useMemo(
    () => (canOpenOrders ? () => navigate('/order-record') : undefined),
    [canOpenOrders, navigate],
  )
  const openVehicle = useMemo(
    () =>
      canOpenVehicles
        ? (vehicleKey: string) => navigate(buildVehicleInfoPath(vehicleKey))
        : undefined,
    [canOpenVehicles, navigate],
  )
  const openOrder = useMemo(
    () => (canOpenOrders ? (orderKey: string) => navigate(buildOrderInfoPath(orderKey)) : undefined),
    [canOpenOrders, navigate],
  )
  // 故障告警页入口（P36 导航契约；无权限不渲染入口）
  const openFaultPage = useMemo(
    () => (canOpenFaultPage ? () => navigate('/analyze-visual/dashboard-fault') : undefined),
    [canOpenFaultPage, navigate],
  )

  /* ------------------------------ 渲染 ------------------------------ */

  const renderKpiRow = () => (
    <div className={styles.kpiRow}>
      {KPI_CARDS.map((card) => (
        <RealtimeKpiCard
          key={card.key}
          icon={card.icon}
          label={t(card.labelKey)}
          hint={t(card.hintKey)}
          hintLabel={t('查看统计口径')}
          value={
            firstLoad
              ? { display: '', changeTone: 'neutral' }
              : (kpiViews[card.key] ?? { display: '--', changeTone: 'neutral' })
          }
          loading={firstLoad}
          accent={kpiAccent(card.key)}
          // 今日任务总数卡 → 任务管理（P03 导航契约；无权限不渲染入口）
          onOpen={card.key === 'todayTaskTotal' ? openOrders : undefined}
        />
      ))}
    </div>
  )

  const renderBoardArea = () => {
    // 看板聚合真实失败：KPI/图表区域统一错误态（远端区域已清空，轮询自动恢复）
    if (boardError && !snapshot) {
      return (
        <div className={styles.boardError}>
          <StateBlock variant="offline" />
        </div>
      )
    }
    if (firstLoad || !snapshot) {
      return (
        <>
          {renderKpiRow()}
          <div className={styles.grid}>
            <DashboardPanel title={t('AGV 状态分布')} spanClass={styles.span4} bodyHeight={272}>
              <Skeleton active title={false} paragraph={{ rows: 5 }} />
            </DashboardPanel>
            <DashboardPanel title={t('今日任务完成趋势')} spanClass={styles.span8} bodyHeight={272}>
              <Skeleton active title={false} paragraph={{ rows: 6 }} />
            </DashboardPanel>
          </div>
        </>
      )
    }
    const statusEmpty = snapshot.vehicleStatus.every((entry) => entry.count === 0)
    return (
      <>
        {renderKpiRow()}
        <div className={styles.grid}>
          <DashboardPanel
            title={t('AGV 状态分布')}
            hint={t('AGV 状态分布·计算方式')}
            hintLabel={t('查看统计口径')}
            spanClass={styles.span4}
            bodyHeight={272}
          >
            {statusEmpty ? (
              // 全零 = 无注册车辆的快照事实：明确空态（区别于查询失败）
              <div className={styles.chartEmpty}>
                <Empty description={t('暂无数据')} />
              </div>
            ) : (
              <VehicleStatusDonut
                data={snapshot.vehicleStatus}
                onlineCount={snapshot.kpis.onlineVehicleCount}
                labels={statusLabels}
                centerLabel={t('在线 AGV（台）')}
                unitSuffix={t('台')}
              />
            )}
          </DashboardPanel>
          <DashboardPanel
            title={t('今日任务完成趋势')}
            hint={t('今日任务完成趋势·计算方式')}
            hintLabel={t('查看统计口径')}
            spanClass={styles.span8}
            bodyHeight={272}
          >
            <TodayTrendLine
              data={snapshot.todayTaskTrend}
              todayLabel={t('今日')}
              yesterdayLabel={t('昨日')}
              yAxisName={t('任务数量（个）')}
              unitSuffix={t('个')}
            />
          </DashboardPanel>
        </div>
      </>
    )
  }

  const renderAlertsArea = () => (
    <div className={styles.grid}>
      <DashboardPanel
        title={t('实时告警')}
        hint={t('实时告警·计算方式')}
        hintLabel={t('查看统计口径')}
        spanClass={styles.span12}
        bodyHeight={252}
        // P36 导航契约：告警面板标题行 → 故障告警页（无权限不渲染入口）
        action={
          openFaultPage ? (
            <Button type="link" size="small" onClick={openFaultPage}>
              {t('查看全部告警')}
            </Button>
          ) : undefined
        }
      >
        {alertsError && alerts === null ? (
          // 告警区域独立失败：错误态只覆盖本面板（不用「无告警」冒充，D15）
          <StateBlock variant="offline" />
        ) : alerts && alerts.length > 0 ? (
          <OpenAlertList
            items={alerts}
            locale={locale}
            levelLabels={{ FATAL: t('严重'), WARNING: t('重要') }}
            onOpenVehicle={openVehicle}
            onOpenOrder={openOrder}
          />
        ) : alerts ? (
          // 真实空结果（接口成功且无未关闭告警）：明确「暂无未关闭告警」
          <div className={styles.chartEmpty}>
            <Empty description={t('暂无未关闭告警')} />
          </div>
        ) : (
          <Skeleton active title={false} paragraph={{ rows: 4 }} />
        )}
      </DashboardPanel>
    </div>
  )

  return (
    <div>
      {renderBoardArea()}
      {renderAlertsArea()}
    </div>
  )
}
