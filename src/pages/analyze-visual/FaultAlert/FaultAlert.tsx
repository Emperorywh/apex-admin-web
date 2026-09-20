/**
 * 故障告警页（P36 整页交付；旧 AnalyzeVisual/FaultAlert 等价迁移）。
 *
 * 业务结构（旧页逐面板核对）：
 * - 统计工具栏：生效统计窗口（默认近 14 个自然日，部署时区墙钟）草稿态编辑，
 *   点「查询」才应用并发起聚合请求；聚合为查询性质 POST，可安全重查；
 * - KPI 4 卡：故障次数 / 未关闭告警数 / 告警关闭率 / 平均告警时长。
 *   关闭率与平均时长为窗口级派生指标（分子分母同口径），窗口内无告警时
 *   分母为 0 → 不可计算显示 "--"（绝不补 0，规格 11.2，与真实 0 可区分）；
 * - 图表 2 张：故障趋势（柱=次数 + 折线=频率，日桶恒为自然日，缺失天补 0）、
 *   单机故障排行 TOP10（接口仅支持指定单日 = 窗口最后一天，标题标注日期）；
 * - 明细表：Apex request 服务端分页（稳定行 ID、列偏好、内建取消/错误重试），
 *   筛选区草稿态（级别/类型/来源/状态/告警码 + 更多筛选折叠区）；
 *   接口无排序参数 → 不开放列排序（G09；旧「仅当前页前端排序」不迁移，
 *   差异登记 tasks/P36.md）；
 * - 行展开告警详情：接口无单条详情 operation，详情用行数据完整呈现
 *   （描述原文/译文回退链、错误建议、异常关联、扩展 JSON）；
 * - 关联导航（TASKS 任务卡新增，P34 导航契约同款）：车辆来源列
 *   （sourceType=VEHICLE）→ /vehicle-info?vehicleKey=、关联任务列 →
 *   /order-info?orderKey=，均按目标菜单码权限过滤（无权限不渲染入口）。
 *
 * 行为契约：
 * - 聚合区与明细表是两个独立请求区域：聚合失败显示错误态（恢复依赖有限退避
 *   自动重查与「查询」按钮，不用 "--"/空图表冒充成功快照，D15）；
 *   明细失败由 Apex 内建错误态承载（含内建重试）；
 * - 空值纪律：单元格缺失留白；KPI 不可计算显示 "--"；
 * - 本页为报表页，不默认轮询（规格 8.2）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, DatePicker, Descriptions, Empty, Skeleton, Tag, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
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
import { StateBlock } from '@/components/StateBlock/StateBlock'
import { DEPLOY_TIMEZONE } from '@/constants/datetime'
import { PERM } from '@/constants/auth/permission.constants'
import { buildAccessContext, hasMenuAccess } from '@/router/routeAccess'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import {
  alarmStatistics,
  pageSystemAlarmRecords,
} from '@/services/report-fault/report-fault.service'
import type {
  AlarmErrorModelDto,
  SystemAlarmRecordDto,
} from '@/services/report-fault/report-fault.service.types'
import {
  buildFaultAlertStatistics,
  type FaultAlertStatistics,
} from '@/features/analyze-visual/fault-alert/statistics'
import { resolveAlarmText } from '@/features/analyze-visual/fault-alert/description'
import { useAggregationQuery } from '@/features/analyze-visual/fault-alert/hooks/useAggregationQuery'
import { FaultTrendChart } from '@/features/analyze-visual/fault-alert/components/FaultTrendChart'
import { VehicleFaultRankChart } from '@/features/analyze-visual/fault-alert/components/VehicleFaultRankChart'
import {
  FaultDetailFilter,
} from '@/features/analyze-visual/fault-alert/components/FaultDetailFilter'
import {
  EMPTY_FILTER_VALUES,
  buildDetailFilterParam,
  type FaultDetailFilterValues,
} from '@/features/analyze-visual/fault-alert/filterModel'
import { MetricHint } from '@/features/analyze-visual/order-statistics/components/MetricHint'
import { RealtimeKpiCard } from '@/features/dashboard/components/RealtimeKpiCard'
import type { KpiViewModel } from '@/features/dashboard/kpiViewModel'
import { formatInteger, formatRatio } from '@/features/dashboard/kpiViewModel'
import { formatDurationMs } from '@/features/dashboard/realtime'
import { buildOrderInfoPath } from '@/features/order-detail/orderDetailNavigation'
import { buildVehicleInfoPath } from '@/features/vehicle-detail/vehicleDetailNavigation'
import type { LucideIcon } from 'lucide-react'
import { AlarmClock, BellRing, CircleCheckBig, Timer } from 'lucide-react'
import styles from './FaultAlert.module.css'

/** 统计窗口默认跨度：近 14 个自然日（旧 FAULT_ALERT_REPORT_DAYS 等价保留） */
const FAULT_ALERT_REPORT_DAYS = 14

