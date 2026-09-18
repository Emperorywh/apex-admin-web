/**
 * 车辆详情展示转换（P39）：getVehicleState 响应 → Descriptions 字段列表。
 *
 * 等价迁移口径（旧 C:\code\dd src/utils/public.ts transformVehicleInfo +
 * getFixedFieldText + src/constants/orderInfo orderRefer）：
 * - 递归展平全部叶子字段（嵌套对象下钻，JSON 键序即展示序；数组不展开、
 *   按旧 default 分支 JSON 原文呈现）——契约比旧类型多出的 load 载货子对象
 *   由同一递归语义自然覆盖；
 * - 字段标签映射不到时显示原字段名（旧 `orderRefer[key] || key` 同口径，
 *   如 x/y）；i18next 缺 key 时返回 key 本身，行为一致；
 * - 枚举有既定语义才映射，未知值显示协议原值（规格 11.2/18.3）；
 *   type 的未知值显示原值（旧缺省「小车」，按未知枚举纪律改为原值，差异登记）；
 * - 布尔字段按旧 getFixedFieldText 既定语义转文案 key（fieldViolation true=异常、
 *   normal true=正常等）；
 * - createTime 毫秒时间戳 → displayDateTime（部署时区秒级墙钟；旧 dayjs.format
 *   同为秒级，缺失/不可解析留白）；
 * - 空值（null/undefined）留白：旧实现对 null 调 toString() 会崩，属防御缺陷，
 *   新实现按空值展示纪律处理（AGENTS 第 3 节）。
 *
 * 翻译边界：本模块只输出「文案 key 或字面量」标记，不做 i18n 翻译——
 * 语言切换由消费组件经 useTranslation 响应（规格 18.2.8：不在模块加载期翻译）。
 */

import type { VehicleStateRecordDto } from '@/services/vehicle/vehicle-state.service.types'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import {
  CONNECTION_STATE_LABEL,
  DISPATCH_STATE_LABEL,
  ESTOP_LABEL,
  VEHICLE_TYPE_LABEL,
} from '@/constants/vehicle/vehicleDisplayOptions'
import { ORDER_STATE_OPTIONS } from '@/constants/order/orderDisplayOptions'

/** 车辆执行状态文案 key（OpenAPI 八值枚举；旧系统 RobotStatus 枚举同口径） */
export const VEHICLE_PROC_STATUS_LABEL: Record<string, string> = {
  IDLE: '空闲',
  CHARGE: '充电',
  PROCESSING: '执行中',
  PAUSED: '暂停',
  TRAFFIC: '交管',
  AVOID: '避障',
  BRAKE: '抱闸',
  ERROR: '异常',
}

/** 叶子字段标签映射（旧 orderRefer 与车辆状态结构的既定交集；x/y 无映射显示原字段名） */
export const VEHICLE_FIELD_LABEL: Record<string, string> = {
  agvKey: '车辆唯一标识',
  agvName: '车辆名称',
  type: '类型',
  orderKey: '订单编号',
  orderName: '订单名称',
  orderState: '订单状态',
  connectionState: '连接状态',
  fieldViolation: '安全域状态',
  estop: '紧急停车',
  batteryCharge: '电量（%）',
  batteryVoltage: '电池电压（v）',
  batteryHealth: '电池健康状态',
  charging: '充电中',
  reach: '电池电流(a)',
  length: '长度（m）',
  width: '宽度（m）',
  centerOffset: '偏移距离（m）',
  loadLength: '载货长度（m）',
  loadWidth: '载货宽度（m）',
  theta: '车辆的旋转弧度',
  mapId: '地图唯一标识',
  mapDescription: '地图名称',
  positionInitialized: '是否开启了定位',
  localizationScore: '定位置信度',
  deviationRange: '定位偏差范围值',
  normal: 'agv坐标是否正常',
  vehicleProcStatus: '车辆执行状态',
  dispatchState: '调度状态',
  paused: '暂停状态',
  loaded: '载货',
  createTime: '创建时间',
}

/**
 * 布尔字段既定语义（旧 getFixedFieldText 同口径）：key → 布尔值文案 key。
 * 命中表才做布尔转换；值缺失/非布尔时按普通空值留白，不猜。
 */
const BOOLEAN_FIELD_TEXT: Record<string, (value: boolean) => string> = {
  // 安全域状态：true 表示安全域被入侵（如遇障）→ 异常
  fieldViolation: (value) => (value ? '异常' : '正常'),
  // agv 坐标是否正常：true → 正常（注意与 fieldViolation 语义方向相反）
  normal: (value) => (value ? '正常' : '异常'),
  positionInitialized: (value) => (value ? '已开启' : '未开启'),
  paused: (value) => (value ? '已暂停' : '未暂停'),
  loaded: (value) => (value ? '是' : '否'),
  charging: (value) => (value ? '是' : '否'),
}

