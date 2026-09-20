/**
 * 任务统计报表服务（P35 整页交付；owner=P35，contracts.md 订单报表节）。
 *
 * 接口（逐 operation 核对 OpenAPI，method/path/请求体形态与旧实现一致）：
 * - POST /fms/v1/report/orderStatisticsReport/taskStatistics
 *   任务统计聚合（body=TaskStatisticsParam → TaskStatisticsVO）：
 *   每日订单统计（创建/完成/取消/失败/创建口径耗时）+ 执行时长固定分桶；
 *   KPI/任务量趋势/时长分布/每日明细共用该请求（页面层一次消费）。
 *
 * 该 POST 为纯查询语义（统计报表聚合，无任何副作用），按 TASKS §1
 * 「查询性质 POST 按业务语义分类」归入只读查询，可安全重查/自动恢复；
 * 响应解包/业务码/取消统一由请求层完成，本层不重复处理。
 *
 * 参数纪律（旧实现同口径）：
 * - orderTypes 本页恒不传（后端默认「工作任务」，旧 fetchTaskStatistics 同语义）；
 * - vehicleKeys 空数组与「不传」同义（查全部车辆），统一归一化为不传，
 *   避免后端对空集合的解析差异；
 * - 时间字符串由调用方（页面层）按部署时区格式化 "yyyy-MM-dd HH:mm:ss"。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  TaskStatisticsParam,
  TaskStatisticsVo,
} from '@/services/report-task/report-task.service.types'

/** 订单报表控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const ORDER_STATISTICS_BASE = '/report/orderStatisticsReport'

/** 任务统计聚合查询：窗口级 KPI/趋势/分布/明细的唯一数据源 */
export async function taskStatistics(
  param: TaskStatisticsParam,
  options?: RequestOptions,
): Promise<TaskStatisticsVo> {
  return api.post<TaskStatisticsVo>(`${ORDER_STATISTICS_BASE}/taskStatistics`, {
    ...param,
    // 空数组视为不筛选该维度（不传参）；orderTypes 本页不提供筛选，保持 undefined
    vehicleKeys:
      param.vehicleKeys && param.vehicleKeys.length > 0 ? param.vehicleKeys : undefined,
  }, { signal: options?.signal })
}
