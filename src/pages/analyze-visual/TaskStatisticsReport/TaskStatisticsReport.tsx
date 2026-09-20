/**
 * 任务统计报表页（P35 整页交付；旧 AnalyzeVisual/TaskStatisticsReport 等价迁移）。
 *
 * 业务结构（旧页逐面板核对；旧 index.tsx 顶部「不提供区间工具栏」的注释与
 * 实际渲染组件（含 TimeRangePicker 草稿工具栏）矛盾，以可达实现为准；
 * OpenAPI TaskStatisticsParam 声明 startTime/endTime，接口支持任意起止区间，
 * 旧 repository 联调注释同口径——「仅按天数统计」为过时注释，不构成约束）：
 * - 统计工具栏（草稿态）：车辆多选（仅任务统计链路消费，空 = 全部车辆）+
 *   时间区间（默认近 7 个自然日，部署时区墙钟）+ 查询按钮；点「查询」才把
 *   草稿应用为生效条件并触发请求，挂载时按默认条件自动查询一次；
 * - KPI 4 卡：总任务数 / 完成率 / 失败÷取消 / 平均执行时长（终态与创建口径，
 *   分母为 0 不可计算显示 "--"，绝不补 0，规格 11.2；失败 > 0 黄色强调）；
 * - 图表 4 张：任务量趋势堆叠柱（完成/失败/取消按天，缺失天补 0）、
 *   任务执行时长分布柱（固定 6 桶，无 P50/P90 标线）、
 *   车辆利用率排行横向柱（阈值色 + 纵向滚动，P37 有效状态口径）、
 *   利用率趋势折线（按天，缺失天 0、不可计算断线）；
 * - 明细表：每日统计明细（与任务量趋势同源同序——图表与 Apex 明细一致，
 *   A19），Apex data 模式（窗口天数的完整小集合，DoD 5 形态），
 *   数值列开放本地排序（P37 先例：表格级开关 + 列级开放）。
 *
 * 三条独立查询链路（旧实现同口径，任一失败只降级对应区域，互不影响）：
 * - 任务统计（taskStatistics）：KPI + 任务量趋势 + 时长分布 + 每日明细；
 * - 利用率排行（agvExecutingTimeStatistics）：只跟随统计区间，不消费车辆筛选；
 * - 利用率趋势（agvStateStatistics）：同上。
 *   利用率两图的「有效状态」（执行作业 + 执行充电 + 执行停靠）消费 P37 owner
 *   常量 EFFECTIVE_WORK_STATES；车辆聚合（groupByVehicle/secondsOfStatesInGroup）
 *   与窗口截断（computeWindowSeconds）同样消费 P37 owner 模块——features 域
 *   不得互相穿透导入（结构检查规则 3），故该组合在页面层完成，聚合结果传入
 *   P35 纯函数 buildVehicleUtilizationRanking 换算利用率。
 *
 * 行为契约：
 * - 失败区域立即清空并显示真实状态（KPI/图表区 StateBlock，恢复依赖可见有限
 *   退避自动重查与「查询」按钮；明细失败由 Apex 内建错误态承载——重试按钮仅
 *   表格内部，按钮纪律）；旧实现「失败保留上次数据仅留日志」与 DoD 6 冲突，
 *   不迁移——差异登记 tasks/P35.md；
 * - 空值纪律：单元格缺失留白；KPI 不可计算显示 "--"；利用率不可计算在排行图
 *   灰色呈现、趋势图断线（null ≠ 真实 0）；
 * - 本页为报表页，不默认轮询（规格 8.2）；查询为只读聚合 POST，可安全重查。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, DatePicker, Empty, Select, Skeleton } from 'antd'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { ApexTableReact } from 'apex-table-react'
import type {
  ApexColumnDef,
  ApexTableInstance,
  ApexTableRef,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
} from 'apex-table-react'
import { BarChart3, CalendarRange, ListTodo, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { StateBlock } from '@/components/StateBlock/StateBlock'
import { DEPLOY_TIMEZONE } from '@/constants/datetime'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { fetchSimpleVehicles } from '@/services/vehicle/vehicle.service'
import type { SimpleVehicleDto } from '@/services/vehicle/vehicle.service.types'
import { taskStatistics } from '@/services/report-task/report-task.service'
import {
  agvExecutingTimeStatistics,
  agvStateStatistics,
} from '@/services/report-vehicle-state/report-vehicle-state.service'
import {
  buildTaskStatistics,
  buildUtilizationTrend,
  buildVehicleUtilizationRanking,
  type DailyDetailRow,
  type TaskStatisticsView,
  type UtilizationTrendPoint,
  type VehicleUtilizationItem,
} from '@/features/analyze-visual/task-statistics/statistics'
import { useTaskReportQuery } from '@/features/analyze-visual/task-statistics/hooks/useTaskReportQuery'
import { TaskVolumeStackedBar } from '@/features/analyze-visual/task-statistics/components/TaskVolumeStackedBar'
import { DurationDistributionBar } from '@/features/analyze-visual/task-statistics/components/DurationDistributionBar'
import { VehicleUtilizationBar } from '@/features/analyze-visual/task-statistics/components/VehicleUtilizationBar'
import { UtilizationTrendLine } from '@/features/analyze-visual/task-statistics/components/UtilizationTrendLine'
import { MetricHint } from '@/features/analyze-visual/order-statistics/components/MetricHint'
import { RealtimeKpiCard } from '@/features/dashboard/components/RealtimeKpiCard'
import type { KpiViewModel } from '@/features/dashboard/kpiViewModel'
import { formatInteger, formatRatio } from '@/features/dashboard/kpiViewModel'
import { formatDurationMs } from '@/features/dashboard/realtime'
import {
  EFFECTIVE_WORK_STATES,
  computeWindowSeconds,
} from '@/features/analyze-visual/vehicle-status/statistics'
import {
  groupByVehicle,
  secondsOfStatesInGroup,
} from '@/features/analyze-visual/vehicle-status/selectors'
import styles from './TaskStatisticsReport.module.css'

/** 统计窗口默认跨度：近 7 个自然日（旧 TASK_STATISTICS_REPORT_DAYS 等价保留） */
const TASK_STATISTICS_REPORT_DAYS = 7

