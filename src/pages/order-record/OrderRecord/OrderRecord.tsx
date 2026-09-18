/**
 * 任务管理页（P03 整页重写：表格样板）。
 *
 * 旧实现（C:\code\dd\src\pages\OrderRecord）：统计条 1 秒轮询 + antd Table 1 秒轮询
 * + 搜索表单 + 创建/取消/模拟分配/详情四个弹窗。本重写保持业务闭环等价：
 * - 统计与列表轮询改为 useVisiblePolling 约 5 秒可见串行（契约集中配置，
 *   旧 1 秒全量轮询不保留——规格 8.2 实时生命周期统一口径）；
 * - 列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID、列偏好、
 *   内建取消/错误重试）；排序不启用（G09：后端未声明全量排序）；
 * - 筛选口径与旧实现一致（仅收集有值字段；导出与列表共用同一筛选）；
 * - 任务操作命令经 confirmCommand 列明对象与影响（DoD 8）；取消必须填原因；
 * - 模拟分配为真实仿真接口，界面明确标注（D25）；
 * - 导出走传输管理器（切页继续/关页提示/不确定进度，DoD 9）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Button, Dropdown, Space, Tag, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
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
import { Copy } from 'lucide-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { usePermission } from '@/hooks/usePermission'
import { useVisiblePolling } from '@/hooks/useVisiblePolling'
import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { copyText } from '@/utils/clipboard/clipboard'
import { beginTransfer } from '@/services/transfer/transferManager'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  exportOrderRecords,
  fetchOrderRecordStateStatistic,
  operateOrderTask,
  pageOrderRecords,
} from '@/services/order-record/order.service'
import { DISPATCHER_STATUS_TEXT } from '@/services/order-record/order.service.types'
import type {
  OrderRecordDto,
  OrderRecordStateStatisticDto,
  OrderState,
  OrderTaskOperateCommand,
} from '@/services/order-record/order.service.types'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import { OrderSearchForm } from '@/features/order-record/components/OrderSearchForm'
import type { OrderFilters } from '@/features/order-record/components/OrderSearchForm'
import { OrderStatisticsBar } from '@/features/order-record/components/OrderStatisticsBar'
import { CreateOrderModal } from '@/features/order-record/components/CreateOrderModal'
import { OrderCancelModal } from '@/features/order-record/components/OrderCancelModal'
import { MockDispatchModal } from '@/features/order-record/components/MockDispatchModal'
import { OrderInfoModal } from '@/features/order-record/components/OrderInfoModal'
import styles from './OrderRecord.module.css'

/** 任务状态 → 中文文案 key（标签展示；与旧实现 orderStateUnfold 名称一致） */
const ORDER_STATE_LABEL: Record<OrderState, string> = {
  IN_QUEUE: '队列中',
  OUT_QUEUE: '队列外',
  PROCESSING: '进行中',
  HANG: '挂起',
  CANCELLED: '已取消',
  SUCCEEDED: '成功',
  FAILED: '失败',
}

/** 任务状态 → 标签颜色（旧实现同色系；未知状态无色显示原值） */
const ORDER_STATE_TAG_COLOR: Record<OrderState, string> = {
  IN_QUEUE: 'default',
  OUT_QUEUE: '#F50',
  PROCESSING: 'processing',
  HANG: 'warning',
  CANCELLED: 'magenta',
  SUCCEEDED: 'success',
  FAILED: 'error',
}

/**
 * 非取消命令定义（取消走独立弹窗填原因）：key 为协议命令值，
 * label 为中文文案 key，enabled 为允许执行的任务状态（与旧实现一致）。
 */
