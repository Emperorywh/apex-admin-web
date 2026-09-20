/**
 * 任务统计服务（P33 整页交付；owner=P33，contracts.md 订单报表节）。
 *
 * 接口族（逐 operation 核对 OpenAPI，method/path/请求体形态与旧实现一致）：
 * - POST /fms/v1/report/orderStatisticsReport/orderQuantityStatistics
 *   订单数量统计（body=OrderQuantityStatisticsParam → OrderQuantity[]）
 * - POST /fms/v1/report/orderStatisticsReport/orderEfficiencyStatistics
 *   订单效率统计（body=OrderEfficiencyStatisticsParam → OrderEfficiency[]）
 *
 * 两个 POST 均为纯查询语义（统计报表查询，无任何副作用），
 * 按 TASKS §1「查询性质 POST 按业务语义分类」归入只读查询，可安全重查/自动恢复；
 * 响应解包/业务码/取消统一由请求层完成，本层不重复处理。
 *
 * 请求体字段纪律：
 * - startTime/endTime 未选择时发空串（旧实现 dateString || "" 同语义，后端已接受），
 *   选择时为 "yyyy-MM-dd HH:mm:ss"（部署时区口径，规格 11.3）；
 * - 集合字段不传/空数组 = 不按该维度过滤（OpenAPI 描述同口径）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  OrderEfficiencyDto,
  OrderEfficiencyStatisticsParam,
  OrderQuantityDto,
  OrderQuantityStatisticsParam,
} from '@/services/report-order/report-order.service.types'

/** 订单报表控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const ORDER_STATISTICS_BASE = '/report/orderStatisticsReport'

/** 订单数量统计：按「任务类型 × 任务状态」维度返回任务数量行 */
export async function orderQuantityStatistics(
  param: OrderQuantityStatisticsParam,
  options?: RequestOptions,
): Promise<OrderQuantityDto[]> {
  return api.post<OrderQuantityDto[]>(`${ORDER_STATISTICS_BASE}/orderQuantityStatistics`, param, {
    signal: options?.signal,
  })
}

/** 订单效率统计：按任务类型维度返回三个平均耗时行（单位秒） */
export async function orderEfficiencyStatistics(
  param: OrderEfficiencyStatisticsParam,
  options?: RequestOptions,
): Promise<OrderEfficiencyDto[]> {
  return api.post<OrderEfficiencyDto[]>(`${ORDER_STATISTICS_BASE}/orderEfficiencyStatistics`, param, {
    signal: options?.signal,
  })
}
