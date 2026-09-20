/**
 * 任务统计报表 DTO（P35 整页交付；owner=P35，contracts.md 订单报表节）。
 *
 * 协议来源：OpenAPI schemas TaskStatisticsParam / TaskStatisticsVO /
 * DailyCount / DurationBucket / ResultTaskStatisticsVO，与旧实现消费结构
 * （C:\code\dd src/types/AnalyzeVisual/OrderStatistics.d.ts）逐字段核对一致。
 * 响应壳 code/message/timestamp/data 由请求层统一解包后进入本层类型。
 *
 * 协议口径（旧实现联调注释同口径，等价保留）：
 * - 后端按下发的自然日返回 dailyCounts（实测为 "yyyy-MM-ddT00:00:00" 形态，
 *   消费方截取前 10 位归一化），且不下发无数据的自然日——缺失天由前端补 0；
 * - 总数/完成率等窗口级汇总字段协议不下发，由前端基于 dailyCounts 汇总；
 * - 接口不提供任务级明细与类型分布，页面明细区域为「每日聚合明细」。
 */

/** 订单类型协议枚举（OpenAPI orderTypes.items.enum，4 值；后端默认「工作任务」） */
export type TaskStatisticsOrderType =
  | 'WORK' // 工作任务
  | 'CHARGE' // 充电任务
  | 'PARK' // 停靠任务
  | 'BATTERY_MAINTAIN' // 电池维护任务

/** 任务统计查询参数（TaskStatisticsParam） */
export interface TaskStatisticsParam {
  /** 开始时间（"yyyy-MM-dd HH:mm:ss"，部署时区墙钟，规格 11.3） */
  startTime?: string
  /** 结束时间（同上；接口支持任意起止区间，与旧实现 TimeRangePicker 一致） */
  endTime?: string
  /** 订单类型集合（空 = 后端默认「工作任务」；本页不提供类型筛选，保留协议形状） */
  orderTypes?: TaskStatisticsOrderType[]
  /** 车辆集合（空 = 全部车辆；服务层归一化为不传参，旧实现同口径） */
  vehicleKeys?: string[]
}

/**
 * 每日订单统计行（DailyCount）。
 * 计数字段缺失按 0 参与汇总（计数聚合「无记录 = 0 个订单」，旧实现 ?? 0 同口径）；
 * 平均耗时使用 created 口径（创建且已完成），分子分母由前端相除。
 */
export interface DailyCountDto {
  /** 日期（实测下发 "yyyy-MM-ddT00:00:00"，消费方截取前 10 位归一化） */
  date?: string
  /** 当天创建的订单数（按创建时间） */
  created?: number
  /** 当天完成的订单数（按结束时间） */
  completed?: number
  /** 当天取消的订单数（按结束时间） */
  cancelled?: number
  /** 当天失败的订单数（按结束时间） */
  failed?: number
  /** 当天创建的已完成订单数（平均耗时分子/分母用） */
  createdSucceededCount?: number
  /** 当天创建的已完成订单总耗时（秒，int64；平均耗时 = 总耗时 ÷ 数量） */
  createdSucceededDurationSeconds?: number
  /** 当天创建且有执行时间的订单总等待时长（秒，int64；本页未消费，保留协议形状） */
  waitDurationSeconds?: number
}

/** 执行时长分布分桶行（DurationBucket；label 为后端下发显示名，如 "<1min"） */
export interface DurationBucketDto {
  /** 分桶显示名（消费方归一化后映射到固定桶序，未知 label 防御性丢弃） */
  label?: string
  /** 该桶订单数 */
  count?: number
}

/** 任务统计报表 VO（TaskStatisticsVO；窗口级 KPI 由前端基于 dailyCounts 汇总） */
export interface TaskStatisticsVo {
  /** 每日订单统计（按天升序；不下发无数据的自然日，缺失天前端补 0） */
  dailyCounts?: DailyCountDto[]
  /** 执行时长分布（按固定分桶，按桶升序） */
  durationDistribution?: DurationBucketDto[]
}
