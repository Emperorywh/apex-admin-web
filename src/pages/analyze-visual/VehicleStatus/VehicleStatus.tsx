/**
 * 车辆状态统计页（P37 整页交付；旧 AnalyzeVisual/VehicleStatus 等价迁移）。
 *
 * 业务结构（旧页逐面板核对；旧 charts 目录中 StateSharePie/StateDurationRankBar/
 * VehicleTotalRankBar 三个组件仅被 import 未在 JSX 接线，属旧代码死代码，
 * 旧页实际渲染只有堆叠柱一张图——以可达实现为准，不迁移死代码）：
 * - 查询工具栏：时间区间（RangePicker，默认近 7 个自然日）+ 状态多选 + 按小时
 *   维度开关（接口限制跨度 ≤24h，点查询时前端校验）+ 查询/重置 + 已加载计数；
 *   草稿态编辑条件，点「查询」才整体应用并触发请求（旧实现同交互）；
 * - KPI 4 卡：任务执行利用率（分母=窗口秒数，不乘车辆数，终点截断到当前时刻）、
 *   平均交管时长 / 平均执行时长 / 平均故障时长（分母=车辆数，未出现该状态的
 *   车按 0 参与平均）；分母为 0 不可计算显示 "--"（绝不补 0，规格 11.2），
 *   平均故障 > 0 红色强调边框（旧实现等价）；
 * - 图表 1 张：车辆 × 状态 时长堆叠柱（全宽 460px，dataZoom 缩放/平移，
 *   仅出现过的状态建系列，固定语义色）；
 * - 明细表：每车×每状态一行（时长 + 占该车总时长比例），Apex data 模式
 *   （聚合接口一次性返回全量记录，DoD 5「真实完整小集合」形态），
 *   车辆/状态本地筛选仅过滤表格不触发请求（旧实现同交互），
 *   时长/占比列开放客户端排序（旧实现前端排序等价）。
 *
 * 行为契约：
 * - KPI/图表/明细共用一次 agvExecutingTimeStatistics 查询（useVehicleStateQuery）：
 *   失败立即清空数据，KPI+图表区显示 StateBlock，明细表显示 Apex 内建错误态
 *   （重试按钮仅表格内部，按钮纪律）；旧实现「失败保留上次数据降级展示」与现行
 *   DoD 6（禁止旧数据冒充成功）冲突，不迁移——差异登记 tasks/P37.md；
 * - 本页为报表页，不默认轮询（规格 8.2）；失败由可见有限退避自动重查与
 *   「查询」按钮恢复；
 * - 空值纪律：单元格缺失留白；KPI 不可计算显示 "--"；未知状态显示协议原值。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Checkbox, DatePicker, Empty, Select, Skeleton, Tag, Typography } from 'antd'
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
import { Gauge, Hourglass, Siren, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { StateBlock } from '@/components/StateBlock/StateBlock'
import { DEPLOY_TIMEZONE } from '@/constants/datetime'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { formatDurationMs } from '@/features/dashboard/realtime'
import { formatRatio } from '@/features/dashboard/kpiViewModel'
import type { KpiViewModel } from '@/features/dashboard/kpiViewModel'
import { MetricHint } from '@/features/analyze-visual/order-statistics/components/MetricHint'
import { RealtimeKpiCard } from '@/features/dashboard/components/RealtimeKpiCard'
import { agvExecutingTimeStatistics } from '@/services/report-vehicle-state/report-vehicle-state.service'
import type {
  VehicleExecutingDurationDto,
  VehicleStatisticState,
} from '@/services/report-vehicle-state/report-vehicle-state.service.types'
import {
  stateColor,
  stateLabelKey,
  VEHICLE_STATISTIC_STATE_ORDER,
} from '@/features/analyze-visual/vehicle-status/states'
import { groupByVehicle, type VehicleDurationGroup } from '@/features/analyze-visual/vehicle-status/selectors'
import { buildVehicleStatusKpis, computeWindowSeconds } from '@/features/analyze-visual/vehicle-status/statistics'
import { formatDecimalHours } from '@/features/analyze-visual/vehicle-status/formatters'
import { useVehicleStateQuery } from '@/features/analyze-visual/vehicle-status/hooks/useVehicleStateQuery'
import { VehicleStateStackedBar } from '@/features/analyze-visual/vehicle-status/components/VehicleStateStackedBar'
import styles from './VehicleStatus.module.css'

/** 接口约定的时间格式（date-time 墙钟字符串，与后端联调口径一致） */
const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'

