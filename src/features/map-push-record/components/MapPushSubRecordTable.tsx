/**
 * 推送子记录展开行子表（P12）。
 *
 * 旧实现（C:\code\dd\src\pages\MapThrough\MapPushNotificationRecords）：
 * 一个推送批次 = 主表一行，其下多台车辆子记录全量随主行下发，展开行内
 * 按车辆名称关键字 + 推送状态做纯前端筛选、纯前端分页（接口无子级查询/
 * 分页参数）；子记录行内有「重推」「取消推送」两个操作。
 * 本重写保持同一业务形态，基座按样板升级：
 * - 子表迁移为 ApexTableReact data 模式（真实完整小集合，禁 antd Table）；
 *   分页改用表格受控分页（TanStack PaginationState，0 基 pageIndex），
 *   筛选条件变化回第一页，数据刷新变少时页码兜底回退最后一页（旧实现同语义）；
 * - 单元格空值一律留白（旧实现的「-」占位按全局空值纪律废弃）；
 * - 失败/等待原因长文案保持旧版截断 + Tooltip 悬浮看全文；
 * - 操作按钮只负责渲染与回调（确认框、防连点、请求均由宿主页统一处理，
 *   页面层以 pendingSubKey 标识在途子记录行）。
 */

import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Select, Space, Tag, Tooltip } from 'antd'
import { Search as SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApexTableReact } from 'apex-table-react'
import type { ApexColumnDef, PaginationState } from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import type {
  MapPushState,
  MapPushSubRecordDto,
} from '@/services/map-push-record/map-push-record.service.types'
import { isSubRecordCancellable } from '@/features/map-push-record/utils/pushState'
import styles from './MapPushSubRecordTable.module.css'

/** 推送状态 → antd Tag 语义色（成功绿/失败红/进行中蓝/等待橙/已取消灰，旧实现同映射） */
const STATE_COLOR: Record<MapPushState, string> = {
  WAITING: 'orange',
  RUNNING: 'processing',
  FAILED: 'error',
  SUCCEEDED: 'success',
  CANCELLED: 'default',
}

/** 状态枚举全集（下拉选项与文案 key 的遍历顺序，旧实现同序） */
const ALL_STATES: MapPushState[] = ['WAITING', 'RUNNING', 'FAILED', 'SUCCEEDED', 'CANCELLED']

/** 状态 → 界面文案 key（中文 key 即文案，五语言分片按同 key 提供） */
const STATE_LABEL_KEY: Record<MapPushState, string> = {
  WAITING: '等待',
  RUNNING: '推送中',
  FAILED: '失败',
  SUCCEEDED: '成功',
  CANCELLED: '已取消',
}

export interface MapPushSubRecordTableProps {
  /** 该推送批次下的全部子记录（筛选与分页的完整数据源） */
  subs: MapPushSubRecordDto[]
  /** 操作按钮权限（重新推送与取消推送共用同一按钮码，旧实现同边界） */
  canOperate: boolean
  /** 在途操作的子记录行 ID（页面统一防连点；该行按钮进入禁用态） */
  pendingSubKey: string | null
  /** 子记录级重推回调（确认与请求由宿主页处理） */
  onRePush: (sub: MapPushSubRecordDto) => void
  /** 子记录级取消推送回调（确认与请求由宿主页处理） */
  onCancelPush: (sub: MapPushSubRecordDto) => void
}

