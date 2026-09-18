/**
 * 车辆列表枚举映射（P05）：仅收录有既定语义的映射，未知值显示协议原值
 * （规格 11.2/18.3）。映射语义来源：
 * - vehicleType 1/2：旧系统 agvTypes 常量既定取值域（1=叉车、2=小车）；
 * - connectionState / dispatchState / operatingMode / estop：OpenAPI 枚举注释
 *   与旧系统 eStops 常量的既定中文文案（真译沿用）。
 *
 * P39 起枚举映射与 formatComponent 提升至共享常量层
 * `@/constants/vehicle/vehicleDisplayOptions`（车辆列表/详情两 feature 域共同
 * 消费的单一真相源），本文件保留同名 re-export——既有消费者导入路径不变。
 * 运行模式/控制指令菜单与表单转换仍为本页（vehicle-list 域）私有。
 */

import type { VehicleRecordDto } from '@/services/vehicle/vehicle-manage.service.types'

// 共享枚举映射与展示格式化（单一真相在 constants，此处转出维持既有导入路径）
export {
  VEHICLE_TYPE_LABEL,
  CONNECTION_STATE_LABEL,
  CONNECTION_STATE_TAG_COLOR,
  DISPATCH_STATE_LABEL,
  ESTOP_LABEL,
  formatComponent,
} from '@/constants/vehicle/vehicleDisplayOptions'

/** 运行模式文案 key（OpenAPI 五值枚举；未知值显示原值） */
export const OPERATING_MODE_LABEL: Record<string, string> = {
  AUTOMATIC: '自动',
  SEMIAUTOMATIC: '半自动',
  MANUAL: '手动',
  SERVICE: '维护',
  TEACHIN: '示教',
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
