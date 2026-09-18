/**
 * 车辆分组共享选项服务（P03 代建，owner 交接 P04；contracts.md 第 5 节唯一 operation 登记）。
 *
 * GET /fms/v1/dispatcher/vehicleGroup/getVehicleGroups：全量车辆分组选项；
 * - 过滤缺 agvGroupKey 条目：无标识分组无法作为选项值提交或回显；
 * - 分组管理页面（增改删/组内车辆维护）归 P04，本服务不扩展。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { VehicleGroupDto } from '@/services/vehicle/vehicle-group.service.types'

/** 拉取车辆分组选项列表（全量） */
export async function fetchVehicleGroups(options?: RequestOptions): Promise<VehicleGroupDto[]> {
  const list = await api.get<VehicleGroupDto[]>('/dispatcher/vehicleGroup/getVehicleGroups', {
    signal: options?.signal,
  })
  if (!Array.isArray(list)) {
    throw new Error('车辆分组选项响应结构异常（期望数组）')
  }
  return list.filter((item) => typeof item?.agvGroupKey === 'string' && item.agvGroupKey !== '')
}