/** 秒级时间串格式（统计窗口与筛选时间统一，接口 date-time 墙钟约定） */
const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'

/** 明细表分页选项（旧 TABLE_PAGE_SIZE_OPTIONS 等价保留） */
const PAGE_SIZE_OPTIONS = [10, 20, 50]

/** 告警级别展示元数据（FATAL→严重红 / WARNING→重要蓝；未知枚举显示协议原值） */
const LEVEL_META: Record<string, { color: string; labelKey: string }> = {
  FATAL: { color: 'error', labelKey: '严重' },
  WARNING: { color: 'processing', labelKey: '重要' },
}

/** 关闭状态展示元数据（未处理→橙 / 已关闭→绿；文字+颜色双表达） */
const CLOSED_META: Record<string, { color: string; labelKey: string }> = {
  open: { color: 'warning', labelKey: '未处理' },
  closed: { color: 'success', labelKey: '已关闭' },
}

/** 来源类型展示标签（协议枚举直译；未知原值不臆造映射） */
const SOURCE_LABEL_KEY: Record<string, string> = {
  VEHICLE: '车辆',
  DEVICE: '设备',
  SERVER: '服务器',
}

/** KPI 卡配置：图标 + 标签 key + 口径说明 key（文案走 report-fault 命名空间） */
interface KpiCardConfig {
  key: 'faultCount' | 'openAlertCount' | 'closedRate' | 'averageDurationMs'
  icon: LucideIcon
  labelKey: string
  hintKey: string
}

/** 4 张 KPI 卡（旧 1×4 布局，响应式栅格自动换行） */
const KPI_CARDS: KpiCardConfig[] = [
  { key: 'faultCount', icon: BellRing, labelKey: '故障次数', hintKey: '故障次数·计算方式' },
  { key: 'openAlertCount', icon: AlarmClock, labelKey: '未关闭告警数', hintKey: '未关闭告警数·计算方式' },
  { key: 'closedRate', icon: CircleCheckBig, labelKey: '告警关闭率', hintKey: '告警关闭率·计算方式' },
  { key: 'averageDurationMs', icon: Timer, labelKey: '平均告警时长', hintKey: '平均告警时长·计算方式' },
]

/**
 * 初始统计窗口：部署时区 [今天-(N-1)天 00:00:00, 今天 23:59:59]
 * （旧 initialStatRange 同口径：end 收在当天最后一秒）。
 */
function initialStatRange(): { start: Dayjs; end: Dayjs } {
  const now = dayjs().tz(DEPLOY_TIMEZONE)
  return {
    start: now.subtract(FAULT_ALERT_REPORT_DAYS - 1, 'day').startOf('day'),
    end: now.endOf('day'),
  }
}

/** 筛选草稿 → 明细分页协议参数的转换见 filterModel.ts（纯函数与组件分离） */

/** 无环比 KPI 的展示模型（值可能不可计算：null/NaN → "--"，绝不补 0） */
function nullableKpi(value: number | null, format: (v: number) => string): KpiViewModel {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { display: '--', changeTone: 'neutral' }
  }
  return { display: format(value), changeTone: 'neutral' }
}