/** 按小时维度统计时接口允许的最大时间跨度（24 小时，后端限制前端先校验） */
const BY_HOUR_MAX_RANGE_HOURS = 24

/** 明细表分页选项（旧 TABLE_PAGE_SIZE_OPTIONS 等价保留） */
const PAGE_SIZE_OPTIONS = [10, 20, 50]

/** KPI 卡配置：图标 + 标签 key + 口径说明 key（文案走 report-vehicle-state 命名空间） */
interface KpiCardConfig {
  key: 'utilization' | 'avgTraffic' | 'avgWork' | 'avgError'
  icon: LucideIcon
  labelKey: string
  hintKey: string
}

/** 4 张 KPI 卡（旧 1×4 布局，响应式栅格自动换行） */
const KPI_CARDS: KpiCardConfig[] = [
  { key: 'utilization', icon: Gauge, labelKey: '任务执行利用率', hintKey: '任务执行利用率·计算方式' },
  { key: 'avgTraffic', icon: Hourglass, labelKey: '平均交管时长', hintKey: '平均交管时长·计算方式' },
  { key: 'avgWork', icon: Timer, labelKey: '平均执行时长', hintKey: '平均执行时长（车辆状态）·计算方式' },
  { key: 'avgError', icon: Siren, labelKey: '平均故障时长', hintKey: '平均故障时长·计算方式' },
]

/** 已应用的查询条件（查询态）。与工具栏草稿态分离：点「查询」才整体应用 */
interface AppliedCondition {
  start: Dayjs
  end: Dayjs
  byHour: boolean
  states: VehicleStatisticState[]
}

/** 明细表行：每车每状态一条（旧 DetailRow 等价） */
interface DetailRow {
  /** 稳定行 ID：vehicleKey|state 组合（旧实现同口径） */
  key: string
  vehicleKey: string
  /** 展示名（selectors.groupByVehicle 已做空值回退 vehicleKey） */
  vehicleName: string
  state: VehicleStatisticState
  /** 该状态总时长（秒） */
  seconds: number
  /** 占该车总时长比例（0–1 小数） */
  share: number
}

/**
 * 默认时间区间：近 7 个自然日（旧 defaultRange 同口径；部署时区墙钟，
 * start 收在 6 天前零点、end 收在当天最后一秒）。
 */
function defaultRange(): { start: Dayjs; end: Dayjs } {
  const now = dayjs().tz(DEPLOY_TIMEZONE)
  return { start: now.subtract(6, 'day').startOf('day'), end: now.endOf('day') }
}

/** 默认查询条件（初值与「重置」共用；总是新对象，同值点击也会主动刷新） */
function defaultCondition(): AppliedCondition {
  const { start, end } = defaultRange()
  return { start, end, byHour: false, states: [] }
}

/** 无环比 KPI 的展示模型（值不可计算：null/NaN → "--"，绝不补 0） */
function nullableKpi(value: number | null, format: (v: number) => string): KpiViewModel {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { display: '--', changeTone: 'neutral' }
  }
  return { display: format(value), changeTone: 'neutral' }
}

/** TanStack Updater 解析：回调可能收到值或函数（P12/P36 同款工具） */
function resolveUpdater<T>(updater: T | ((old: T) => T), old: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(old) : updater
}

