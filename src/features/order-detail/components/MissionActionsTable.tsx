/**
 * 子任务动作展开子表（P03 详情弹窗引入，P38 迁入任务详情业务域 features/order-detail）。
 *
 * 旧实现 ExpandedActions 用 antd Table 展示 mission 内动作集合（完整小集合、
 * 无分页）；按 DoD 4 全表替换纪律改为 ApexTableReact data 模式——
 * data 模式仅承载真实接口返回的完整小集合（规格 6.2），不是 mock。
 * 完整详情页（/order-info）与列表快速预览弹窗共用本组件。
 *
 * 展示与空值纪律：
 * - 执行结果/条件/时间可能为空：缺失留白，不猜语义；
 * - 耗时仅起止齐备时计算，缺失留白（缺失≠0，不补零）；
 * - 动作状态映射为本地化文案，未知枚举显示原值（规格 18.3）；
 * - 动作参数为 JSON 集合：悬浮 Popover 展示格式化原文并提供复制。
 */

import { Typography, Tooltip as AntTooltip, Popover } from 'antd'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { ApexTableReact } from 'apex-table-react'
import type { ApexColumnDef } from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { stringFieldRowId } from '@/utils/table/rowId'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import type { OrderActionDto } from '@/services/order-record/order.service.types'
import { ACTION_STATUS_OPTIONS } from '@/constants/order/orderDisplayOptions'

/** 动作状态 → 展示文案（协议枚举原值提交/留存，仅展示层翻译） */
function actionStatusText(value: OrderActionDto['actionStatus']): string {
  if (!value) return ''
  const found = ACTION_STATUS_OPTIONS.find((item) => item.value === value)
  return found ? found.label : value
}

/** 起止齐备时计算 HH:mm:ss 耗时，缺失留白（缺失≠0，不补零） */
function actionDuration(startTime?: string | null, finalTime?: string | null): string {
  if (!startTime || !finalTime) return ''
  const diff = dayjs(finalTime).diff(dayjs(startTime), 'second')
  if (!Number.isFinite(diff) || diff < 0) return ''
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

interface MissionActionsTableProps {
  /** 当前 mission 的动作集合（真实接口返回的完整小集合） */
  data: OrderActionDto[]
}

export function MissionActionsTable({ data }: MissionActionsTableProps) {
  const { t } = useTranslation('orderRecord')
  const apexLocale = useApexLocale()

  const columns: ApexColumnDef<OrderActionDto>[] = [
    {
      accessorKey: 'actionId',
      header: 'ID',
      enableSorting: false,
      size: 110,
      cell: (info) => {
        // 动作 id 是后端原值：支持复制便于排查（长文本省略展示）
        const value = info.getValue() as string | null
        return (
          <Typography.Text copyable={!!value} ellipsis style={{ maxWidth: 100 }}>
            {value || ''}
          </Typography.Text>
        )
      },
    },
    {
      accessorKey: 'actionType',
      header: t('动作类型'),
      enableSorting: false,
      size: 110,
      cell: (info) => (info.getValue() as string | null) || '',
    },
    {
      accessorKey: 'actionDescription',
      header: t('动作描述'),
      enableSorting: false,
      size: 150,
      cell: (info) => (info.getValue() as string | null) || '',
    },
    {
      accessorKey: 'blockingType',
      header: t('阻塞类型'),
      enableSorting: false,
      size: 90,
      cell: (info) => (info.getValue() as string | null) || '',
    },
    {
      accessorKey: 'actionStatus',
      header: t('动作状态'),
      enableSorting: false,
      size: 100,
      cell: (info) => actionStatusText(info.getValue() as OrderActionDto['actionStatus']),
    },
    {
      accessorKey: 'resultDescription',
      header: t('执行结果'),
      enableSorting: false,
      size: 170,
      cell: (info) => {
        const value = info.getValue() as string | null
        if (!value) return ''
        return (
          <AntTooltip title={value}>
            <Typography.Text ellipsis style={{ maxWidth: 160 }}>
              {value}
            </Typography.Text>
          </AntTooltip>
        )
      },
    },
    {
      accessorKey: 'startTime',
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
    {
      // 耗时列：纯展示派生值（不参与排序/筛选），缺失留白
      id: 'duration',
      header: t('耗时'),
      enableSorting: false,
      size: 100,
      cell: ({ row }) => actionDuration(row.original.startTime, row.original.finalTime),
    },
    {
      accessorKey: 'conditionStr',
      header: t('条件标识'),
      enableSorting: false,
      size: 130,
      cell: (info) => (info.getValue() as string | null) || '',
    },
    {
      accessorKey: 'actionParameters',
      header: t('动作参数'),
      enableSorting: false,
      size: 260,
      cell: (info) => {
        const value = info.getValue() as OrderActionDto['actionParameters']
        if (!value || value.length === 0) return ''
        const pretty = JSON.stringify(value, null, 2)
        return (
          <Popover
            title={
              <Typography.Text copyable={{ text: pretty }} style={{ color: '#fff' }}>
                {t('配置内容')}
              </Typography.Text>
            }
            content={
              <div style={{ height: '40vh', width: '30vw', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {pretty}
              </div>
            }
          >
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {JSON.stringify(value)}
            </div>
          </Popover>
        )
      },
    },
  ]

  return (
    <ApexTableReact
      columns={columns}
      data={data}
      getRowId={stringFieldRowId('actionId')}
      locale={apexLocale}
      pagination={false}
      virtualization={false}
      height={260}
      columnSettingsEnabled={false}
    />
  )
}
