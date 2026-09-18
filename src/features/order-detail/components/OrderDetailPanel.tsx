/**
 * 任务详情业务组件（P38）：主体描述列表 + 子任务（mission）服务端分页表 + 动作展开子表。
 *
 * 完整详情页（/order-info，工作区页签/独立窗口）与列表快速预览弹窗共用本组件
 * （TASKS P38：快速预览复用详情业务组件），两种容器只换外壳与尺寸参数。
 *
 * 数据与契约（沿用 P03 详情弹窗已联验形态）：
 * - 单次请求喂两个区域（POST getOrderRecordDetail：主体 orderRecord + missionPage），
 *   避免同参重复请求；主体跟随同一响应填充，失败时两区域同源呈现真实错误；
 * - mission 表格为 Apex request 模式：服务端分页（missionPage.records/total）、
 *   行 ID=orderMissionKey、不启用排序（G09：后端未声明全量排序）；
 * - 每行展开动作子表复用 MissionActionsTable（data 模式完整小集合）；
 * - orderKey 变化即重开数据（页签/弹窗各自持有实例，不跨实体复用请求结果）；
 * - 空值留白、未知枚举显示原值、时间统一 displayDateTime（AGENTS 第 3 节）。
 */

import { useCallback, useState } from 'react'
import { Descriptions, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/components/StateBlock/StateBlock'
import { ApexTableReact } from 'apex-table-react'
import type { ApexColumnDef } from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import { apiErrorMessage } from '@/services/request/request'
import { getOrderRecordDetail } from '@/services/order-record/order.service'
import type {
  OrderMissionDto,
  OrderRecordDto,
} from '@/services/order-record/order.service.types'
import {
  MISSION_STATE_OPTIONS,
  ORDER_STATE_OPTIONS,
  ORDER_TYPE_OPTIONS,
} from '@/constants/order/orderDisplayOptions'
import { MissionActionsTable } from './MissionActionsTable'
import styles from './OrderDetailPanel.module.css'

/** 主键/枚举展示辅助：缺失留白；未知枚举显示原值（不猜语义） */
function describeOption(options: { value: string; label: string }[], value?: string | null): string {
  if (!value) return ''
  const found = options.find((item) => item.value === value)
  return found ? found.label : value
}

interface OrderDetailPanelProps {
  /** 目标订单 key（getOrderRecordDetail.orderTaskKey） */
  orderKey: string
  /** 主体描述列表列数：完整页 3 列（旧 /order-info 形态）、弹窗 2 列（旧弹窗形态） */
  descriptionsColumn?: 2 | 3
  /**
   * mission 表格高度：'fill' = 在父级 flex 列容器中弹性撑满剩余空间（完整页，
   * 禁止 calc(100vh) 硬编码——视口高度一变即失准，AGENTS 第 1 节）；
   * 数字 = 固定像素（弹窗形态）。
   */
  missionTableHeight?: number | 'fill'
}

export function OrderDetailPanel({
  orderKey,
  descriptionsColumn = 2,
  missionTableHeight = 'fill',
}: OrderDetailPanelProps) {
  const { t } = useTranslation('orderRecord')
  const apexLocale = useApexLocale()

  // 详情主体（orderRecord）：跟随 mission 表格首次 request 的同一响应填充
  const [detail, setDetail] = useState<OrderRecordDto | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  // 任务不存在：后端对未知编号仍返回 code=200 且 data=null（2026-09-18 带令牌实证），
  // 主体缺失时呈现明确反馈，与「查询失败」「真实空 mission 列表」分开（专项验收）
  const [detailNotFound, setDetailNotFound] = useState(false)

  /**
   * mission 分页请求：同一响应同时喂主体 Descriptions 与表格（不重复请求）。
   * request 模式的错误呈现由 Apex 内建（错误 + 重试）；真实失败在这里同步
   * 主体区域错误态后再抛出（主动取消静默：不写错误、交给 Apex 静默语义）。
   */
  const requestMissions = useCallback(
    async (params: { pageIndex: number; pageSize: number; signal: AbortSignal }) => {
      const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
      try {
        const data = await getOrderRecordDetail(
          { orderTaskKey: orderKey, pageNo, pageSize },
          { signal: params.signal },
        )
        // 任务不存在（data=null，真实实证）：主体给出明确反馈，表格呈现空结果
        if (!data || !data.orderRecord) {
          setDetail(null)
          setDetailError(null)
          setDetailNotFound(true)
          return { data: [], rowCount: 0 }
        }
        // 主体区域同源更新：清掉上次错误，记录最新订单主体
        setDetail(data.orderRecord)
        setDetailError(null)
        setDetailNotFound(false)
        return {
          data: data.missionPage.records ?? [],
          rowCount: data.missionPage.total ?? 0,
        }
      } catch (error) {
        // 主动取消（页签刷新/弹窗关闭/实例卸载）静默，不写主体错误态
        if (apiErrorMessage(error)) {
          setDetail(null)
          setDetailError(apiErrorMessage(error))
        }
        throw error
      }
    },
    [orderKey],
  )

  /** 主体描述列表：字段全集按旧实现口径（跳过 orderMissions 数组字段），空值留白 */
  const detailItems = detail
    ? [
        { key: 'orderKey', label: t('任务编号'), children: detail.orderKey ?? '' },
        { key: 'orderName', label: t('任务名称'), children: detail.orderName ?? '' },
        {
          key: 'orderType',
          label: t('任务类型'),
          children: describeOption(ORDER_TYPE_OPTIONS, detail.orderType),
        },
        {
          key: 'orderState',
          label: t('任务状态'),
          children: describeOption(ORDER_STATE_OPTIONS, detail.orderState),
        },
        { key: 'taskId', label: t('任务ID'), children: detail.taskId || '' },
        { key: 'processKey', label: t('工艺'), children: detail.processKey || '' },
        { key: 'priority', label: t('优先级'), children: detail.priority ?? '' },
        {
          key: 'appointVehicle',
          label: t('指定车辆'),
          children: detail.appointVehicleName || detail.appointVehicleKey || '',
        },
        {
          key: 'appointVehicleGroup',
          label: t('指定车辆组'),
          children: detail.appointVehicleGroupName || detail.appointVehicleGroupKey || '',
        },
        {
          key: 'executeVehicle',
          label: t('执行车辆'),
          children: detail.executeVehicleName || detail.executeVehicleKey || '',
        },
        { key: 'executeTime', label: t('开始执行时间'), children: displayDateTime(detail.executeTime) },
        { key: 'finalTime', label: t('结束执行时间'), children: displayDateTime(detail.finalTime) },
        { key: 'createTime', label: t('创建时间'), children: displayDateTime(detail.createTime) },
        { key: 'createUser', label: t('创建人'), children: detail.createUser || '' },
        { key: 'failReason', label: t('失败原因'), children: detail.failReason || '' },
        { key: 'hangReason', label: t('挂起原因'), children: detail.hangReason || '' },
        { key: 'cancelReason', label: t('取消原因'), children: detail.cancelReason || '' },
      ]
    : []

  /** mission 表格列（旧实现同口径；排序关闭：后端未声明全量排序，G09） */
  const missionColumns: ApexColumnDef<OrderMissionDto>[] = [
    {
      accessorKey: 'orderMissionKey',
      header: t('子任务标识'),
      enableSorting: false,
      size: 190,
      cell: (info) => (info.getValue() as string | null) || '',
    },
    {
      // 动作描述为派生展示列：拼接本行 actions 的描述（旧实现同口径）
      id: 'actionDescription',
      header: t('动作描述'),
      enableSorting: false,
      size: 170,
      cell: ({ row }) => {
        const descriptions = (row.original.actions ?? [])
          .map((action) => action.actionDescription)
          .filter(Boolean)
        return descriptions.length > 0 ? descriptions.join(',') : ''
      },
    },
    {
      accessorKey: 'mapName',
      header: t('地图名称'),
      enableSorting: false,
      size: 120,
      cell: (info) => (info.getValue() as string | null) || '',
    },
    {
      accessorKey: 'stationName',
      header: t('站点名称'),
      enableSorting: false,
      size: 120,
      cell: (info) => (info.getValue() as string | null) || '',
    },
    {
      accessorKey: 'missionState',
      header: t('任务状态'),
      enableSorting: false,
      size: 100,
      cell: (info) => {
        // 子任务状态：已映射枚举用本地化文案，未知值原样展示（不映射为正常）
        const value = info.getValue() as string | null
        const label = describeOption(MISSION_STATE_OPTIONS, value)
        return <Tag color="processing">{label}</Tag>
      },
    },
    {
      accessorKey: 'executeTime',
      header: t('开始时间'),
      enableSorting: false,
      size: 150,
      cell: (info) => displayDateTime(info.getValue() as string | null),
    },
    {
      accessorKey: 'finalTime',
      header: t('结束时间'),
      enableSorting: false,
      size: 150,
      cell: (info) => displayDateTime(info.getValue() as string | null),
    },
  ]

  return (
    <>
      {/* 任务不存在：明确反馈（与查询失败、真实空 mission 列表分开呈现） */}
      {detailNotFound ? (
        <StateBlock variant="gap" description={t('orderInfo:任务不存在或已被删除')} />
      ) : null}
      {/* 主体区域：失败时呈现真实错误（与表格同源），无数据时不出空表壳 */}
      {detailError ? (
        <p className={styles.error}>
          {t('查询订单详情出错') + detailError}
        </p>
      ) : null}
      {detail ? (
        <Descriptions size="small" bordered column={descriptionsColumn} items={detailItems} />
      ) : null}
      <div
        className={styles.missionTable}
        /* 'fill' = 弹性撑满父列容器剩余空间（配合父级 flex column + min-height:0）；
           数字 = 固定像素（弹窗形态），两种模式都把内部滚动交给 Apex viewport */
        style={missionTableHeight === 'fill' ? { flex: 1 } : { height: missionTableHeight }}
      >
        <ApexTableReact
          columns={missionColumns}
          request={requestMissions}
          getRowId={stringFieldRowId('orderMissionKey')}
          locale={apexLocale}
          pagination={{ pageSizeOptions: [10, 20, 50, 100] }}
          height="100%"
          expandable={{
            expandedRowRender: (record) => <MissionActionsTable data={record.actions ?? []} />,
            rowExpandable: (record) => (record.actions ?? []).length > 0,
          }}
        />
      </div>
    </>
  )
}
