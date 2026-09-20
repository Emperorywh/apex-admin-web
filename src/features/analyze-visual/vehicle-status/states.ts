/**
 * 车辆状态统计：状态枚举展示元数据（owner=P37；旧 AnalyzeVisual/VehicleStatus
 * model/states.ts 等价迁移，供本页图表/明细与 P35 复用）。
 *
 * 集中维护 VehicleStatisticState 的展示层元数据：
 * - 顺序与后端枚举声明一致（语义分组），堆叠柱系列、图例、明细筛选项共用，
 *   保证跨视图认知一致；
 * - 颜色为「状态语义色」固定映射：颜色跟随状态实体，不随数据排名变化；
 *   未知状态（后端新增枚举前端未跟进）回退深灰，不崩溃也不臆造语义；
 * - 展示文案 key 即中文原文（项目 i18n 纪律），组件层 t() 转换；
 *   未登记的状态码原样返回协议原值展示（便于排查，不猜语义）。
 */

import type { VehicleStatisticState } from '@/services/report-vehicle-state/report-vehicle-state.service.types'

/**
 * 状态展示顺序：与后端枚举声明顺序一致（语义分组）。
 * 堆叠柱系列、图例、明细状态筛选项共用该顺序。
 */
export const VEHICLE_STATISTIC_STATE_ORDER: VehicleStatisticState[] = [
  'ONLINE',
  'OFFLINE',
  'IDLE',
  'EXECUTING_WORK',
  'EXECUTING_CHARGE',
  'EXECUTING_PARK',
  'TRAFFIC',
  'PAUSED',
  'AVOID',
  'BRAKE',
  'WARNING',
  'ERROR',
  'CHARGING',
]

/** 状态 → 展示文案 key（中文原文，与类型定义各枚举值语义注释一一对应） */
export const STATE_LABEL_KEY: Record<VehicleStatisticState, string> = {
  ONLINE: '在线',
  OFFLINE: '离线',
  IDLE: '空闲',
  EXECUTING_WORK: '执行作业',
  EXECUTING_CHARGE: '执行充电',
  EXECUTING_PARK: '执行停靠',
  TRAFFIC: '交管等待',
  PAUSED: '暂停',
  AVOID: '避让',
  BRAKE: '制动',
  WARNING: '告警',
  ERROR: '异常',
  CHARGING: '充电中',
}

/**
 * 状态 → 固定语义色映射（旧 STATE_COLOR 等价保留）。
 * 配色说明（旧实现已经过 CVD 校验工具核对，残余告警为有意保留的状态语义）：
 * - 离线使用灰色（行业通用语义，有意保留）；
 * - 告警/暂停等使用亮黄、琥珀色（状态色规范允许警告色系偏亮，
 *   以图例文字 + Tooltip + 表格 Tag 作二级编码补偿）；
 * - 制动 / 告警 / 异常三个相邻暖色通过明暗阶梯区分（深红 / 橙 / 亮红）。
 */
export const STATE_COLOR: Record<VehicleStatisticState, string> = {
  ONLINE: '#52c41a',
  OFFLINE: '#8c8c8c',
  IDLE: '#73d13d',
  EXECUTING_WORK: '#1890ff',
  EXECUTING_CHARGE: '#faad14',
  EXECUTING_PARK: '#13c2c2',
  TRAFFIC: '#722ed1',
  PAUSED: '#ffc53d',
  AVOID: '#eb2f96',
  BRAKE: '#cf1322',
  WARNING: '#fa8c16',
  ERROR: '#f5222d',
  CHARGING: '#d48806',
}

/** 未知状态回退色（后端返回未登记的状态码时使用） */
export const UNKNOWN_STATE_COLOR = '#595959'

/** 取状态颜色：未登记的状态码回退 UNKNOWN_STATE_COLOR（不崩溃不臆造） */
export function stateColor(state: string): string {
  return STATE_COLOR[state as VehicleStatisticState] ?? UNKNOWN_STATE_COLOR
}

/** 取状态展示文案 key：未登记的状态码原样返回（展示协议原值，便于排查） */
export function stateLabelKey(state: string): string {
  return STATE_LABEL_KEY[state as VehicleStatisticState] ?? state
}