export default function VehicleStatus() {
  const { t, i18n } = useTranslation('report-vehicle-state')
  const locale = i18n.language
  const apexLocale = useApexLocale()
  const { message } = App.useApp()

  /* ------------------------------ 查询条件（草稿态 + 查询态） ------------------------------ */

  // 工具栏草稿态：编辑不触发请求，点「查询」才应用为生效条件（旧实现同交互）
  const [rangeDraft, setRangeDraft] = useState<[Dayjs | null, Dayjs | null]>(() => {
    const { start, end } = defaultRange()
    return [start, end]
  })
  const [byHourDraft, setByHourDraft] = useState(false)
  const [statesDraft, setStatesDraft] = useState<VehicleStatisticState[]>([])
  // 生效查询条件：初值即默认窗口，挂载时由 effect 自动查询一次
  const [applied, setApplied] = useState<AppliedCondition>(defaultCondition)

  // 聚合查询（防乱序/取消级联/失败清空+有限退避自动重查，契约见 hook 注释）
  const { data, loading, error, run } = useVehicleStateQuery<AppliedCondition, VehicleExecutingDurationDto[]>(
    useCallback(async (param: AppliedCondition, options?: { signal?: AbortSignal }) => {
      const vo = await agvExecutingTimeStatistics(
        {
          startTime: param.start.format(DATE_TIME_FORMAT),
          endTime: param.end.format(DATE_TIME_FORMAT),
          byHour: param.byHour,
          // 空数组由服务层归一化为不传参（协议「为空时统计所有状态」）
          states: param.states,
        },
        options,
      )
      return vo.vehicleExecutingDurations ?? []
    }, []),
  )

  // 挂载及生效查询条件变更（点「查询」/「重置」）时请求
  useEffect(() => {
    run(applied)
  }, [applied, run])

  // 点「查询」：草稿区间完整才应用；按小时维度时先校验 24 小时上限（旧实现同交互）
  const handleQuery = useCallback(() => {
    const [start, end] = rangeDraft
    if (!start || !end) {
      message.warning(t('请选择完整的时间范围'))
      return
    }
    if (byHourDraft && end.diff(start, 'hour', true) > BY_HOUR_MAX_RANGE_HOURS) {
      message.warning(t('按小时维度统计时，时间范围不能超过 24 小时'))
      return
    }
    setApplied({ start, end, byHour: byHourDraft, states: [...statesDraft] })
  }, [rangeDraft, byHourDraft, statesDraft, message, t])

  // 重置：草稿与查询态同步回到默认（总是新对象，同值点击也主动刷新——旧实现同口径）
  const handleReset = useCallback(() => {
    const next = defaultCondition()
    setRangeDraft([next.start, next.end])
    setByHourDraft(false)
    setStatesDraft([])
    setApplied(next)
  }, [])

  /* --------------------------------- 聚合视图（KPI / 图表 / 明细共用） --------------------------------- */

  // 数据引用稳定化：失败/未加载时统一为空数组语义（memo 避免每次渲染产生新引用）
  const rows = useMemo(() => data ?? [], [data])
  const vehicleGroups = useMemo(() => groupByVehicle(rows), [rows])

  // 利用率分母：窗口秒数（终点超过当前时刻截断；仅 applied 变化时重算）
  const windowSeconds = useMemo(
    () => computeWindowSeconds(applied.start, applied.end, dayjs()),
    [applied],
  )
  const kpis = useMemo(() => buildVehicleStatusKpis(rows, windowSeconds), [rows, windowSeconds])

  // 最近一次成功加载时间（工具栏展示，便于识别陈旧数据；旧实现 onSuccess 同口径）
  const [loadedAt, setLoadedAt] = useState<Dayjs | null>(null)
  useEffect(() => {
    if (data) setLoadedAt(dayjs())
  }, [data])

  /* --------------------------------- 明细表本地筛选（纯前端，不触发请求） --------------------------------- */

  const [filterVehicleKeys, setFilterVehicleKeys] = useState<string[]>([])
  const [filterStates, setFilterStates] = useState<VehicleStatisticState[]>([])

  // 车辆筛选选项：当前数据中出现过的车辆（保持接口返回顺序）
  const filterVehicleOptions = useMemo(
    () => vehicleGroups.map((group) => ({ value: group.vehicleKey, label: group.vehicleName })),
    [vehicleGroups],
  )
  // 状态筛选选项：当前数据中出现过的状态（保持枚举语义顺序），避免无数据选项
  const filterStateOptions = useMemo(
    () =>
      VEHICLE_STATISTIC_STATE_ORDER.filter((state) =>
        vehicleGroups.some((group) => group.stateSeconds[state] !== undefined),
      ),
    [vehicleGroups],
  )

  /* --------------------------------- 明细行构造与过滤 --------------------------------- */

  const detailRows = useMemo<DetailRow[]>(
    () =>
      vehicleGroups.flatMap((group: VehicleDurationGroup) =>
        (Object.entries(group.stateSeconds) as [VehicleStatisticState, number][]).map(([state, seconds]) => ({
          key: `${group.vehicleKey}|${state}`,
          vehicleKey: group.vehicleKey,
          vehicleName: group.vehicleName,
          state,
          seconds,
          share: group.totalSeconds > 0 ? seconds / group.totalSeconds : 0,
        })),
      ),
    [vehicleGroups],
  )

  // 应用本地筛选后的明细行；空集合 = 不筛该维度（与「全部」口径一致）
  const filteredDetailRows = useMemo(() => {
    const vehicleSet = filterVehicleKeys.length ? new Set(filterVehicleKeys) : null
    const stateSet = filterStates.length ? new Set(filterStates) : null
    return detailRows.filter(
      (row) =>
        (!vehicleSet || vehicleSet.has(row.vehicleKey)) && (!stateSet || stateSet.has(row.state)),
    )
  }, [detailRows, filterVehicleKeys, filterStates])

  /* --------------------------------- 列偏好接线（P03/P36 同款） --------------------------------- */

  const prefs = useColumnPreferences('report-vehicle-state:detail')
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

  /* --------------------------------- 明细表 API 引用 --------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<DetailRow>>(null)

  /* --------------------------------- 列定义（逐列核对旧版） --------------------------------- */

  const columns = useMemo<ApexColumnDef<DetailRow>[]>(
    () => [
      {
        accessorKey: 'vehicleName',
        header: t('车辆名称'),
        enableSorting: false,
        size: 200,
        meta: { apex: { align: 'start' } },
        // 展示名（空时回退 vehicleKey，已在 groupByVehicle 归一）；缺失留白
        cell: (info) => info.getValue() ?? '',
      },
      {
        accessorKey: 'state',
        header: t('状态'),
        enableSorting: false,
        size: 120,
        meta: { apex: { align: 'center' } },
        cell: (info) => {
          const state = info.getValue() as string
          // 状态色与图表一致（固定语义色）；未知枚举显示协议原值（不臆造映射）
          if (VEHICLE_STATISTIC_STATE_ORDER.includes(state as VehicleStatisticState)) {
            return <Tag color={stateColor(state)}>{t(stateLabelKey(state))}</Tag>
          }
          return state ? <Tag>{state}</Tag> : null
        },
      },
      {
        accessorKey: 'seconds',
        header: t('时长'),
        enableSorting: true,
        size: 140,
        meta: { apex: { align: 'end' } },
        // 秒 → 人性化时长（旧 formatDuration 等价换算：秒 ×1000 进毫秒入口）
        cell: (info) => formatDurationMs((info.getValue() as number) * 1000),
      },
      {
        id: 'hours',
        accessorFn: (row) => row.seconds,
        header: t('时长（小时）'),
        enableSorting: false,
        size: 140,
        meta: { apex: { align: 'end' } },
        // 数值精确口径（小时），与时长列同值不同格式，不提供重复排序入口（旧实现同口径）
        cell: (info) => `${formatDecimalHours(info.row.original.seconds, locale)} h`,
      },
      {
        accessorKey: 'share',
        header: t('占该车总时长'),
        enableSorting: true,
        size: 140,
        meta: { apex: { align: 'end' } },
        // 0–1 小数 → 百分比（1 位小数，Intl；车总时长为 0 时 share 恒 0）
        cell: (info) => formatRatio(info.getValue() as number, locale),
      },
    ],
    [t, locale],
  )

  /* --------------------------------- KPI 展示模型 --------------------------------- */

  // 首次加载中（无历史数据时才让 KPI/图表进入 loading，避免查询刷新时闪烁——旧实现同口径）
  const firstLoad = loading && !data && !error

  const kpiValues = useMemo<Record<KpiCardConfig['key'], KpiViewModel> | null>(() => {
    if (!data) return null
    return {
      // 利用率 0–1 → 百分比；窗口秒数为 0 → "--"；副文案 = 覆盖车辆数 + 执行作业总时长
      utilization: {
        ...nullableKpi(kpis.utilization, (v) => formatRatio(v, locale)),
        changeText: t('覆盖 {{vehicles}} 辆车 · 执行作业 {{duration}}', {
          vehicles: formatIntegerSafe(kpis.vehicleCount, locale),
          duration: formatDurationMs(kpis.workSeconds * 1000),
        }),
      },
      avgTraffic: {
        ...nullableKpi(kpis.avgTrafficMs, (v) => formatDurationMs(v)),
        changeText: t('覆盖 {{vehicles}} 辆车', { vehicles: formatIntegerSafe(kpis.vehicleCount, locale) }),
      },
      avgWork: {
        ...nullableKpi(kpis.avgWorkMs, (v) => formatDurationMs(v)),
        changeText: t('覆盖 {{vehicles}} 辆车', { vehicles: formatIntegerSafe(kpis.vehicleCount, locale) }),
      },
      avgError: nullableKpi(kpis.avgErrorMs, (v) => formatDurationMs(v)),
    }
  }, [data, kpis, locale, t])

  /** KPI 强调边框：平均故障 > 0 红（旧实现 avgErrorMs > 0 等价） */
  const kpiAccent = (key: KpiCardConfig['key']): 'danger' | undefined => {
    if (key === 'avgError' && kpis.avgErrorMs !== null && kpis.avgErrorMs > 0) return 'danger'
    return undefined
  }

  /* --------------------------------- 渲染 --------------------------------- */

  return (
    <div className={styles.page}>
      {/* 查询工具栏：草稿态编辑，点「查询」整体应用（旧实现同交互） */}
      <div className={styles.toolbar}>
        <DatePicker.RangePicker
          showTime
          format={DATE_TIME_FORMAT}
          value={rangeDraft}
          onChange={(value) => setRangeDraft(value ?? [null, null])}
          placeholder={[t('开始时间'), t('结束时间')]}
        />
        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('全部状态')}
          value={statesDraft}
          onChange={(value) => setStatesDraft(value)}
          options={VEHICLE_STATISTIC_STATE_ORDER.map((state) => ({
            value: state,
            label: t(stateLabelKey(state)),
          }))}
          maxTagCount={3}
          style={{ minWidth: 220 }}
        />
        <Checkbox checked={byHourDraft} onChange={(e) => setByHourDraft(e.target.checked)}>
          {t('按小时维度')}
        </Checkbox>
        {/* 24 小时上限口径提示（旧 InfoHint 等价：图标 + Tooltip，键盘可达） */}
        <MetricHint label={t('查看统计口径')} content={t('按小时维度统计时，时间范围不能超过 24 小时')} />
        <Button type="primary" loading={loading} onClick={handleQuery}>
          {t('查询')}
        </Button>
        <Button onClick={handleReset}>{t('重置')}</Button>
        {loadedAt && data && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('已加载 {{count}} 条记录', { count: data.length })} · {loadedAt.format('HH:mm:ss')}
          </Typography.Text>
        )}
      </div>

      {/* KPI 行：失败清空不冒充成功（StateBlock，恢复依赖自动重查与「查询」按钮） */}
      {error ? (
        <div className={styles.aggregateCard}>
          <StateBlock variant="offline" minHeight={320} />
        </div>
      ) : firstLoad ? (
        <div className={styles.aggregateCard}>
          <Skeleton active title={false} paragraph={{ rows: 8 }} />
        </div>
      ) : (
        data && (
          <>
            <div className={styles.kpiRow}>
              {KPI_CARDS.map((card) => (
                <RealtimeKpiCard
                  key={card.key}
                  icon={card.icon}
                  label={t(card.labelKey)}
                  hint={t(card.hintKey)}
                  hintLabel={t('查看统计口径')}
                  value={kpiValues?.[card.key] ?? { display: '--', changeTone: 'neutral' }}
                  accent={kpiAccent(card.key)}
                />
              ))}
            </div>

            {/* 车辆 × 状态 时长堆叠：独占一行，默认全部车辆 + dataZoom 缩放（旧实现同布局） */}
            <section className={styles.chartCard}>
              <h3 className={styles.cardTitle}>
                {t('车辆 × 状态 时长堆叠')}
                <MetricHint label={t('查看统计口径')} content={t('车辆 × 状态 时长堆叠·计算方式')} />
              </h3>
              <div className={styles.chartBody}>
                {vehicleGroups.length > 0 ? (
                  <VehicleStateStackedBar
                    data={vehicleGroups}
                    ariaDescription={t('车辆状态时长堆叠柱图')}
                    // 时长格式化由页面层注入（协议秒 → 人性化文案；features 域隔离）
                    formatDuration={(seconds) => formatDurationMs(seconds * 1000)}
                  />
                ) : (
                  // 真实空结果（窗口内无任何状态记录）：明确空态，区别于查询失败
                  <Empty description={t('暂无数据')} />
                )}
              </div>
            </section>
          </>
        )
      )}

      {/* 明细卡：本地筛选 + Apex data 模式明细表（与聚合区共用一次请求；
          失败时表格呈现内建错误态——重试按钮仅表格内部，符合按钮纪律） */}
      <section className={styles.detailCard}>
        <h3 className={styles.cardTitle}>{t('状态时长明细')}</h3>
        <div className={styles.detailFilter}>
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('全部车辆')}
            value={filterVehicleKeys}
            onChange={(value) => setFilterVehicleKeys(value)}
            options={filterVehicleOptions}
            maxTagCount={3}
            style={{ minWidth: 200 }}
          />
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('全部状态')}
            value={filterStates}
            onChange={(value) => setFilterStates(value)}
            options={filterStateOptions.map((state) => ({
              value: state,
              label: t(stateLabelKey(state)),
            }))}
            maxTagCount={3}
            style={{ minWidth: 200 }}
          />
        </div>
        <div className={styles.tableWrap}>
          <ApexTableReact
            ref={tableApiRef}
            tableRef={tableInstanceRef}
            columns={columns}
            data={filteredDetailRows}
            getRowId={(row) => row.key}
            loading={loading}
            error={error ? new Error('agvExecutingTimeStatistics failed') : undefined}
            onRetry={() => run(applied)}
            locale={apexLocale}
            pagination={{ pageSizeOptions: PAGE_SIZE_OPTIONS }}
            // 表格级排序开关（Apex 要求表格级开启后列级 enableSorting 才生效）：
            // 仅「时长」「占该车总时长」两列开放本地排序（旧实现 sorter 等价）
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

/** 覆盖车辆数千分位（Intl；KPI 副文案用，明细格式化无此需求） */
function formatIntegerSafe(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}
