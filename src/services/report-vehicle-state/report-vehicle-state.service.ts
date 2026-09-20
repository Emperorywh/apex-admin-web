/**
 * 车辆状态统计报表服务（P37 整页交付；owner=P37，contracts.md 车辆报表节）。
 *
 * 接口族（逐 operation 核对 OpenAPI，method/path/请求体形态与旧实现一致）：
 * - POST /fms/v1/report/vehicleStatisticsReport/agvExecutingTimeStatistics
 *   每车各状态总时长统计（body=AgvStateStatisticsParam → AgvExecutingTimeStatisticsVO）：
 *   P37 车辆状态统计页的唯一数据源（KPI/图表/明细共用一次请求）
 * - POST /fms/v1/report/vehicleStatisticsReport/agvStateStatistics
 *   每日状态时长统计（同参数 → AgvStateStatisticsVO）：
 *   按天聚合 + 当天车辆数，P35 任务统计报表消费；本任务交付服务层与 DTO，
 *   页面不发起该请求（不预支 P35 的业务）
 *
 * 两个 POST 均为纯查询语义（统计报表聚合，无任何副作用），
 * 按 TASKS §1「查询性质 POST 按业务语义分类」归入只读查询，可安全重查/自动恢复；
 * 响应解包/业务码/取消统一由请求层完成，本层不重复处理。
 *
 * 参数归一化纪律（旧实现同口径）：states / vehicleKeys 传空数组时视为
 * 「不筛选该维度」，归一化为不传参（协议语义「为空时统计所有状态」），
 * 避免后端对空数组的解析差异；时间字符串由调用方（页面层）按部署时区格式化。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  AgvExecutingTimeStatisticsVo,
  AgvStateStatisticsVo,
  VehicleStateStatisticsParam,
} from '@/services/report-vehicle-state/report-vehicle-state.service.types'

/** 车辆报表控制类统一前缀（request 层 baseURL 已含 /fms/v1） */
const VEHICLE_STATISTICS_BASE = '/report/vehicleStatisticsReport'

/** 集合条件归一化：空数组视为不筛选该维度（不传参，协议「为空时统计所有」口径） */
function normalizeParam(
  param: VehicleStateStatisticsParam,
): VehicleStateStatisticsParam {
  return {
    ...param,
    states: param.states && param.states.length > 0 ? param.states : undefined,
    vehicleKeys:
      param.vehicleKeys && param.vehicleKeys.length > 0 ? param.vehicleKeys : undefined,
  }
}

/** 每车各状态总时长统计：KPI、堆叠柱图与明细表共用一次请求 */
export async function agvExecutingTimeStatistics(
  param: VehicleStateStatisticsParam,
  options?: RequestOptions,
): Promise<AgvExecutingTimeStatisticsVo> {
  return api.post<AgvExecutingTimeStatisticsVo>(
    `${VEHICLE_STATISTICS_BASE}/agvExecutingTimeStatistics`,
    normalizeParam(param),
    { signal: options?.signal },
  )
}

/** 每日状态时长统计（按天聚合 + 当天车辆数；P35 消费，本任务交付服务层） */
export async function agvStateStatistics(
  param: VehicleStateStatisticsParam,
  options?: RequestOptions,
): Promise<AgvStateStatisticsVo> {
  return api.post<AgvStateStatisticsVo>(
    `${VEHICLE_STATISTICS_BASE}/agvStateStatistics`,
    normalizeParam(param),
    { signal: options?.signal },
  )
}
