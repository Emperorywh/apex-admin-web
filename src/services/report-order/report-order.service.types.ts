/**
 * 任务统计（订单报表）DTO（P33 整页交付；owner=P33）。
 *
 * 协议来源：OpenAPI schemas OrderQuantityStatisticsParam /
 * OrderEfficiencyStatisticsParam / OrderQuantity / OrderEfficiency，
 * 与旧实现页面消费结构（BarDataItem / EfficiencyDataItem）逐字段核对一致：
 * - 数量统计返回「类型 × 状态」维度的数量行；
 * - 效率统计返回「类型」维度的三个平均值行（单位秒，int64）。
 */

/** 任务类型协议原值（OpenAPI 枚举；展示映射见 constants/order/orderDisplayOptions） */
export type OrderTypeValue = 'WORK' | 'CHARGE' | 'PARK' | 'BATTERY_MAINTAIN'

/** 任务状态协议原值（OpenAPI 枚举） */
export type OrderStateValue =
  | 'IN_QUEUE'
  | 'OUT_QUEUE'
  | 'PROCESSING'
  | 'HANG'
  | 'CANCELLED'
  | 'SUCCEEDED'
  | 'FAILED'

/** 任务类型筛选集合（OrderQuantityStatisticsParam/OrderEfficiencyStatisticsParam 同形） */
export type OrderTypeFilter = OrderTypeValue[]

/** 任务状态筛选集合（仅数量统计参数支持；效率统计契约无此字段） */
export type OrderStateFilter = OrderStateValue[]

/** 数量统计查询参数（OrderQuantityStatisticsParam） */
export interface OrderQuantityStatisticsParam {
  /** 开始时间（date-time；旧实现为 "yyyy-MM-dd HH:mm:ss" 字符串，未选时发空串，等价保留） */
  startTime?: string
  /** 结束时间（date-time；空串语义同上） */
  endTime?: string
  /** 任务类型集合；不传/空 = 全部类型 */
  orderTypes?: string[]
  /** 任务状态集合；不传/空 = 全部状态 */
  orderStates?: string[]
  /** 车辆 key 集合；不传/空 = 全部车辆 */
  vehicleKeys?: string[]
}

/**
 * 效率统计查询参数（OrderEfficiencyStatisticsParam）。
 * 与数量统计参数的差异：契约不含 orderStates——旧效率页签也无任务状态筛选，等价保留。
 */
export interface OrderEfficiencyStatisticsParam {
  startTime?: string
  endTime?: string
  orderTypes?: string[]
  vehicleKeys?: string[]
}

/** 数量统计行（OrderQuantity）：某任务类型 × 某任务状态的任务数量 */
export interface OrderQuantityDto {
  /** 任务数量（int64，JSON number 承载——G10 与 P21/P22 同口径） */
  number?: number
  /** 任务状态（后端原值；未知枚举展示原值不臆造映射） */
  orderState?: string
  /** 任务类型（后端原值；本页图表按状态维度聚合，类型维度保留在原始数据中） */
  orderType?: string
}

/** 效率统计行（OrderEfficiency）：某任务类型的三个平均耗时（单位秒） */
export interface OrderEfficiencyDto {
  /** 平均总时间（秒，int64：创建到终态的平均时长） */
  orderAverageTime?: number
  /** 平均执行时间（秒，int64：执行阶段的平均时长） */
  orderAverageExecutionTime?: number
  /** 平均等待时间（秒，int64：创建到开始执行的平均等待） */
  orderAverageWaitTime?: number
  /** 任务类型（后端原值） */
  orderType?: string
}
