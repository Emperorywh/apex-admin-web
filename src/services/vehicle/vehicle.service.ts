/**
 * 车辆共享选项服务（P03 代建，owner 交接 P04；contracts.md 第 5 节唯一 operation 登记）。
 *
 * GET /fms/v1/dispatcher/vehicle/getSimpleVehicles：全量简单车辆选项；
 * - mapId 可选（按地图过滤车辆），P03 搜索表单/创建任务不传（与旧实现一致的全量口径）；
 * - 过滤缺 key 条目：无标识车辆无法作为选项值提交或回显；
 * - 车辆管理的增改删/状态/指令归 P05，本服务不扩展。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { SimpleVehicleDto } from '@/services/vehicle/vehicle.service.types'

/** 拉取简单车辆选项列表（全量，防乱序/取消由调用方 signal 控制） */
export async function fetchSimpleVehicles(options?: RequestOptions): Promise<SimpleVehicleDto[]> {
  const list = await api.get<SimpleVehicleDto[]>('/dispatcher/vehicle/getSimpleVehicles', {
    signal: options?.signal,
  })
  if (!Array.isArray(list)) {
    throw new Error('车辆选项响应结构异常（期望数组）')
  }
  return list.filter((item) => typeof item?.key === 'string' && item.key !== '')
}
