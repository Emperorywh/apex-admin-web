/**
 * 任务详情快速预览弹窗（P03）。
 *
 * 旧实现：OrderInfoModal（antd Descriptions 主体 + antd Table mission 分页 +
 * ExpandedActions 动作展开）。P03 按旧可达交互保留「列表行详情=弹窗快速预览」；
 * /order-info 完整详情页归 P38（当前迁移过渡占位），两者不互相替代。
 *
 * 数据与契约：
 * - 单次请求喂两个区域（ getOrderRecordDetail：主体 + mission 分页），
 *   避免同参重复请求；主体跟随同一响应填充，失败时两区域同源呈现真实错误；
 * - mission 表格为 Apex request 模式：服务端分页（missionPage.records/total）、
 *   行 ID=orderMissionKey、不启用排序（G09：后端未声明全量排序）；
 * - 每行展开动作子表复用 MissionActionsTable（data 模式完整小集合）；
 * - 弹窗每次打开从第一页开始（旧实现同语义），关闭清空主体数据。
 */

import { useCallback, useState } from 'react'
import { Descriptions, Modal, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
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
  OrderRecordDetailDto,
  OrderRecordDto,
} from '@/services/order-record/order.service.types'
import { MISSION_STATE_OPTIONS, ORDER_STATE_OPTIONS, ORDER_TYPE_OPTIONS } from './orderRecordOptions'
import { MissionActionsTable } from './MissionActionsTable'

/** 主键/枚举展示辅助：缺失留白；未知枚举显示原值（不猜语义） */
function describeOption(options: { value: string; label: string }[], value?: string | null): string {
  if (!value) return ''
  const found = options.find((item) => item.value === value)
  return found ? found.label : value
}

interface OrderInfoModalProps {
  open: boolean
  /** 目标订单 key（getOrderRecordDetail.orderTaskKey） */
  orderKey: string
  onClose: () => void
}

export function OrderInfoModal({ open, orderKey, onClose }: OrderInfoModalProps) {
  const { t } = useTranslation('orderRecord')
  const apexLocale = useApexLocale()

  // 详情主体（orderRecord）：跟随 mission 表格首次 request 的同一响应填充
  const [detail, setDetail] = useState<OrderRecordDto | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  /**
   * mission 分页请求：同一响应同时喂主体 Descriptions 与表格（不重复请求）。
   * request 模式的错误呈现由 Apex 内建（错误 + 重试）；真实失败在这里同步
   * 主体区域错误态后再抛出（主动取消静默：不写错误、交给 Apex 静默语义）。
   */
  const requestMissions = useCallback(
    async (params: { pageIndex: number; pageSize: number; signal: AbortSignal }) => {
      const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
      try {
        const data: OrderRecordDetailDto = await getOrderRecordDetail(
          { orderTaskKey: orderKey, pageNo, pageSize },
          { signal: params.signal },
        )
        // 主体区域同源更新：清掉上次错误，记录最新订单主体
        setDetail(data.orderRecord)
        setDetailError(null)
        return {
          data: data.missionPage.records ?? [],
          rowCount: data.missionPage.total ?? 0,
        }
      } catch (error) {
        // 主动取消（弹窗关闭/页签刷新）静默，不写主体错误态
        if (apiErrorMessage(error)) {
          setDetail(null)
          setDetailError(apiErrorMessage(error))
        }
        throw error
      }
    },
    [orderKey],
  )

  /** 关闭时清空主体，避免残留上一个任务的详情（DoD 8 草稿/数据边界） */
  const handleAfterClose = useCallback(() => {
    setDetail(null)
    setDetailError(null)
  }, [])

  /** 主体描述列表：字段全集按旧实现口径（跳过 orderMissions 数组字段） */
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
        // 子任务状态：已映射枚举用本地化文案+颜色，未知值原样展示（不映射为正常）
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
    <Modal
      title={t('订单详情')}
      open={open}
      onCancel={onClose}
      afterClose={handleAfterClose}
      footer={null}
      width={1400}
      destroyOnHidden
    >
      {/* 主体区域：失败时呈现真实错误（与表格同源），无数据时不出空表壳 */}
      {detailError ? (
        <p style={{ color: 'var(--app-error, #ff4d4f)', margin: '8px 0' }}>
          {t('查询订单详情出错') + detailError}
        </p>
      ) : null}
      {detail ? (
        <Descriptions
          size="small"
          bordered
          column={2}
          items={detailItems.map((item) => ({ ...item, label: item.label }))}
        />
      ) : null}
      <div style={{ marginTop: 16 }}>
        <ApexTableReact
          columns={missionColumns}
          request={requestMissions}
          getRowId={stringFieldRowId('orderMissionKey')}
          locale={apexLocale}
          pagination={{ pageSizeOptions: [10, 20, 50, 100] }}
          height={360}
          expandable={{
            expandedRowRender: (record) => <MissionActionsTable data={record.actions ?? []} />,
            rowExpandable: (record) => (record.actions ?? []).length > 0,
          }}
        />
      </div>
    </Modal>
  )
}