const ORDER_OPERATE_ITEMS: { key: OrderTaskOperateCommand; label: string; enabled: OrderState[] }[] = [
  { key: 'CMD_ORDER_IN_QUEUE_TO_OUT_QUEUE', label: '移出队列', enabled: ['IN_QUEUE'] },
  { key: 'CMD_ORDER_OUT_QUEUE_TO_IN_QUEUE', label: '移入队列', enabled: ['OUT_QUEUE'] },
  { key: 'CMD_ORDER_HANG_TO_SKIP', label: '跳过', enabled: ['HANG'] },
  { key: 'CMD_ORDER_HANG_TO_CONTINUE', label: '继续', enabled: ['HANG'] },
]

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function OrderRecord() {
  const { t } = useTranslation('orderRecord')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限：检测/操作入口无权限隐藏（DoD 3；与旧实现按钮码一致）
  const { hasPerm } = usePermission()
  const canCheck = hasPerm(PERM_BUTTON.ORDER_RECORD_CHECK)
  const canOperate = hasPerm(PERM_BUTTON.ORDER_RECORD_OPERATE)

  // 页签请求 scope：导出传输挂到页签 key（关页提示/孤儿完成提示的定位依据）；
  // 无 scope（理论上页面必有）时按 null 登记，传输退化为无页签归属
  const scope = useRequestScope()
  const transferTabKey = scope?.scopeKey ?? null

  /* ------------------------------ 弹窗与操作状态（先于列定义声明） ------------------------------ */

  const [cancelTarget, setCancelTarget] = useState<OrderRecordDto | null>(null)
  const [mockTarget, setMockTarget] = useState<OrderRecordDto | null>(null)
  const [detailKey, setDetailKey] = useState<string>('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const openDetail = useCallback((record: OrderRecordDto) => {
    setDetailKey(record.orderKey ?? '')
    setDetailOpen(true)
  }, [])

  const openMockDispatch = useCallback((record: OrderRecordDto) => {
    setMockTarget(record)
  }, [])

  /* ------------------------------ 统计区域（独立请求区域） ------------------------------ */

  const [statistic, setStatistic] = useState<OrderRecordStateStatisticDto | null>(null)
  const [statisticLoading, setStatisticLoading] = useState(true)
  const [statisticError, setStatisticError] = useState(false)

  const reloadStatistic = useCallback((signal?: AbortSignal) => {
    setStatisticLoading(true)
    return fetchOrderRecordStateStatistic({ signal })
      .then((data) => {
        setStatistic(data)
        setStatisticError(false)
      })
      .catch((error: unknown) => {
        // 主动取消静默；真实失败清空统计区域并标错（DoD 6，不用旧数据冒充成功）
        if (isCancelledError(error)) return
        setStatistic(null)
        setStatisticError(true)
      })
      .finally(() => {
        setStatisticLoading(false)
      })
  }, [])

  /* ---------------------------------- 列表区域（Apex） ---------------------------------- */

  // 筛选条件经 ref 供 request 回调读取最新值（避免闭包捕获旧筛选）；
  // appliedFilters 仅用于「筛选已启用」提示
  const filtersRef = useRef<OrderFilters>({})
  const [hasFilters, setHasFilters] = useState(false)
  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<OrderRecordDto>>(null)

  /** 操作后统一刷新：列表当前页 + 统计（操作成功后的刷新是主刷新入口之一） */
  const refreshAfterMutation = useCallback(() => {
    tableApiRef.current?.reload()
    void reloadStatistic()
  }, [reloadStatistic])

  /** 提交筛选：记录条件并回首页（DoD 5「筛选变化返回第一页」） */
  const handleSearch = useCallback((filters: OrderFilters) => {
    filtersRef.current = filters
    setHasFilters(Object.keys(filters).length > 0)
    // 回到第一页并重新请求：resetPageIndex 后 reload 以新筛选发起首页查询
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [])

  /* ----------------------------------- 实时轮询（约 5 秒） ----------------------------------- */

  // 统计与列表是两个独立请求区域：轮询刷新两者，失败互不影响（各自区域独立呈现）
  const refreshAll = useCallback(async () => {
    // 统计与列表串行发起：两区域独立呈现成功/失败（DoD 6）
    await reloadStatistic()
    tableApiRef.current?.reload()
  }, [reloadStatistic])

  useVisiblePolling({ refresh: refreshAll })

  /* ------------------------------------ 列偏好接线 ------------------------------------ */

  const prefs = useColumnPreferences('order-record:main')
  const [prefSlices, setPrefSlices] = useState<ColumnPrefSlices>({})
  // 受控切片的同步镜像：连续多次 onChange 间保持最新合并值，避免闭包旧值
  const prefSlicesRef = useRef<ColumnPrefSlices>({})

  useEffect(() => {
    if (!prefs || !tableInstanceRef.current) return
    try {
      // 官方适配器 load 返回四切片；晚一帧应用是 T00.5 约定的预期行为
      const slices = prefs.load({
        columns: tableInstanceRef.current.getAllLeafColumns(),
        initialState: {},
      })
      setPrefSlices({
        columnOrder: slices.columnOrder,
        columnVisibility: slices.columnVisibility,
        columnSizing: slices.columnSizing,
        columnPinning: slices.columnPinning,
      })
      prefSlicesRef.current = {
        columnOrder: slices.columnOrder,
        columnVisibility: slices.columnVisibility,
        columnSizing: slices.columnSizing,
        columnPinning: slices.columnPinning,
      }
    } catch {
      // 偏好读取失败不阻塞表格：以默认布局运行
    }
  }, [prefs])

  /**
   * 列偏好持久化：合并进受控切片（state 受控值必须跟随用户改动）后，把
   * 「合并后的完整四切片」交给官方适配器 save（300ms 防抖写 localStorage）。
   * 两个已实证的约束：
   * - 只 save 不更新受控 state：表格下一帧按旧受控值渲染，用户改动被回弹；
   * - save 传单片补丁：适配器 save 是整体替换语义（pending=cloneSlices(state)），
   *   列设置面板一次确认连发四类回调，先发的切片会被后发的补丁覆盖丢失。
   */
  const persistPrefs = useCallback(
    (patch: ColumnPrefSlices) => {
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

  /* ------------------------------------- 任务命令 ------------------------------------- */

  /** 非取消命令执行：确认后的提交与结果呈现（状态码=调度子系统拒绝） */
  const executeOperate = useCallback(
    async (record: OrderRecordDto, operate: OrderTaskOperateCommand, cancelReason: string) => {
      try {
        const statusCode = await operateOrderTask({
          orderTaskKey: record.orderKey ?? '',
          cancelReason,
          operate,
        })
        if (statusCode) {
          // 映射文案优先，未知码显示原值（规格 18.3），不当成功处理
          message.warning(t(DISPATCHER_STATUS_TEXT[statusCode] ?? statusCode))
          return
        }
        message.success(t('订单操作成功'))
        refreshAfterMutation()
      } catch (error) {
        if (!isCancelledError(error)) {
          message.error(t('订单操作失败') + apiErrorMessage(error))
        }
      }
    },
    [message, refreshAfterMutation, t],
  )

  /** 操作菜单渲染：按当前任务状态禁用不可用命令（旧实现同语义） */
  const renderOperateMenu = useCallback(
    (record: OrderRecordDto): ReactNode => {
      const items: MenuProps['items'] = ORDER_OPERATE_ITEMS.map((item) => ({
        key: item.key,
        label: t(item.label),
        disabled: !item.enabled.includes(record.orderState as OrderState),
      }))
      return (
        <Dropdown
          trigger={['click']}
          menu={{
            items,
            onClick: ({ key }) => {
              const definition = ORDER_OPERATE_ITEMS.find((item) => item.key === key)
              if (!definition) return
              // 破坏性操作确认：列明对象（名称+编号）与影响，确认后才发命令（DoD 8）
              void confirmCommand({
                title: t('订单操作确认'),
                targets: [`${record.orderName ?? ''}（${record.orderKey ?? ''}）`],
                impact: t('订单操作影响提示'),
              }).then((confirmed) => {
                if (confirmed) void executeOperate(record, definition.key, '')
              })
            },
          }}
        >
          <Button size="small" type="primary">
            {t('操作项')}
          </Button>
        </Dropdown>
      )
    },
    [executeOperate, t],
  )

  /* ------------------------------------- 表格列定义 ------------------------------------- */

  const columns = useMemo<ApexColumnDef<OrderRecordDto>[]>(() => {
    /** 长文本单元格：空值留白、悬浮显示全文（原文不翻译） */
    const textCell = (maxWidth: number) => (info: { getValue: () => unknown }) => {
      const value = info.getValue()
      const text = value === null || value === undefined || value === '' ? '' : String(value)
      return (
        <Tooltip title={text} placement="topLeft">
          <span className={styles.ellipsis} style={{ maxWidth: maxWidth - 16 }}>
            {text}
          </span>
        </Tooltip>
      )
    }
    const timeCell = (info: { getValue: () => unknown }) => displayDateTime(info.getValue() as string | null)

    return [
      {
        accessorKey: 'orderKey',
        header: t('任务编号'),
        enableSorting: false,
        size: 150,
        meta: { apex: { align: 'center' } },
        cell: textCell(150),
      },
      {
        accessorKey: 'orderName',
        header: t('任务名称'),
        enableSorting: false,
        size: 150,
        meta: { apex: { align: 'center' } },
        cell: textCell(150),
      },
      {
        accessorKey: 'orderState',
        header: t('任务状态'),
        enableSorting: false,
        size: 100,
        meta: { apex: { align: 'center' } },
        cell: (info) => {
          const value = info.getValue() as OrderState | undefined
          // 未知状态显示原值（无色 Tag），缺失留白（规格 11.2/18.3）
          if (!value) return null
          const known = value in ORDER_STATE_LABEL
          return (
            <Tag color={known ? ORDER_STATE_TAG_COLOR[value] : undefined}>
              {known ? t(ORDER_STATE_LABEL[value]) : value}
            </Tag>
          )
        },
      },
      {
        accessorKey: 'taskId',
        header: t('任务ID'),
        enableSorting: false,
        size: 140,
        meta: { apex: { align: 'center' } },
        // 可空（如充电类订单）：缺失留白；有值可复制（协议原值不翻译）
        cell: (info) => {
          const value = info.getValue() as string | null
          if (!value) return null
          return (
            <Tooltip title={`${value}（${t('点击复制')}）`} placement="topLeft">
              <span
                className={styles.copyable}
                onClick={() => {
                  void copyText(value).then((ok) => {
                    if (ok) message.success(t('已复制任务ID'))
                    else message.warning(t('复制失败'))
                  })
                }}
              >
                <span className={styles.ellipsis} style={{ maxWidth: 116 }}>{value}</span>
                <Copy size={12} className={styles.copyIcon} />
              </span>
            </Tooltip>
          )
        },
      },
      {
        accessorKey: 'appointVehicleName',
        header: t('指定车辆'),
        enableSorting: false,
        size: 150,
        meta: { apex: { align: 'center' } },
        cell: textCell(150),
      },
      {
        accessorKey: 'appointVehicleGroupName',
        header: t('指定车辆组'),
        enableSorting: false,
        size: 150,
        meta: { apex: { align: 'center' } },
        cell: textCell(150),
      },
      {
        accessorKey: 'executeVehicleName',
        header: t('执行车辆'),
        enableSorting: false,
        size: 170,
        meta: { apex: { align: 'center' } },
        cell: textCell(170),
      },
      {
        accessorKey: 'priority',
        header: t('优先级'),
        enableSorting: false,
        size: 80,
        meta: { apex: { align: 'center' } },
        // 旧系统为 0-999 自由数值（无既定枚举语义）：显示原值，不臆造档位文案（规格 11.2/18.3）
        cell: (info) => info.getValue() ?? '',
      },
      {
        accessorKey: 'executeTime',
        header: t('开始执行时间'),
        enableSorting: false,
        size: 160,
        meta: { apex: { align: 'center' } },
        cell: timeCell,
      },
      {
        accessorKey: 'finalTime',
        header: t('结束执行时间'),
        enableSorting: false,
        size: 160,
        meta: { apex: { align: 'center' } },
        cell: timeCell,
      },
      {
        accessorKey: 'createTime',
        header: t('创建时间'),
        enableSorting: false,
        size: 160,
        meta: { apex: { align: 'center' } },
        cell: timeCell,
      },
      {
        accessorKey: 'failReason',
        header: t('失败原因'),
        enableSorting: false,
        size: 150,
        meta: { apex: { align: 'center' } },
        cell: textCell(150),
      },
      {
        accessorKey: 'hangReason',
        header: t('挂起原因'),
        enableSorting: false,
        size: 150,
        meta: { apex: { align: 'center' } },
        cell: textCell(150),
      },
      {
        accessorKey: 'cancelReason',
        header: t('取消原因'),
        enableSorting: false,
        size: 150,
        meta: { apex: { align: 'center' } },
        cell: textCell(150),
      },
      {
        // 操作列：固定右侧不参与偏好持久化；入口受按钮码控制（无权限隐藏）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 230,
        meta: { apex: { align: 'center' } },
        cell: ({ row }) => (
          <Space size={4}>
            {/* 检测=模拟分配入口：仅队列中任务可用（旧实现同语义） */}
            {canCheck ? (
              <Button
                size="small"
                type="link"
                disabled={row.original.orderState !== 'IN_QUEUE'}
                onClick={() => openMockDispatch(row.original)}
              >
                {t('检测')}
              </Button>
            ) : null}
            <Button size="small" type="link" onClick={() => openDetail(row.original)}>
              {t('详情')}
            </Button>
            {canOperate ? renderOperateMenu(row.original) : null}
          </Space>
        ),
      },
    ]
  }, [t, canCheck, canOperate, message, openDetail, openMockDispatch, renderOperateMenu])

  /* --------------------------------------- 导出 --------------------------------------- */

  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(
    (filters: OrderFilters) => {
      if (exporting) return
      setExporting(true)
      // 经传输管理器登记：切页继续、关页提示、孤儿完成提示（DoD 9/规格 10）
      const transfer = beginTransfer({
        tabKey: transferTabKey,
        kind: 'download',
        name: t('导出Excel'),
      })
      exportOrderRecords(filters, { signal: transfer.signal })
        .then(({ blob, filename }) => {
          // 媒体类型粗校验：JSON/HTML 说明是异常网关响应，不保存为伪文件（DoD 9）
          if (blob.type.includes('json') || blob.type.includes('html')) {
            transfer.fail(t('导出订单记录失败'))
            message.error(t('导出订单记录失败'))
            return
          }
          // 文件名：服务端 content-disposition 优先，取不到回退本地默认名
          const safeName = filename || t('订单记录.xlsx')
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = safeName
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          transfer.succeed()
          message.success(t('导出订单记录成功'))
        })
        .catch((error: unknown) => {
          if (!isCancelledError(error)) {
            const reason = t('导出订单记录出错：{{msg}}', { msg: apiErrorMessage(error) })
            transfer.fail(reason)
            message.error(reason)
          } else {
            // 主动取消仅代表本机终止等待：按「结果待确认」语义标记失败说明
            transfer.fail(t('导出订单记录失败'))
          }
        })
        .finally(() => setExporting(false))
    },
    [exporting, message, transferTabKey, t],
  )

  return (
    <div className={styles.page}>
      {/* 统计条：独立请求区域，约 5 秒可见轮询（失败自动恢复，无手动刷新/重试入口） */}
      <OrderStatisticsBar
        statistic={statistic}
        loading={statisticLoading}
        error={statisticError}
      />

      {/* 搜索表单：查询/清空/创建（按钮码）/导出 */}
      <OrderSearchForm
        onSearch={handleSearch}
        onCreate={() => setCreateOpen(true)}
        onExport={handleExport}
      />

      {/* 工具行仅承载「筛选已启用」提示：不设手动刷新按钮，新鲜度由可见轮询保证 */}
      <div className={styles.toolbar}>
        {hasFilters ? (
          <span className={styles.filterHint}>{t('筛选已启用，导出与列表使用相同条件')}</span>
        ) : null}
      </div>

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）。
          受控列状态经 state 切片合并（不影响内建 pagination 管理） */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageOrderRecords(
              { pageNo, pageSize, ...filtersRef.current },
              { signal: params.signal },
            ).then((page) => ({
              // rowCount 取真实 total；未知总数不由前端补 0（DoD 5）
              data: page.records ?? [],
              rowCount: page.total ?? 0,
            }))
          }}
          getRowId={stringFieldRowId('orderKey')}
          locale={apexLocale}
          pagination={{ pageSizeOptions: [10, 20, 50, 100, 200] }}
          // 开启官方列设置面板：列显隐/调序/宽度/固定必须有你不可少的用户入口，
          // 否则下方列偏好持久化管线（state 切片 + save）没有任何触发来源（DoD 5）。
          // 序号列必须显式关闭：包内开启列设置会默认带出序号列，旧页无序号列，等价迁移不允许列结构漂移
          columnSettingsEnabled
          showRowNumber={false}
          // 高度跟随 tableWrap 弹性剩余空间：视口高度硬编码会在矮窗口把分页器顶出工作区
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
            persistPrefs({ columnVisibility: resolveUpdater(updater, prefSlices.columnVisibility ?? {}) })
          }
          onColumnSizingChange={(updater) =>
            persistPrefs({ columnSizing: resolveUpdater(updater, prefSlices.columnSizing ?? {}) })
          }
          onColumnPinningChange={(updater) =>
            persistPrefs({ columnPinning: resolveUpdater(updater, prefSlices.columnPinning ?? { start: [], end: [] }) })
          }
        />
      </div>

      {/* 弹窗组：创建（草稿保留）/取消原因/模拟分配（仿真）/详情快速预览。
          取消/模拟分配按目标挂载：切换目标时 Modal 重建，表单态不串任务 */}
      <CreateOrderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refreshAfterMutation}
      />
      {cancelTarget ? (
        <OrderCancelModal
          open
          orderKey={cancelTarget.orderKey ?? ''}
          orderName={cancelTarget.orderName ?? ''}
          onClose={() => setCancelTarget(null)}
          onSucceeded={refreshAfterMutation}
        />
      ) : null}
      {mockTarget ? (
        <MockDispatchModal
          open
          orderKey={mockTarget.orderKey ?? ''}
          onClose={() => setMockTarget(null)}
          onSucceeded={refreshAfterMutation}
        />
      ) : null}
      <OrderInfoModal
        open={detailOpen}
        orderKey={detailKey}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  )
}

/**
 * TanStack Updater 解析：回调可能收到值或函数（旧值 → 新值）。
 * 列偏好持久化只需要最终值，这里以当前受控切片为旧值统一折叠。
 */
function resolveUpdater<T>(updater: T | ((old: T) => T), old: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(old) : updater
}
