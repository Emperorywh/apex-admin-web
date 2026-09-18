/**
 * 车辆详情抽屉（P05）：列表「详情」入口的快速预览（旧 VehicleDrawer 等价迁移）。
 *
 * - 字段与旧实现一致（23 项），数据取自行记录（列表已含 state，不重复请求）；
 * - 空值留白（空值展示纪律：不用「--」占位）；数值分量保留三位小数；
 * - 枚举有既定语义才映射（类型/网络/调度/运行模式/安全状态），未知值显示原值；
 * - nodeStates/edgeStates/actionStates/errors 为协议结构数据：非空时按 JSON
 *   原文展示（协议原值，不猜字段语义），空数组/缺失留白。
 */

import { Drawer, Descriptions } from 'antd'
import { useTranslation } from 'react-i18next'
import type { DescriptionsProps } from 'antd'
import type { VehicleRecordDto } from '@/services/vehicle/vehicle-manage.service.types'
import {
  CONNECTION_STATE_LABEL,
  DISPATCH_STATE_LABEL,
  ESTOP_LABEL,
  OPERATING_MODE_LABEL,
  VEHICLE_TYPE_LABEL,
  formatComponent,
} from '@/features/vehicle-list/vehicleListOptions'

/** 结构数据（点/边/动作/错误）→ 展示文本：非空数组输出 JSON 原文，否则留白 */
function jsonText(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return ''
  return JSON.stringify(value)
}

/** 数值 → 展示文本：缺失留白（不补 0、不用占位符） */
function numText(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/** 枚举 → 文案 key（有映射）或协议原值（未知）；缺失留白 */
function enumLabel(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return ''
  return map[value] ?? value
}

interface VehicleDetailDrawerProps {
  open: boolean
  record: VehicleRecordDto | null
  onClose: () => void
}

export function VehicleDetailDrawer({ open, record, onClose }: VehicleDetailDrawerProps) {
  const { t } = useTranslation('vehicleList')

  // 记录未就绪（弹窗按目标挂载时不会出现）时渲染空 items，Drawer 保持关闭态
  const items: DescriptionsProps['items'] = []
  if (record) {
    const state = record.state ?? null
    const position = state?.agvPosition ?? null
    const velocity = state?.velocity ?? null
    const battery = state?.batteryState ?? null
    const hasLoad = Array.isArray(state?.loads) ? state.loads.length > 0 : false

    items.push(
      { key: 'name', label: t('名称'), children: record.name ?? '' },
      { key: 'key', label: t('唯一标识'), children: record.key ?? '' },
      {
        key: 'vehicleType',
        label: t('类型'),
        children: enumLabel(VEHICLE_TYPE_LABEL, record.vehicleType?.toString()),
      },
      {
        key: 'dispatchState',
        label: t('调度状态'),
        children: enumLabel(DISPATCH_STATE_LABEL, record.dispatchState),
      },
      { key: 'map', label: t('地图'), children: position?.mapDescription ?? '' },
      {
        key: 'localizationScore',
        label: t('定位置信度'),
        children: numText(position?.localizationScore ?? null),
      },
      {
        key: 'agvPosition',
        label: t('坐标'),
        children: position
          ? `[${formatComponent(position.x)}, ${formatComponent(position.y)}, ${formatComponent(position.theta)}]`
          : '',
      },
      {
        key: 'velocity',
        label: t('速度'),
        children: velocity
          ? `[${formatComponent(velocity.vx)}, ${formatComponent(velocity.vy)}, ${formatComponent(velocity.omega)}]`
          : '',
      },
      { key: 'loads', label: t('是否载货'), children: hasLoad ? t('是') : t('否') },
      { key: 'paused', label: t('是否暂停'), children: state?.paused ? t('是') : t('否') },
      {
        key: 'connectionState',
        label: t('网络状态'),
        children: enumLabel(CONNECTION_STATE_LABEL, record.connectionState),
      },
      { key: 'batteryCharge', label: t('剩余电量'), children: numText(battery?.batteryCharge ?? null) },
      { key: 'charging', label: t('充电中'), children: battery?.charging ? t('是') : t('否') },
      {
        key: 'safety',
        label: t('安全状态'),
        children: enumLabel(ESTOP_LABEL, state?.safetyState?.estop),
      },
      { key: 'orderId', label: t('车辆当前订单标识'), children: state?.orderId ?? '' },
      {
        key: 'orderUpdateId',
        label: t('车辆当前订单更新标识'),
        children: numText(state?.orderUpdateId ?? null),
      },
      { key: 'lastNodeId', label: t('车辆当前所在的节点'), children: state?.lastNodeId ?? '' },
      {
        key: 'lastNodeSequenceId',
        label: t('车辆最后节点序列号'),
        children: numText(state?.lastNodeSequenceId ?? null),
      },
      { key: 'nodeStates', label: t('车辆的剩余的点'), children: jsonText(state?.nodeStates) },
      { key: 'edgeStates', label: t('车辆的剩余的边'), children: jsonText(state?.edgeStates) },
      { key: 'actions', label: t('车辆的所有动作状态'), children: jsonText(state?.actionStates) },
      {
        key: 'operatingMode',
        label: t('车辆模式'),
        children: enumLabel(OPERATING_MODE_LABEL, state?.operatingMode),
      },
      { key: 'errors', label: t('错误信息'), children: jsonText(state?.errors) },
      { key: 'createTime', label: t('创建时间'), children: record.createTime ?? '' },
    )
  }

  return (
    <Drawer title={t('车辆详情')} onClose={onClose} open={open} width={600}>
      <Descriptions column={1} size="small" bordered items={items} />
    </Drawer>
  )
}