/** TanStack Updater 解析：回调可能收到值或函数（P12 同款工具） */
function resolveUpdater<T>(updater: T | ((old: T) => T), old: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(old) : updater
}

/** 行展开告警详情：行数据完整呈现（接口无单条详情 operation，D24 可达性口径） */
function AlarmDetailDescriptions({
  record,
  locale,
}: {
  record: SystemAlarmRecordDto
  locale: string
}) {
  const { t } = useTranslation('report-fault')
  const errorModel = record.errorModel

  // 关联信息 / 扩展 JSON：非空时原样格式化展示（服务端原始数据不翻译不猜测）
  const referencesJson =
    errorModel?.errorReferences && errorModel.errorReferences.length > 0
      ? JSON.stringify(errorModel.errorReferences, null, 2)
      : ''
  const payloadJson =
    record.payloadJson && Object.keys(record.payloadJson).length > 0
      ? JSON.stringify(record.payloadJson, null, 2)
      : ''

  const levelMeta = LEVEL_META[record.alarmLevel ?? '']
  const closedMeta = CLOSED_META[record.isClosed ? 'closed' : 'open']

  return (
    <Descriptions
      size="small"
      bordered
      column={{ xs: 1, sm: 2, md: 3 }}
      items={[
        {
          key: 'sourceType',
          label: t('告警来源'),
          children: record.sourceType
            ? t(SOURCE_LABEL_KEY[record.sourceType] ?? record.sourceType)
            : '',
        },
        { key: 'sourceKey', label: t('来源标识'), children: record.sourceKey ?? '' },
        { key: 'sourceName', label: t('来源名称'), children: record.sourceName ?? '' },
        { key: 'alarmCode', label: t('告警码'), children: record.alarmCode ?? '' },
        { key: 'alarmType', label: t('告警类型'), children: record.alarmType ?? '' },
        {
          key: 'alarmLevel',
          label: t('告警级别'),
          children: levelMeta ? (
            <Tag color={levelMeta.color}>{t(levelMeta.labelKey)}</Tag>
          ) : (
            // 未知级别：显示协议原值（不臆造映射，规格 18.3）
            <Tag>{record.alarmLevel ?? ''}</Tag>
          ),
        },
        { key: 'orderKey', label: t('关联任务'), children: record.orderKey ?? '' },
        { key: 'orderName', label: t('任务名称'), children: record.orderName ?? '' },
        { key: 'upperOrderId', label: t('上层任务'), children: record.upperOrderId ?? '' },
        { key: 'startTime', label: t('发生时间'), children: displayDateTime(record.startTime) },
        { key: 'endTime', label: t('恢复时间'), children: displayDateTime(record.endTime) },
        {
          key: 'duration',
          label: t('持续时间'),
          // 未关闭告警接口不下发持续时长：留白（不补 0，DoD 14）
          children:
            typeof record.durationSeconds === 'number'
              ? formatDurationMs(record.durationSeconds * 1000)
              : '',
        },
        {
          key: 'isClosed',
          label: t('关闭状态'),
          children: <Tag color={closedMeta.color}>{t(closedMeta.labelKey)}</Tag>,
        },
        {
          key: 'errorType',
          label: t('错误类型'),
          children: errorModel?.errorType ?? '',
        },
        {
          key: 'descriptionText',
          label: t('描述原文'),
          span: 3,
          children: errorModel?.errorDescription ?? '',
        },
        {
          key: 'descriptionLocalized',
          label: t('描述译文'),
          span: 3,
          // 译文回退链命中值（当前语言 → zh_CN → en_US），未命中留白
          children: resolveAlarmText(errorModel, 'description', locale),
        },
        {
          key: 'errorHint',
          label: t('处理建议'),
          span: 3,
          children: resolveAlarmText(errorModel, 'hint', locale),
        },
        ...(referencesJson
          ? [
              {
                key: 'errorReferences',
                label: t('异常关联'),
                span: 3,
                children: (
                  <Typography.Paragraph code style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                    {referencesJson}
                  </Typography.Paragraph>
                ),
              },
            ]
          : []),
        ...(payloadJson
          ? [
              {
                key: 'payloadJson',
                label: t('扩展信息'),
                span: 3,
                children: (
                  <Typography.Paragraph code style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                    {payloadJson}
                  </Typography.Paragraph>
                ),
              },
            ]
          : []),
      ]}
    />
  )
}