/** 秒级时间串格式（统计窗口统一，接口 date-time 墙钟约定） */
const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'

/** 明细表分页选项（旧 TABLE_PAGE_SIZE_OPTIONS 等价保留） */
const PAGE_SIZE_OPTIONS = [10, 20, 50]

/** 时长分布桶标签 key 顺序（与 DURATION_BUCKET_ORDER 一致，文案随语言） */
const DURATION_BUCKET_LABEL_KEYS = ['<1m', '1–2m', '2–3m', '3–5m', '5–10m', '>10m']

/** 生效查询条件（查询态）。与工具栏草稿态分离：点「查询」才整体应用 */
interface AppliedCondition {
  start: Dayjs
  end: Dayjs
  /** 车辆筛选仅任务统计链路消费（旧实现同口径）；空 = 全部车辆 */
  vehicleKeys: string[]
}

/** KPI 卡配置：图标 + 标签 key + 口径说明 key（文案走 report-task 命名空间） */
interface KpiCardConfig {
  key: 'totalCount' | 'completionRate' | 'failedCanceled' | 'averageDuration'
  icon: LucideIcon
  labelKey: string
  hintKey: string
}

/** 4 张 KPI 卡（旧 1×4 布局，响应式栅格自动换行）。
 * 口径说明 key 必须是完整简中文案（含 {{days}} 插值占位）——zh-CN key 即文案，
 * 短 key（如「总任务数·计算方式」）在默认语言下会原样显示 key 本体且插值无法
 * 应用（P33 实测沉淀的同款缺陷，浏览器渲染才能发现）。 */
