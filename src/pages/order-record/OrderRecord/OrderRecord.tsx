/**
 * 任务管理页：查询条件（关键字/类型/状态/执行车辆/创建时间）+ 分页列表。
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button, DatePicker, Input, Select, Space, Table, Tag, type TablePaginationConfig } from 'antd'
import type { Dayjs } from 'dayjs'
import { RotateCcw, RefreshCw, Search } from 'lucide-react'
import { useOrderList } from '@/features/order-record/hooks/useOrderList'
import { DEFAULT_PAGE_SIZE } from '@/services/request/request.constants'
import { ROUTE_PATHS } from '@/router/definitions'
import type { OrderEntity, OrderState, OrderType } from '@/types/order-record/order.types'

/** 任务类型 → 标签文案 / 颜色 */
const ORDER_TYPE_META: Record<OrderType, { label: string; color: string }> = {
  WORK: { label: '工作', color: 'geekblue' },
  PARK: { label: '回桩', color: 'purple' },
}

/** 任务状态 → 标签文案 / 颜色 */
const ORDER_STATE_META: Record<OrderState, { label: string; color: string }> = {
  IN_QUEUE: { label: '排队中', color: 'gold' },
  PROCESSING: { label: '执行中', color: 'blue' },
  COMPLETED: { label: '已完成', color: 'green' },
  CANCELLED: { label: '已取消', color: 'default' },
  FAILED: { label: '失败', color: 'red' },
  HANG: { label: '已挂起', color: 'orange' },
}

/** 筛选草稿：点「查询」才提交进列表查询，避免每敲一个字就触发请求 */
interface OrderFilterDraft {
  keyword?: string
  orderType?: OrderType
  orderState?: OrderState
  executeVehicleName?: string
  createdRange?: [Dayjs | null, Dayjs | null] | null
}

const EMPTY_DRAFT: OrderFilterDraft = {}

export default function OrderRecord() {
  const { t } = useTranslation('orderRecord')
  const { t: tCommon } = useTranslation('common')
  const navigate = useNavigate()
  const { items, total, loading, error, query, setQuery, reload } = useOrderList()
  const [draft, setDraft] = useState<OrderFilterDraft>(EMPTY_DRAFT)

  const patchDraft = (patch: Partial<OrderFilterDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const applyFilters = (next: OrderFilterDraft) => {
    setQuery({
      keyword: next.keyword?.trim() || undefined,
      orderType: next.orderType,
      orderState: next.orderState,
      executeVehicleName: next.executeVehicleName?.trim() || undefined,
      createdStart: next.createdRange?.[0]?.format('YYYY-MM-DD 00:00:00'),
      createdEnd: next.createdRange?.[1]?.format('YYYY-MM-DD 23:59:59'),
      page: 1,
    })
  }

  const resetFilters = () => {
    setDraft(EMPTY_DRAFT)
    applyFilters(EMPTY_DRAFT)
  }

  const columns = [
    { title: t('任务名称'), dataIndex: 'orderName', width: 230, ellipsis: true },
    { title: t('任务 Key'), dataIndex: 'orderKey', width: 200, ellipsis: true },
    {
      title: t('任务类型'),
      dataIndex: 'orderType',
      width: 90,
      render: (value: OrderType) => {
        const meta = ORDER_TYPE_META[value]
        return <Tag color={meta?.color}>{meta?.label ?? value}</Tag>
      },
    },
    { title: t('工艺'), dataIndex: 'processKey', width: 200, ellipsis: true, render: (value: string | null) => value ?? '—' },
    {
      title: t('执行车辆'),
      dataIndex: 'executeVehicleName',
      width: 220,
      ellipsis: true,
      render: (value: string | null) => value ?? '—',
    },
    {
      title: t('状态'),
      dataIndex: 'orderState',
      width: 90,
      render: (value: OrderState) => {
        const meta = ORDER_STATE_META[value]
        return <Tag color={meta?.color}>{meta?.label ?? value}</Tag>
      },
    },
    { title: t('优先级'), dataIndex: 'priority', width: 70 },
    { title: t('执行时间'), dataIndex: 'executeTime', width: 160, render: (value: string | null) => value ?? '—' },
    { title: t('完成时间'), dataIndex: 'finalTime', width: 160, render: (value: string | null) => value ?? '—' },
    { title: t('创建时间'), dataIndex: 'createTime', width: 160 },
    { title: t('创建人'), dataIndex: 'createUser', width: 90, ellipsis: true },
    {
      title: t('操作'),
      key: 'actions',
      width: 70,
      fixed: 'right' as const,
      render: (_: unknown, record: OrderEntity) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(ROUTE_PATHS['order-info'], { state: { orderKey: record.orderKey } })}
        >
          {t('详情')}
        </Button>
      ),
    },
  ]

  const pagination: TablePaginationConfig = {
    current: query.page,
    pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
    total,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (count) => t('共 {{total}} 条', { total: count }),
    onChange: (page, pageSize) => setQuery({ page, pageSize }),
  }

  return (
    <div>
      {/* 页面标题由页签承载，顶部只保留工具栏：筛选居左、刷新居右 */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Space size={8} wrap>
          <Input
            allowClear
            placeholder={t('任务名称 / Key')}
            style={{ width: 200 }}
            value={draft.keyword}
            onChange={(event) => patchDraft({ keyword: event.target.value })}
            onPressEnter={() => applyFilters(draft)}
          />
          <Select<OrderType>
            allowClear
            placeholder={t('任务类型')}
            style={{ width: 120 }}
            value={draft.orderType}
            onChange={(orderType) => patchDraft({ orderType })}
            options={(Object.keys(ORDER_TYPE_META) as OrderType[]).map((value) => ({
              value,
              label: t(ORDER_TYPE_META[value].label),
            }))}
          />
          <Select<OrderState>
            allowClear
            placeholder={t('任务状态')}
            style={{ width: 120 }}
            value={draft.orderState}
            onChange={(orderState) => patchDraft({ orderState })}
            options={(Object.keys(ORDER_STATE_META) as OrderState[]).map((value) => ({
              value,
              label: t(ORDER_STATE_META[value].label),
            }))}
          />
          <Input
            allowClear
            placeholder={t('执行车辆')}
            style={{ width: 180 }}
            value={draft.executeVehicleName}
            onChange={(event) => patchDraft({ executeVehicleName: event.target.value })}
            onPressEnter={() => applyFilters(draft)}
          />
          <DatePicker.RangePicker
            style={{ width: 250 }}
            value={draft.createdRange ?? null}
            onChange={(dates) => patchDraft({ createdRange: dates })}
          />
          <Button type="primary" icon={<Search size={14} />} onClick={() => applyFilters(draft)}>
            {t('查询')}
          </Button>
          <Button icon={<RotateCcw size={14} />} onClick={resetFilters}>
            {t('重置')}
          </Button>
        </Space>
        <Button icon={<RefreshCw size={14} />} onClick={reload}>
          {t('刷新')}
        </Button>
      </div>
      {error ? (
        <div style={{ marginBottom: 12 }}>
          <Button danger size="small" onClick={reload}>
            {tCommon('加载失败，点击重试')}
          </Button>
        </div>
      ) : null}
      <Table<OrderEntity>
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={pagination}
        scroll={{ x: 1820 }}
      />
    </div>
  )
}
