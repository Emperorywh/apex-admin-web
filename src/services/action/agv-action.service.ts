/**
 * 车辆动作共享选项服务（P03 代建，owner 交接 P24；contracts.md 第 5 节唯一 operation 登记）。
 *
 * - GET /fms/v1/action/agvAction/getAGVActions：全量车辆动作选项；
 * - GET /fms/v1/action/agvActionGroup/getAGVActionGroups：全量动作分组选项
 *   （组内携带动作完整集合，创建任务按组提交时直接取用）；
 * - 动作/分组管理页面（增改删、参数编辑）归 P23/P24，本服务不扩展。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { AGVActionDto, AGVActionGroupDto } from '@/services/action/agv-action.service.types'

/** 拉取车辆动作选项列表（全量） */
export async function fetchAGVActions(options?: RequestOptions): Promise<AGVActionDto[]> {
  const list = await api.get<AGVActionDto[]>('/action/agvAction/getAGVActions', {
    signal: options?.signal,
  })
  if (!Array.isArray(list)) {
    throw new Error('车辆动作选项响应结构异常（期望数组）')
  }
  // 保留缺 id 条目会产出无法提交的选项，统一过滤（id 是创建提交的定位依据）
  return list.filter((item) => typeof item?.id === 'number')
}

/** 拉取车辆动作分组选项列表（全量，含组内动作） */
export async function fetchAGVActionGroups(
  options?: RequestOptions,
): Promise<AGVActionGroupDto[]> {
  const list = await api.get<AGVActionGroupDto[]>('/action/agvActionGroup/getAGVActionGroups', {
    signal: options?.signal,
  })
  if (!Array.isArray(list)) {
    throw new Error('车辆动作分组选项响应结构异常（期望数组）')
  }
  return list.filter((item) => typeof item?.id === 'number')
}