const KPI_CARDS: KpiCardConfig[] = [
  {
    key: 'totalCount',
    icon: ListTodo,
    labelKey: '总任务数',
    hintKey:
      '总任务数 = 完成任务数 + 失败任务数 + 取消任务数（按最终状态统计，近 {{days}} 天各天之和）。',
  },
  {
    key: 'completionRate',
    icon: BarChart3,
    labelKey: '完成率',
    hintKey:
      '完成率 = 完成任务数 ÷ 总任务数 × 100%。\n\n完成任务数：近 {{days}} 天各天完成任务数之和（按最终状态统计）。\n总任务数 = 完成任务数 + 失败任务数 + 取消任务数。',
  },
  {
    key: 'failedCanceled',
    icon: CalendarRange,
    labelKey: '失败 / 取消',
    hintKey:
      '失败任务数：近 {{days}} 天各天失败任务数之和。\n取消任务数：近 {{days}} 天各天取消任务数之和。\n\n按最终状态统计。',
  },
  {
    key: 'averageDuration',
    icon: Timer,
    labelKey: '平均执行时长',
    hintKey:
      '平均耗时（毫秒）= 近 {{days}} 天创建且已完成的订单执行总时长（秒）÷ 同期创建且已完成的订单总数 × 1000。\n\n统计区间内创建并已完成的订单的平均执行时长。',
  },
]

/**
 * 初始统计窗口：部署时区 [今天-(N-1)天 00:00:00, 今天 23:59:59]
 * （旧 initialStatRange 同口径：end 收在当天最后一秒）。
 */
function initialStatRange(): { start: Dayjs; end: Dayjs } {
  const now = dayjs().tz(DEPLOY_TIMEZONE)
  return {
    start: now.subtract(TASK_STATISTICS_REPORT_DAYS - 1, 'day').startOf('day'),
    end: now.endOf('day'),
  }
}

/** 无环比 KPI 的展示模型（值不可计算：null/NaN → "--"，绝不补 0） */
function nullableKpi(value: number | null, format: (v: number) => string): KpiViewModel {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { display: '--', changeTone: 'neutral' }
  }
  return { display: format(value), changeTone: 'neutral' }
}

/** TanStack Updater 解析：回调可能收到值或函数（P12/P36/P37 同款工具） */
function resolveUpdater<T>(updater: T | ((old: T) => T), old: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(old) : updater
}

/**
 * 时间区间快捷预设：旧 TimeRangePicker 快捷下拉（今天/近3/7/15/30天）等价能力。
 * 口径与旧 lastNDays(n) 一致：[今天-(N-1)天 00:00:00, 今天 23:59:59]（部署时区）。
 */
function buildQuickPresets(t: (key: string) => string): { label: string; value: [Dayjs, Dayjs] }[] {
  const now = dayjs().tz(DEPLOY_TIMEZONE)
  const make = (days: number): [Dayjs, Dayjs] => [
    now.subtract(days - 1, 'day').startOf('day'),
    now.endOf('day'),
  ]
  return [
    { label: t('今天'), value: make(1) },
    { label: t('近3天'), value: make(3) },
    { label: t('近7天'), value: make(7) },
    { label: t('近15天'), value: make(15) },
    { label: t('近30天'), value: make(30) },
  ]
}