/** 展平后的单个字段：labelKey 为标签文案 key；text 为 null 表示缺失（留白） */
export interface VehicleStateField {
  /** 叶子字段名（原始 key，用作 Descriptions item key 与调试定位） */
  key: string
  /** 标签文案 key（映射不到时即原字段名，i18next 缺 key 显示原样） */
  labelKey: string
  /** 展示文本；null = 缺失/不可解析（留白，不补占位符） */
  text: string | null
  /**
   * text 是否为字面量：true = 协议原值/格式化结果（不得再过 t()，防止车辆名称
 * 等原文恰好命中文案 key 被误翻）；false = 文案 key，展示前经 t() 翻译。
   */
  literal: boolean
}

/** 枚举字段统一转换：命中映射输出文案 key，未知值输出原值（literal） */
function enumField(
  map: Record<string, string>,
  value: string,
): { text: string; literal: boolean } {
  const label = map[value]
  return label ? { text: label, literal: false } : { text: value, literal: true }
}

/** 订单状态转换：复用任务域共享映射（P03/P38 同一真相源），未知值原值 */
function orderStateField(value: string): { text: string; literal: boolean } {
  const found = ORDER_STATE_OPTIONS.find((item) => item.value === value)
  return found ? { text: found.label, literal: false } : { text: value, literal: true }
}

/** 单个叶子值 → 展示文本（含字段名特判；递归主体调用） */
function leafField(key: string, value: unknown): { text: string | null; literal: boolean } {
  // 缺失留白（null/undefined/空串都不占位；不补 0、不用「—」——AGENTS 第 3 节）
  if (value === null || value === undefined || value === '') return { text: null, literal: true }

  // 布尔字段：既定语义转文案 key（值已确认非空布尔场景由调用方保证 typeof 判断）
  const booleanText = BOOLEAN_FIELD_TEXT[key]
  if (booleanText && typeof value === 'boolean') {
    return { text: booleanText(value), literal: false }
  }

  // 枚举与时间字段特判（按字段名；值形态异常时退回通用分支，不猜语义）
  switch (key) {
    case 'connectionState':
      if (typeof value === 'string') return enumField(CONNECTION_STATE_LABEL, value)
      break
    case 'estop':
      if (typeof value === 'string') return enumField(ESTOP_LABEL, value)
      break
    case 'dispatchState':
      if (typeof value === 'string') return enumField(DISPATCH_STATE_LABEL, value)
      break
    case 'vehicleProcStatus':
      if (typeof value === 'string') return enumField(VEHICLE_PROC_STATUS_LABEL, value)
      break
    case 'orderState':
      if (typeof value === 'string') return orderStateField(value)
      break
    case 'type': {
      // 车辆类型既定取值域 1/2；未知值显示协议原值（差异登记：旧缺省「小车」）
      if (typeof value === 'number') {
        const label = VEHICLE_TYPE_LABEL[value]
        return label ? { text: label, literal: false } : { text: String(value), literal: true }
      }
      break
    }
    case 'createTime': {
      // 毫秒时间戳 → 部署时区秒级墙钟；缺失/不可解析留白（displayDateTime 纪律）
      if (typeof value === 'number') {
        const text = displayDateTime(value)
        return { text, literal: true }
      }
      break
    }
    default:
      break
  }

  // 通用分支（旧 default 同口径）：数组/普通对象 JSON 原文，其余 String()
  if (typeof value === 'object') {
    return { text: JSON.stringify(value), literal: true }
  }
  return { text: String(value), literal: true }
}

/**
 * 递归展平车辆状态（旧 transformVehicleInfo 同语义）：嵌套普通对象下钻
 * （叶子保持 JSON 键序），数组按整体值呈现。
 */
export function flattenVehicleState(data: VehicleStateRecordDto): VehicleStateField[] {
  const fields: VehicleStateField[] = []
  const walk = (node: Record<string, unknown>): void => {
    for (const key of Object.keys(node)) {
      const value = node[key]
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        // 嵌套对象（safetyState/batteryState/agvDimension/agvPosition/load…）下钻
        walk(value as Record<string, unknown>)
      } else {
        const { text, literal } = leafField(key, value)
        fields.push({ key, labelKey: VEHICLE_FIELD_LABEL[key] ?? key, text, literal })
      }
    }
  }
  walk(data as Record<string, unknown>)
  return fields
}
