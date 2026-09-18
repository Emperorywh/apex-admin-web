/**
 * 车辆域枚举展示元数据（共享常量，P39 提升自 features/vehicle-list/vehicleListOptions）。
 *
 * 为什么放在 constants：车辆列表（P05）与车辆详情（P39）分属两个 feature 业务域，
 * 结构检查禁止 features 之间互相导入；枚举映射是协议原值 → 展示文案的单一真相源，
 * 提升到共享常量层供两个业务域共同消费，避免两份定义漂移
 * （同构先例：P38 把任务域枚举提升到 constants/order/orderDisplayOptions）。
 *
 * 纪律（与提升前一致）：
 * - 仅收录有既定语义的映射，未知值显示协议原值（规格 11.2/18.3）；
 * - label 是简体中文文案 key，i18next 运行时翻译（中文 key 即文案）；
 * - 提升后 features/vehicle-list/vehicleListOptions 保留同名 re-export，
 *   既有消费者（P05 三处）导入路径不变。
 */

/**
 * 车辆类型文案 key：1=叉车、2=小车（旧系统 agvTypes 常量既定取值域），
 * 未知值显示原值。
 */
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

/** 安全状态（estop）文案 key：旧系统 eStops 既定语义 */
export const ESTOP_LABEL: Record<string, string> = {
  AUTOACK: '避障',
  MANUAL: '抱闸',
  REMOTE: '急停',
  NONE: '正常',
}

/**
 * 展示层格式化：数值分量保留三位小数（旧实现 toFixed(3) 同精度）；
 * 缺失/非有效数值留白（空值展示纪律：不用「--」占位）。
 */
export function formatComponent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return value.toFixed(3)
}