export default function TaskStatisticsReport() {
  const { t, i18n } = useTranslation('report-task')
  const locale = i18n.language
  const apexLocale = useApexLocale()

  /* ------------------------------ 查询条件（草稿态 + 查询态） ------------------------------ */

  // 工具栏草稿态：编辑不触发请求，点「查询」才应用为生效条件（旧实现同交互）
  const [rangeDraft, setRangeDraft] = useState<[Dayjs | null, Dayjs | null]>(() => {
    const { start, end } = initialStatRange()
    return [start, end]
  })
  // 车辆筛选草稿（vehicleKey 集合）；空数组 = 全部车辆
  const [vehicleDraft, setVehicleDraft] = useState<string[]>([])
  // 生效查询条件：初值即默认窗口，挂载时由 effect 自动查询一次
  const [applied, setApplied] = useState<AppliedCondition>(() => {
    const { start, end } = initialStatRange()
    return { start, end, vehicleKeys: [] }
  })

  // 任务车辆选项：T00 共享选项契约（fetchSimpleVehicles；失败仅影响该下拉，
  // 下拉内呈现状态文本不设重试按钮——按钮纪律）
  const vehicles = useStaticOptions<SimpleVehicleDto>((signal) => fetchSimpleVehicles({ signal }))
  const { t: tCommon } = useTranslation('common')

  /* ----------------------- 链路一：任务统计（KPI + 2 图 + 明细） ----------------------- */

  // 三条链路各自实例化同构查询 hook（防乱序/取消级联/失败清空+有限退避自动重查）
  const {
    data: statsData,
    loading: statsLoading,
    error: statsError,
    run: runStats,
  } = useTaskReportQuery<AppliedCondition, TaskStatisticsView>(
    useCallback(async (param: AppliedCondition, options?: { signal?: AbortSignal }) => {
      const vo = await taskStatistics(
        {
          startTime: param.start.format(DATE_TIME_FORMAT),
          endTime: param.end.format(DATE_TIME_FORMAT),
          // orderTypes 不传（后端默认「工作任务」）；空车辆集合由服务层归一化为不传
          vehicleKeys: param.vehicleKeys,
        },
        options,
      )
      return buildTaskStatistics(vo, param.start, param.end)
    }, []),
  )

  /* ----------------------- 链路二：车辆利用率排行（只跟随区间） ----------------------- */

  const {
    data: rankingData,
    loading: rankingLoading,
    error: rankingError,
    run: runRanking,
  } = useTaskReportQuery<{ start: Dayjs; end: Dayjs }, VehicleUtilizationItem[]>(
    useCallback(async (param: { start: Dayjs; end: Dayjs }, options?: { signal?: AbortSignal }) => {
      const vo = await agvExecutingTimeStatistics(
        {
          startTime: param.start.format(DATE_TIME_FORMAT),
          endTime: param.end.format(DATE_TIME_FORMAT),
          byHour: false,
          // 利用率两图只跟随统计区间、不消费车辆筛选（旧实现同口径：全部车辆）
          states: EFFECTIVE_WORK_STATES,
        },
        options,
      )
      // 区间完全在未来（终点截断后不晚于起点）时无有效统计窗口，直接返回空
      const windowSeconds = computeWindowSeconds(param.start, param.end, dayjs())
      if (windowSeconds <= 0) return []
      // 车辆聚合消费 P37 owner 模块（页面层组合，features 域不互相导入）；
      // 每车有效状态时长求和后交给 P35 纯函数换算利用率
      const items = groupByVehicle(vo.vehicleExecutingDurations ?? []).map((group) => ({
        vehicleKey: group.vehicleKey,
        vehicleName: group.vehicleName,
        activeSeconds: secondsOfStatesInGroup(group, EFFECTIVE_WORK_STATES),
      }))
      return buildVehicleUtilizationRanking(items, windowSeconds)
    }, []),
  )

  /* ----------------------- 链路三：利用率趋势（只跟随区间） ----------------------- */

  const {
    data: trendData,
    loading: trendLoading,
    error: trendError,
    run: runTrend,
  } = useTaskReportQuery<{ start: Dayjs; end: Dayjs }, UtilizationTrendPoint[]>(
    useCallback(async (param: { start: Dayjs; end: Dayjs }, options?: { signal?: AbortSignal }) => {
      const vo = await agvStateStatistics(
        {
          startTime: param.start.format(DATE_TIME_FORMAT),
          endTime: param.end.format(DATE_TIME_FORMAT),
          byHour: false,
          states: EFFECTIVE_WORK_STATES,
        },
        options,
      )
      // 分母口径（首末非整天、今天截断到当前时刻）在纯计算模块内统一处理
      return buildUtilizationTrend(vo.dailyStateDurations ?? [], param.start, param.end, dayjs())
    }, []),
  )

  // 挂载及生效条件变更（点「查询」）时按同一区间并行请求三条链路
  useEffect(() => {
    runStats(applied)
    runRanking(applied)
    runTrend(applied)
  }, [applied, runStats, runRanking, runTrend])

  // 点「查询」：草稿区间完整才应用（不完整时按钮已禁用，此处防御性判断）
  const handleQuery = useCallback(() => {
    const [start, end] = rangeDraft
    if (start && end) {
      setApplied({ start, end, vehicleKeys: [...vehicleDraft] })
    }
  }, [rangeDraft, vehicleDraft])
  const statDraftValid = !!(rangeDraft[0] && rangeDraft[1])
  // 查询按钮：任一链路进行中置 loading 防重复触发（旧 queryLoading 同口径）
  const queryLoading = statsLoading || rankingLoading || trendLoading

  /* --------------------------------- 明细表（Apex data 模式） --------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<DailyDetailRow>>(null)

  /* --------------------------------- 列偏好接线（P03/P36/P37 同款） --------------------------------- */

  const prefs = useColumnPreferences('report-task:daily')
  const [prefSlices, setPrefSlices] = useState<{
    columnOrder?: ColumnOrderState
    columnVisibility?: ColumnVisibilityState
    columnSizing?: ColumnSizingState
    columnPinning?: ColumnPinningState
  }>({})
  // 受控切片的同步镜像：连续多次 onChange 间保持最新合并值，避免闭包旧值
  const prefSlicesRef = useRef(prefSlices)

  /** 列钉住默认形态（本表无操作列，双侧为空；类型上要求 start/end 字段齐全） */
  const DEFAULT_PINNING: ColumnPinningState = { start: [], end: [] }

  useEffect(() => {
    if (!prefs || !tableInstanceRef.current) return
    try {
      const slices = prefs.load({
        columns: tableInstanceRef.current.getAllLeafColumns(),
        initialState: {},
      })
      const loaded = {
        columnOrder: slices.columnOrder,
        columnVisibility: slices.columnVisibility,
        columnSizing: slices.columnSizing,
        columnPinning: slices.columnPinning,
      }
      setPrefSlices(loaded)
      prefSlicesRef.current = loaded
    } catch {
      // 偏好读取失败不阻塞表格：以默认布局运行
    }
  }, [prefs])

  // 列偏好持久化：受控切片必须同步更新（否则下一帧回弹），save 传合并后的完整四切片
  const persistPrefs = useCallback(
    (patch: typeof prefSlices) => {
      const merged = { ...prefSlicesRef.current, ...patch }
      prefSlicesRef.current = merged
      setPrefSlices(merged)
      if (!prefs) return
      try {
        prefs.save(merged)
      } catch {
        // 保存失败静默：偏好是增强能力，不阻塞业务操作
      }
    },
    [prefs],
  )

  /* --------------------------------- 列定义（每日明细） --------------------------------- */

  const columns = useMemo<ApexColumnDef<DailyDetailRow>[]>(
    () => [
      {
        accessorKey: 'date',
        header: t('日期'),
        // 日期为行 ID 与窗口顺序基线，不开放排序（保持按天升序）
        enableSorting: false,
        size: 130,
        meta: { apex: { align: 'center' } },
        cell: (info) => info.getValue() ?? '',
      },
      {
        accessorKey: 'created',
        header: t('创建数'),
        enableSorting: true,
        size: 110,
        meta: { apex: { align: 'end' } },
        cell: (info) => formatInteger(info.getValue() as number, locale),
      },
      {
        accessorKey: 'completed',
        header: t('完成数'),
        enableSorting: true,
        size: 110,
        meta: { apex: { align: 'end' } },
        cell: (info) => formatInteger(info.getValue() as number, locale),
      },
      {
        accessorKey: 'failed',
        header: t('失败数'),
        enableSorting: true,
        size: 110,
        meta: { apex: { align: 'end' } },
        cell: (info) => formatInteger(info.getValue() as number, locale),
      },
      {
        accessorKey: 'canceled',
        header: t('取消数'),
        enableSorting: true,
        size: 110,
        meta: { apex: { align: 'end' } },
        cell: (info) => formatInteger(info.getValue() as number, locale),
      },
      {
        accessorKey: 'averageDurationMs',
        header: t('平均执行时长'),
        enableSorting: true,
        size: 150,
        meta: { apex: { align: 'end' } },
        // 创建且已完成口径；分母 0 不可计算 → 留白（不补 0，DoD 14）
        cell: (info) => {
          const value = info.getValue()
          return typeof value === 'number' ? formatDurationMs(value) : ''
        },
      },
    ],
    [t, locale],
  )

  /* --------------------------------- KPI / 图表展示模型 --------------------------------- */

  // 首次加载中（无历史数据时才进入 loading，避免查询刷新时闪烁——P36/P37 同口径）
  const statsFirstLoad = statsLoading && !statsData && !statsError
  const rankingFirstLoad = rankingLoading && !rankingData && !rankingError
  const trendFirstLoad = trendLoading && !trendData && !trendError

  const kpiViews = useMemo<Record<KpiCardConfig['key'], KpiViewModel> | null>(() => {
    if (!statsData) return null
    const kpis = statsData.kpis
    return {
      totalCount: nullableKpi(kpis.totalCount, (v) => formatInteger(v, locale)),
      // 完成率 0–1 → 百分比；总数 0 → "--"
      completionRate: nullableKpi(kpis.completionRate, (v) => formatRatio(v, locale)),
      // 失败 / 取消：「X / Y」组合展示（各自千分位）
      failedCanceled: {
        display: `${formatInteger(kpis.failedCount, locale)} / ${formatInteger(kpis.canceledCount, locale)}`,
        changeTone: 'neutral',
      },
      // 平均执行时长毫秒 → 展示时长；分母 0 → "--"
      averageDuration: nullableKpi(kpis.averageCompletedDurationMs, formatDurationMs),
    }
  }, [statsData, locale])

  /** KPI 强调边框：失败 > 0 黄色（旧 accent:'warn' 等价保留） */
  const kpiAccent = (key: KpiCardConfig['key']): 'warn' | undefined => {
    if (key === 'failedCanceled' && statsData && statsData.kpis.failedCount > 0) return 'warn'
    return undefined
  }

  // 时长分布是否为空：以分布桶计数总和为准（接口无原始耗时样本，分桶计数是唯一数据来源）
  const hasDurationData = !!statsData?.durationDistribution.some((bucket) => bucket.count > 0)

  // 悬浮/数值格式化：页面层绑定 locale 后注入图表（features 域隔离）
  const formatIntegerForChart = useCallback((value: number) => formatInteger(value, locale), [locale])
  const formatRatioForChart = useCallback(
    (ratio: number | null) => formatRatio(ratio, locale),
    [locale],
  )

  // KPI / 图表 hint 中展示的统计窗口天数：由生效查询条件的区间计算
  //（与当前展示数据口径一致，草稿编辑不影响 hint）
  const queryDays = applied.end.diff(applied.start, 'day') + 1

  // 快捷预设随语言重建（label 为翻译文案）
  const quickPresets = useMemo(() => buildQuickPresets(t), [t])

  /* --------------------------------- 渲染 --------------------------------- */

  const renderKpiAndTaskCharts = () => {
    // 任务统计链路失败：KPI + 任务图表整区显示真实错误态（恢复依赖自动重查与「查询」）
    if (statsError && !statsData) {
      return (
        <div className={styles.aggregateError}>
          <StateBlock variant="offline" minHeight={320} />
        </div>
      )
    }
    if (statsFirstLoad) {
      return (
        <div className={styles.aggregateError}>
          <Skeleton active title={false} paragraph={{ rows: 8 }} />
        </div>
      )
    }
    if (!statsData) return null
    return (
      <>
        <div className={styles.kpiRow}>
          {KPI_CARDS.map((card) => (
            <RealtimeKpiCard
              key={card.key}
              icon={card.icon}
              label={t(card.labelKey)}
              hint={t(card.hintKey, { days: queryDays })}
              hintLabel={t('查看统计口径')}
              value={kpiViews?.[card.key] ?? { display: '--', changeTone: 'neutral' }}
              accent={kpiAccent(card.key)}
            />
          ))}
        </div>
        <div className={styles.taskChartRow}>
          <section className={styles.chartCard}>
            <h3 className={styles.cardTitle}>
              {t('任务量趋势')}
              <MetricHint
                label={t('查看统计口径')}
                content={t(
                  '近 {{days}} 天按天堆叠柱图，分完成 / 失败 / 取消三类（终态口径）。\n\n缺失天按 0 补齐。',
                  { days: queryDays },
                )}
              />
            </h3>
            <div className={styles.chartBody}>
              {statsData.volumeTrend.length > 0 ? (
                <TaskVolumeStackedBar
                  data={statsData.volumeTrend}
                  ariaDescription={t('任务量趋势堆叠柱图')}
                  completedName={t('完成')}
                  failedName={t('失败')}
                  canceledName={t('取消')}
                  valueAxisName={t('任务数量（个）')}
                  formatValue={formatIntegerForChart}
                />
              ) : (
                <Empty description={t('暂无数据')} />
              )}
            </div>
          </section>
          <section className={styles.chartCard}>
            <h3 className={styles.cardTitle}>
              {t('任务执行时长分布')}
              <MetricHint
                label={t('查看统计口径')}
                content={t(
                  '按固定时长分桶统计订单数：小于 1 分钟 / 1-2 分钟 / 2-3 分钟 / 3-5 分钟 / 5-10 分钟 / 大于 10 分钟。\n\n接口仅有分桶计数，无原始耗时样本，第 50 百分位耗时（中位数）和第 90 百分位耗时不可计算。',
                )}
              />
            </h3>
            <div className={styles.chartBody}>
              {hasDurationData ? (
                <DurationDistributionBar
                  data={statsData.durationDistribution}
                  bucketLabels={DURATION_BUCKET_LABEL_KEYS.map((key) => t(key))}
                  seriesName={t('任务数量（个）')}
                  valueAxisName={t('任务数量（个）')}
                  ariaDescription={t('任务执行时长分布柱图')}
                />
              ) : (
                // 真实空结果（窗口内无任何已完成订单）：明确空态，区别于查询失败
                <Empty description={t('暂无数据')} />
              )}
            </div>
          </section>
        </div>
      </>
    )
  }

  return (
    <div className={styles.page}>
      {/* 统计工具栏：车辆筛选（仅任务统计链路消费）+ 时间区间驱动全部三条链路
          （草稿态编辑，点「查询」才请求；利用率两图只跟随区间，旧实现同口径） */}
      <div className={styles.toolbar}>
        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('全部车辆')}
          value={vehicleDraft}
          onChange={setVehicleDraft}
          loading={vehicles.loading}
          fieldNames={{ label: 'name', value: 'key' }}
          options={vehicles.options ?? []}
          popupMatchSelectWidth={350}
          maxTagCount="responsive"
          style={{ minWidth: 280 }}
          notFoundContent={
            // 选项失败只呈现状态文本（不设重试按钮）；真实空集合显示默认无数据
            vehicles.error ? tCommon('加载失败') : undefined
          }
        />
        <DatePicker.RangePicker
          showTime
          format={DATE_TIME_FORMAT}
          value={rangeDraft}
          onChange={(value) => setRangeDraft(value ?? [null, null])}
          placeholder={[t('开始时间'), t('结束时间')]}
          presets={quickPresets}
        />
        <Button type="primary" loading={queryLoading} disabled={!statDraftValid} onClick={handleQuery}>
          {t('查询')}
        </Button>
      </div>

      {/* 任务统计链路：KPI 行 + 任务量趋势 / 时长分布（同源一次请求） */}
      {renderKpiAndTaskCharts()}

      {/* 利用率链路（各自独立失败态，互不影响任务统计区域） */}
      <div className={styles.utilizationRow}>
        <section className={styles.chartCard}>
          <h3 className={styles.cardTitle}>
            {t('AGV 利用率排行')}
            <MetricHint
              label={t('查看统计口径')}
              content={t(
                '利用率为近 {{days}} 天各车辆有效状态时长之和 ÷ 区间总秒数。\n\n区间终点超过当前时刻时，分母只算到当前时刻（不计入未来时间）。\n\n有效状态 = 执行作业 + 执行充电 + 执行停靠。',
                { days: queryDays },
              )}
            />
          </h3>
          <div className={styles.chartBody}>
            {rankingError && !rankingData ? (
              <StateBlock variant="offline" minHeight={280} />
            ) : rankingFirstLoad ? (
              <Skeleton active title={false} paragraph={{ rows: 6 }} />
            ) : rankingData && rankingData.length > 0 ? (
              <VehicleUtilizationBar
                data={rankingData}
                ariaDescription={t('AGV 利用率排行横向柱图')}
                utilizationLabel={t('利用率')}
                formatRatio={formatRatioForChart}
              />
            ) : (
              // 真实空结果（窗口内无车辆状态记录）：明确空态，区别于查询失败
              <Empty description={t('暂无数据')} />
            )}
          </div>
        </section>
        <section className={styles.chartCard}>
          <h3 className={styles.cardTitle}>
            {t('利用率趋势')}
            <MetricHint
              label={t('查看统计口径')}
              content={t(
                '每天利用率 = 当天有效状态总时长 /（当天计入统计的秒数 × 当天车辆数）。\n\n整天在区间内按 86400 秒计；首末非整天只算区间覆盖部分；今天只算到当前时刻（不计入未来时间）。\n\n有效状态同利用率排行，车辆数取当天参与统计的车辆数量。缺失天按 0 补齐；已有记录但车辆数为零、缺失或无效时不显示利用率。\n\n统计窗口为近 {{days}} 天（由上方时间选择器控制）。',
                { days: queryDays },
              )}
            />
          </h3>
          <div className={styles.chartBody}>
            {trendError && !trendData ? (
              <StateBlock variant="offline" minHeight={280} />
            ) : trendFirstLoad ? (
              <Skeleton active title={false} paragraph={{ rows: 6 }} />
            ) : trendData && trendData.length > 0 ? (
              <UtilizationTrendLine
                data={trendData}
                ariaDescription={t('利用率趋势折线图')}
                seriesName={t('利用率（%）')}
                formatRatio={formatRatioForChart}
              />
            ) : (
              <Empty description={t('暂无数据')} />
            )}
          </div>
        </section>
      </div>

      {/* 每日明细卡：与任务量趋势同源同序（图表与 Apex 明细一致，A19）；
          失败时表格呈现内建错误态——重试按钮仅表格内部，符合按钮纪律 */}
      <section className={styles.detailCard}>
        <h3 className={styles.cardTitle}>
          {t('每日明细')}
          <MetricHint
            label={t('查看统计口径')}
            content={t(
              '统计窗口内每个自然日一行，与任务量趋势同源；缺失记录的天按 0 补齐。平均执行时长为当天创建且已完成的订单口径，分母为 0 时留白（不可计算）。',
            )}
          />
        </h3>
        <div className={styles.tableWrap}>
          <ApexTableReact
            ref={tableApiRef}
            tableRef={tableInstanceRef}
            columns={columns}
            data={statsData?.dailyRows ?? []}
            getRowId={(row) => row.date}
            loading={statsLoading}
            error={statsError ? new Error('taskStatistics failed') : undefined}
            onRetry={() => runStats(applied)}
            locale={apexLocale}
            pagination={{ pageSizeOptions: PAGE_SIZE_OPTIONS }}
            // 表格级排序开关（Apex 要求表格级开启后列级 enableSorting 才生效）：
            // 数值列开放本地排序；日期列为窗口基线不开放（P37 先例同款）
            enableSorting
            columnSettingsEnabled
            height="100%"
            state={{
              columnOrder: prefSlices.columnOrder,
              columnVisibility: prefSlices.columnVisibility,
              columnSizing: prefSlices.columnSizing,
              columnPinning: prefSlices.columnPinning,
            }}
            onColumnOrderChange={(updater) =>
              persistPrefs({ columnOrder: resolveUpdater(updater, prefSlices.columnOrder ?? []) })
            }
            onColumnVisibilityChange={(updater) =>
              persistPrefs({
                columnVisibility: resolveUpdater(updater, prefSlices.columnVisibility ?? {}),
              })
            }
            onColumnSizingChange={(updater) =>
              persistPrefs({ columnSizing: resolveUpdater(updater, prefSlices.columnSizing ?? {}) })
            }
            onColumnPinningChange={(updater) =>
              persistPrefs({
                columnPinning: resolveUpdater(updater, prefSlices.columnPinning ?? DEFAULT_PINNING),
              })
            }
          />
        </div>
      </section>
    </div>
  )
}