export default function FaultAlert() {
  const { t, i18n } = useTranslation('report-fault')
  const locale = i18n.language
  const navigate = useNavigate()
  const apexLocale = useApexLocale()

  /* ------------------------------ 权限上下文（导航入口过滤） ------------------------------ */

  const auth = useAppSelector((state) => state.auth)
  // 与守卫同一解析函数；车辆/任务导航契约与 P34 首页同款（按目标菜单码过滤）
  const accessCtx = useMemo(() => buildAccessContext(auth), [auth])
  const canOpenVehicles = hasMenuAccess(accessCtx, PERM.VEHICLE_LIST_VIEW)
  const canOpenOrders = hasMenuAccess(accessCtx, PERM.ORDER_RECORD_VIEW)

  /* --------------------------------- 聚合区（KPI + 图表） --------------------------------- */

  // 统计窗口草稿态：编辑不触发请求，点「查询」才应用为生效条件
  const [rangeDraft, setRangeDraft] = useState<[Dayjs | null, Dayjs | null]>(() => {
    const { start, end } = initialStatRange()
    return [start, end]
  })
  // 生效统计窗口：初值即默认窗口，挂载时由 effect 自动查询一次
  const [appliedRange, setAppliedRange] = useState<{ start: Dayjs; end: Dayjs }>(() =>
    initialStatRange(),
  )

  // 聚合查询（防乱序/取消级联/失败清空+有限退避自动重查，契约见 hook 注释）；
  // fetcher 把协议 VO 映射为页面领域视图（口径集中在纯计算模块）
  const { data: statistics, loading: statsLoading, error: statsError, run: runStatistics } =
    useAggregationQuery<{ start: Dayjs; end: Dayjs }, FaultAlertStatistics>(
      useCallback(
        async (param: { start: Dayjs; end: Dayjs }, options?: { signal?: AbortSignal }) => {
          const vo = await alarmStatistics(
            {
              startTime: param.start.format(DATE_TIME_FORMAT),
              endTime: param.end.format(DATE_TIME_FORMAT),
              // topAgvDate = 窗口最后一天 00:00:00（旧联调实证：只传日期后端解析失败）
              topAgvDate: param.end.startOf('day').format(DATE_TIME_FORMAT),
            },
            options,
          )
          return buildFaultAlertStatistics(vo, param.start, param.end)
        },
        [],
      ),
    )

  // 挂载及生效统计窗口变更（点「查询」）时请求聚合数据
  useEffect(() => {
    runStatistics(appliedRange)
  }, [appliedRange, runStatistics])

  // 点「查询」：草稿区间完整才应用（不完整时按钮已禁用，此处防御性判断）
  const handleStatQuery = useCallback(() => {
    const [start, end] = rangeDraft
    if (start && end) {
      setAppliedRange({ start, end })
    }
  }, [rangeDraft])
  const statDraftValid = !!(rangeDraft[0] && rangeDraft[1])

  /* --------------------------------- 明细表（Apex request） --------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<SystemAlarmRecordDto>>(null)

  // 筛选草稿经 ref 供 request 回调读取最新值（避免闭包捕获旧条件，P03 同款）
  const filtersRef = useRef<FaultDetailFilterValues>(EMPTY_FILTER_VALUES)

  // 类型动态选项：接口无类型字典，从已加载记录的 alarmType 累计去重（随翻页补全）
  const [alarmTypeOptions, setAlarmTypeOptions] = useState<string[]>([])
  const collectAlarmTypes = useCallback((rows: SystemAlarmRecordDto[]) => {
    setAlarmTypeOptions((prev) => {
      const merged = new Set(prev)
      for (const row of rows) {
        if (row.alarmType) merged.add(row.alarmType)
      }
      // 无新增类型时保持原引用，避免触发无意义重渲染
      return merged.size === prev.length ? prev : [...merged].sort()
    })
  }, [])

  // 提交筛选：记录条件并回首页（DoD 5「筛选变化返回第一页」）
  const applyFilters = useCallback((values: FaultDetailFilterValues) => {
    filtersRef.current = values
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [])

  // 重置：清空条件并回首页重新查询（与筛选提交同一链路）
  const handleFilterReset = useCallback(() => {
    applyFilters(EMPTY_FILTER_VALUES)
  }, [applyFilters])

  /* --------------------------------- 列偏好接线（P03/P12 同款） --------------------------------- */

  const prefs = useColumnPreferences('report-fault:main')
  const [prefSlices, setPrefSlices] = useState<{
    columnOrder?: ColumnOrderState
    columnVisibility?: ColumnVisibilityState
    columnSizing?: ColumnSizingState
    columnPinning?: ColumnPinningState
  }>({})
  // 受控切片的同步镜像：连续多次 onChange 间保持最新合并值，避免闭包旧值
  const prefSlicesRef = useRef(prefSlices)

  /** 列钉住默认形态（本页无操作列，双侧为空；类型上要求 start/end 字段齐全） */
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

  /* --------------------------------- 导航回调（P34 契约同款） --------------------------------- */

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

  /* --------------------------------- 列定义（逐列核对旧版） --------------------------------- */

  const columns = useMemo<ApexColumnDef<SystemAlarmRecordDto>[]>(
    () => [
      {
        accessorKey: 'id',
        header: t('事件 ID'),
        enableSorting: false,
        size: 140,
        meta: { apex: { align: 'start' } },
        // int64 标识原值展示（JSON number 承载，G10 与 P21/P33 同口径）；缺失留白
        cell: (info) => {
          const value = info.getValue()
          return value === undefined || value === null ? '' : String(value)
        },
      },
      {
        accessorKey: 'alarmLevel',
        header: t('级别'),
        enableSorting: false,
        size: 90,
        meta: { apex: { align: 'center' } },
        cell: (info) => {
          const level = info.getValue() as string | undefined
          const meta = LEVEL_META[level ?? '']
          if (!meta) {
            // 未知级别：协议原值展示（不臆造映射，规格 18.3）
            return level ? <Tag>{level}</Tag> : null
          }
          return <Tag color={meta.color}>{t(meta.labelKey)}</Tag>
        },
      },
      {
        accessorKey: 'alarmType',
        header: t('类型'),
        enableSorting: false,
        size: 130,
        meta: { apex: { align: 'start' } },
        // 后端自由字符串原文展示、不做枚举翻译；缺失留白
        cell: (info) => (info.getValue() as string | undefined) ?? '',
      },
      {
        accessorKey: 'sourceName',
        header: t('车辆'),
        enableSorting: false,
        size: 160,
        meta: { apex: { align: 'start' } },
        cell: (info) => {
          const record = info.row.original
          // 展示名优先 sourceName，空时回退 sourceKey（旧实现同口径）
          const display = record.sourceName || record.sourceKey || ''
          // 导航契约（P34 同款）：车辆来源 + 有标识 + 有权限才渲染链接入口；
          // 设备/服务器来源仅展示名称（不导航）
          const vehicleKey = record.sourceKey
          if (record.sourceType === 'VEHICLE' && vehicleKey && openVehicle) {
            return (
              <Button type="link" size="small" onClick={() => openVehicle(vehicleKey)}>
                {display}
              </Button>
            )
          }
          return display
        },
      },
      {
        accessorKey: 'orderName',
        header: t('关联任务'),
        enableSorting: false,
        size: 160,
        meta: { apex: { align: 'start' } },
        cell: (info) => {
          const record = info.row.original
          const display = record.orderName || record.orderKey || ''
          // 导航契约：有任务 key + 有权限才渲染链接（参数用 orderKey 而非展示名）
          const orderKey = record.orderKey
          if (orderKey && openOrder) {
            return (
              <Button type="link" size="small" onClick={() => openOrder(orderKey)}>
                {display}
              </Button>
            )
          }
          return display
        },
      },
      {
        accessorKey: 'errorModel',
        header: t('描述'),
        enableSorting: false,
        size: 260,
        meta: { apex: { align: 'start' } },
        // 译文回退链：当前语言 → zh_CN → en_US → 原文；全空留白（空值纪律）
        cell: (info) => resolveAlarmText(info.getValue() as AlarmErrorModelDto | null | undefined, 'description', locale),
      },
      {
        accessorKey: 'startTime',
        header: t('发生时间'),
        enableSorting: false,
        size: 170,
        meta: { apex: { align: 'start' } },
        // 缺失/不可解析统一留白（displayDateTime 输出空串，AGENTS §3 空值纪律）
        cell: (info) => displayDateTime(info.getValue() as string | number | null | undefined),
      },
      {
        accessorKey: 'endTime',
        header: t('恢复时间'),
        enableSorting: false,
        size: 170,
        meta: { apex: { align: 'start' } },
        // 未关闭告警接口不下发恢复时间：留白（旧「--」占位废弃）
        cell: (info) => displayDateTime(info.getValue() as string | number | null | undefined),
      },
      {
        accessorKey: 'durationSeconds',
        header: t('持续时间'),
        enableSorting: false,
        size: 110,
        meta: { apex: { align: 'end' } },
        // 秒 → 展示时长；未关闭不下发：留白
        cell: (info) => {
          const seconds = info.getValue()
          return typeof seconds === 'number' ? formatDurationMs(seconds * 1000) : ''
        },
      },
      {
        accessorKey: 'isClosed',
        header: t('状态'),
        enableSorting: false,
        size: 90,
        meta: { apex: { align: 'center' } },
        // 接口只有 关闭/未关闭 两种状态（无「处理中」中间态，旧实现同口径）
        cell: (info) => {
          const meta = CLOSED_META[info.getValue() ? 'closed' : 'open']
          return <Tag color={meta.color}>{t(meta.labelKey)}</Tag>
        },
      },
    ],
    [t, locale, openVehicle, openOrder],
  )

  /* --------------------------------- KPI 展示模型 --------------------------------- */

  const firstLoad = statsLoading && !statistics && !statsError

  const kpiViews = useMemo<Record<KpiCardConfig['key'], KpiViewModel> | null>(() => {
    if (!statistics) return null
    return {
      // 千分位整数（Intl，与 P34 KPI 数值纪律同源）
      faultCount: nullableKpi(statistics.faultCount, (v) =>
        formatInteger(v, locale),
      ),
      openAlertCount: nullableKpi(statistics.openAlertCount, (v) =>
        formatInteger(v, locale),
      ),
      // 关闭率 0–1 → 百分比；null（窗口内无告警）→ "--"
      closedRate: nullableKpi(statistics.closedRate, (v) => formatRatio(v, locale)),
      // 平均告警时长毫秒 → 展示时长；null → "--"
      averageDurationMs: nullableKpi(statistics.averageDurationMs, formatDurationMs),
    }
  }, [statistics, locale])

  /** KPI 强调边框：未关闭告警 > 0 红、关闭率 < 1 橙（旧实现阈值等价保留） */
  const kpiAccent = (key: KpiCardConfig['key']): 'danger' | 'warn' | undefined => {
    if (!statistics) return undefined
    if (key === 'openAlertCount' && statistics.openAlertCount > 0) return 'danger'
    if (key === 'closedRate' && statistics.closedRate !== null && statistics.closedRate < 1) {
      return 'warn'
    }
    return undefined
  }

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
              : (kpiViews?.[card.key] ?? { display: '--', changeTone: 'neutral' })
          }
          loading={firstLoad}
          accent={kpiAccent(card.key)}
        />
      ))}
    </div>
  )

  /* --------------------------------- 渲染 --------------------------------- */

  // 排行卡标题标注对应日期（接口仅支持单日排行，避免误读为窗口排行）；
  // 中文 key 含插值占位（P12 同款：zh-CN 下 key 原文 + 插值，其余语言按分片译文）
  const rankTitle = t('单机故障排行 TOP10（{{date}}）', {
    date: appliedRange.end.format('YYYY-MM-DD'),
  })

  return (
    <div className={styles.page}>
      {/* 统计工具栏：统计窗口驱动 KPI 与图表（草稿态编辑，点「查询」才请求）；明细表不受影响 */}
      <div className={styles.toolbar}>
        <DatePicker.RangePicker
          showTime
          format={DATE_TIME_FORMAT}
          value={rangeDraft}
          onChange={(value) => setRangeDraft(value ?? [null, null])}
          placeholder={[t('开始时间'), t('结束时间')]}
        />
        <Button
          type="primary"
          loading={statsLoading}
          disabled={!statDraftValid}
          onClick={handleStatQuery}
        >
          {t('查询')}
        </Button>
      </div>

      {/* 聚合区（KPI + 图表同源一次请求）：失败显示错误态并停止冒充；
          恢复依赖有限退避自动重查与「查询」按钮（按钮纪律：无重试/刷新按钮） */}
      {statsError && !statistics ? (
        <div className={styles.aggregateError}>
          <StateBlock variant="offline" minHeight={320} />
        </div>
      ) : firstLoad ? (
        <div className={styles.aggregateLoading}>
          <Skeleton active title={false} paragraph={{ rows: 8 }} />
        </div>
      ) : statistics ? (
        <>
          {renderKpiRow()}
          <div className={styles.chartRow}>
            <section className={styles.chartCard}>
              <h3 className={styles.cardTitle}>
                {t('故障趋势')}
                <MetricHint
                  label={t('查看统计口径')}
                  content={t('故障趋势·计算方式')}
                />
              </h3>
              <div className={styles.chartBody}>
                {statistics.trend.length > 0 ? (
                  <FaultTrendChart
                    data={statistics.trend}
                    barSeriesName={t('故障次数（次）')}
                    lineSeriesName={t('故障频率（次/天）')}
                  />
                ) : (
                  // 真实空结果（窗口内无任何告警天）：明确空态，区别于查询失败
                  <Empty description={t('暂无数据')} />
                )}
              </div>
            </section>
            <section className={styles.chartCard}>
              <h3 className={styles.cardTitle}>
                {rankTitle}
                <MetricHint label={t('查看统计口径')} content={t('单机故障排行·计算方式')} />
              </h3>
              <div className={styles.chartBody}>
                {statistics.vehicleRanking.length > 0 ? (
                  <VehicleFaultRankChart
                    data={statistics.vehicleRanking}
                    seriesName={t('故障次数（次）')}
                  />
                ) : (
                  <Empty description={t('暂无数据')} />
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}

      {/* 明细卡：筛选 + Apex 明细表（独立请求区域，失败互不影响聚合区） */}
      <section className={styles.detailCard}>
        <h3 className={styles.cardTitle}>{t('故障明细')}</h3>
        <FaultDetailFilter
          alarmTypeOptions={alarmTypeOptions}
          onSearch={applyFilters}
          onReset={handleFilterReset}
        />
        <div className={styles.tableWrap}>
          <ApexTableReact
            ref={tableApiRef}
            tableRef={tableInstanceRef}
            columns={columns}
            request={(params) => {
              const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
              return pageSystemAlarmRecords(
                { pageNo, pageSize, ...buildDetailFilterParam(filtersRef.current) },
                { signal: params.signal },
              ).then((page) => {
                // 类型动态选项随翻页累计补全（旧实现同能力）
                collectAlarmTypes(page.records ?? [])
                return {
                  // rowCount 取真实 total；未知总数不由前端补 0（DoD 5）
                  data: page.records ?? [],
                  rowCount: page.total ?? 0,
                }
              })
            }}
            getRowId={stringFieldRowId('id')}
            expandable={{
              // 行展开告警详情：全部行可展开（详情为行数据完整呈现）
              expandedRowRender: (record) => <AlarmDetailDescriptions record={record} locale={locale} />,
            }}
            locale={apexLocale}
            pagination={{ pageSizeOptions: PAGE_SIZE_OPTIONS }}
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