export default function MapPushSubRecordTable({
  subs,
  canOperate,
  pendingSubKey,
  onRePush,
  onCancelPush,
}: MapPushSubRecordTableProps) {
  const { t } = useTranslation('mapPushRecord')
  const apexLocale = useApexLocale()

  // 纯前端筛选条件：车辆名称关键字（包含匹配，忽略首尾空格）+ 推送状态精确匹配
  const [keyword, setKeyword] = useState('')
  const [stateFilter, setStateFilter] = useState<MapPushState | undefined>(undefined)

  // 受控分页（TanStack 0 基 pageIndex）：筛选变化回第一页由本组件自管
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const filtered = useMemo(() => {
    const kw = keyword.trim()
    return subs.filter((sub) => {
      if (kw && !(sub.vehicleName ?? '').includes(kw)) return false
      if (stateFilter && sub.mapPushState !== stateFilter) return false
      return true
    })
  }, [subs, keyword, stateFilter])

  // 筛选条件变化时重置回第一页，避免停留在越界页码上看到空表（旧实现同语义）
  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
  }, [keyword, stateFilter])

  // 页码兜底：轮询/重推后子记录变少时回退最后一页，保证当前页始终有数据（旧实现同语义）
  const maxPageIndex = Math.max(0, Math.ceil(filtered.length / pagination.pageSize) - 1)
  useEffect(() => {
    setPagination((prev) =>
      prev.pageIndex <= maxPageIndex ? prev : { ...prev, pageIndex: maxPageIndex },
    )
  }, [maxPageIndex])

  /**
   * 子表列定义：与旧版逐列核对（车辆名称 250/推送状态 100/完成时间 170/
   * 失败原因/等待原因/操作 200）；空值留白，时间统一秒级 displayDateTime。
   */
  const columns = useMemo<ApexColumnDef<MapPushSubRecordDto>[]>(
    () => [
      {
        accessorKey: 'vehicleName',
        header: t('车辆名称'),
        enableSorting: false,
        size: 250,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        accessorKey: 'mapPushState',
        header: t('推送状态'),
        enableSorting: false,
        size: 110,
        cell: (info) => {
          const state = info.getValue() as MapPushState | undefined
          // 未知枚举显示协议原值（不猜语义）；缺失留白（全局空值纪律）
          if (!state) return null
          const label = STATE_LABEL_KEY[state]
          return <Tag color={STATE_COLOR[state]}>{label ? t(label) : state}</Tag>
        },
      },
      {
        accessorKey: 'finishTime',
        header: t('完成时间'),
        enableSorting: false,
        size: 170,
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
      {
        accessorKey: 'failReason',
        header: t('失败原因'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue() as string | null | undefined
          if (text === null || text === undefined || text === '') return null
          // 长文案截断 + 悬浮看全文（旧实现 ellipsis showTitle:false + Tooltip 同形态）
          return (
            <Tooltip title={text}>
              <span className={styles.reasonCell}>{text}</span>
            </Tooltip>
          )
        },
      },
      {
        accessorKey: 'waitReason',
        header: t('等待原因'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue() as string | null | undefined
          if (text === null || text === undefined || text === '') return null
          return (
            <Tooltip title={text}>
              <span className={styles.reasonCell}>{text}</span>
            </Tooltip>
          )
        },
      },
      {
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 200,
        cell: ({ row }) => {
          const sub = row.original
          const rowId = String(sub.id ?? '')
          const pending = pendingSubKey !== null && pendingSubKey === rowId
          if (!canOperate) return null
          return (
            <Space size={0}>
              {/* 重推：行级防连点（在途禁用） */}
              <Button
                type="link"
                size="small"
                disabled={pending}
                onClick={() => onRePush(sub)}
              >
                {t('重推')}
              </Button>
              {/* 仅等待/推送中的子记录可取消，已结束的推送不展示取消入口（旧实现同边界） */}
              {isSubRecordCancellable(sub.mapPushState) ? (
                <Button
                  type="link"
                  size="small"
                  danger
                  disabled={pending}
                  onClick={() => onCancelPush(sub)}
                >
                  {t('取消推送')}
                </Button>
              ) : null}
            </Space>
          )
        },
      },
    ],
    [t, canOperate, pendingSubKey, onRePush, onCancelPush],
  )

  // 推送状态下拉选项：label 为中文 key，经 t() 跟随界面语言
  const stateOptions = ALL_STATES.map((state) => ({
    value: state,
    label: t(STATE_LABEL_KEY[state]),
  }))

  return (
    <div className={styles.subTableWrap}>
      {/* 条件查询区：车辆名称关键字 + 推送状态，即时前端筛选（旧实现同布局） */}
      <div className={styles.subFilterBar}>
        <Input
          className={styles.keywordInput}
          allowClear
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('请输入车辆名称')}
          prefix={<SearchIcon size={14} />}
        />
        <Select
          className={styles.stateSelect}
          allowClear
          value={stateFilter}
          onChange={(value) => setStateFilter(value)}
          placeholder={t('请选择推送状态')}
          options={stateOptions}
        />
      </div>
      {/* 子表：真实完整小集合走 Apex data 模式；受控分页；关闭排序与列设置
          （子表为行内只读明细，无列偏好隔离需求，与 P11 展开行子表同形态）；
          固定高度让长批次在子表视口内滚动，不撑破主表展开区 */}
      <ApexTableReact
        columns={columns}
        data={filtered}
        getRowId={(row) => String(row.id ?? '')}
        locale={apexLocale}
        density="compact"
        virtualization={false}
        columnSettingsEnabled={false}
        height={420}
        state={{ pagination }}
        onPaginationChange={setPagination}
        pagination={{ pageSizeOptions: [10, 20, 50] }}
      />
    </div>
  )
}
