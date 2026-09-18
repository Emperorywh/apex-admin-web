/**
 * 车辆列表枚举映射（P05）：仅收录有既定语义的映射，未知值显示协议原值
 * （规格 11.2/18.3）。映射语义来源：
 * - vehicleType 1/2：旧系统 agvTypes 常量既定取值域（1=叉车、2=小车）；
 * - connectionState / dispatchState / operatingMode / estop：OpenAPI 枚举注释
 *   与旧系统 eStops 常量的既定中文文案（真译沿用）。
 */

import type { VehicleRecordDto } from '@/services/vehicle/vehicle-manage.service.types'

/** 车辆类型文案 key：1=叉车、2=小车（既定取值域），未知值显示原值 */
export const VEHICLE_TYPE_LABEL: Record<number, string> = {
  1: '叉车',
  2: '小车',
}

/** 网络状态文案 key（OpenAPI 三值枚举均有既定文案） */
export const CONNECTION_STATE_LABEL: Record<string, string> = {
  ONLINE: '在线',
  OFFLINE: '离线',
  CONNECTIONBROKEN: '连接中断',
}

/** 网络状态 → Tag 颜色：在线绿、离线红、连接中断橙（与旧实现同色系） */
export const CONNECTION_STATE_TAG_COLOR: Record<string, string> = {
  ONLINE: '#87D068',
  OFFLINE: '#D50000',
  CONNECTIONBROKEN: 'orange',
}

/** 调度状态文案 key */
export const DISPATCH_STATE_LABEL: Record<string, string> = {
  ENABLE: '启用',
  DISABLE: '禁用',
}

/** 运行模式文案 key（OpenAPI 五值枚举；未知值显示原值） */
export const OPERATING_MODE_LABEL: Record<string, string> = {
  AUTOMATIC: '自动',
  SEMIAUTOMATIC: '半自动',
  MANUAL: '手动',
  SERVICE: '维护',
  TEACHIN: '示教',
}

/** 安全状态（estop）文案 key：旧系统 eStops 既定语义 */
export const ESTOP_LABEL: Record<string, string> = {
  AUTOACK: '避障',
  MANUAL: '抱闸',
  REMOTE: '急停',
  NONE: '正常',
}

/** 单车指令菜单（旧页面实际可达仅暂停/继续，等价迁移） */
export const VEHICLE_OPERATE_ITEMS: { key: 'PAUSE' | 'CONTINUE'; label: string }[] = [
  { key: 'PAUSE', label: '暂停' },
  { key: 'CONTINUE', label: '继续' },
]

/** 批量指令菜单（旧页面可达四项；未勾选时作用于全部车辆） */
export const VEHICLE_BATCH_OPERATE_ITEMS: {
  key: 'PAUSE' | 'CONTINUE' | 'ENABLED' | 'DISABLED'
  label: string
}[] = [
  { key: 'PAUSE', label: '一键暂停' },
  { key: 'CONTINUE', label: '一键继续' },
  { key: 'ENABLED', label: '一键启用' },
  { key: 'DISABLED', label: '一键禁用' },
]

/** 指令 → 影响说明文案 key（确认框用，列明动作含义） */
export const OPERATE_IMPACT_KEY: Record<string, string> = {
  PAUSE: '指令影响：目标车辆将暂停执行当前任务',
  CONTINUE: '指令影响：目标车辆将恢复执行被暂停的任务',
  ENABLED: '指令影响：目标车辆将重新纳入调度（启用）',
  DISABLED: '指令影响：目标车辆将退出调度分配（禁用）',
}

/**
 * 展示层格式化：数值分量保留三位小数（旧实现 toFixed(3) 同精度）；
 * 缺失/非有效数值留白（空值展示纪律：不用「--」占位）。
 */
export function formatComponent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return value.toFixed(3)
}

/** 从行记录读取编辑表单参数（agvKey 固定行 key，尺寸缺失按 0 提交由后端校验兜底） */
export function toFormParam(record: VehicleRecordDto): {
  agvKey: string
  agvName: string
  agvType?: number
  length: number
  width: number
  loadLength: number
  loadWidth: number
  centerOffset: number
  dispatchState: 'ENABLE' | 'DISABLE'
} {
  const d = record.agvDimension ?? {}
  return {
    agvKey: record.key ?? '',
    agvName: record.name ?? '',
    agvType: record.vehicleType ?? undefined,
    length: d.length ?? 0,
    width: d.width ?? 0,
    loadLength: d.loadLength ?? 0,
    loadWidth: d.loadWidth ?? 0,
    centerOffset: d.centerOffset ?? 0,
    dispatchState: record.dispatchState === 'DISABLE' ? 'DISABLE' : 'ENABLE',
  }
}
