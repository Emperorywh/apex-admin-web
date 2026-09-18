/**
 * 车辆分组服务（P04 整页重写；owner 自本任务起归 P04，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI，method/path/字段与文档一致）：
 * - GET  /fms/v1/dispatcher/vehicleGroup/pageVehicleGroups   分组管理分页（query=名称/key）
 * - POST /fms/v1/dispatcher/vehicleGroup/addVehicleGroup     新增分组
 * - POST /fms/v1/dispatcher/vehicleGroup/updateVehicleGroup  编辑分组（组内车辆全量提交）
 * - POST /fms/v1/dispatcher/vehicleGroup/deleteVehicleGroup  删除分组（按 key）
 * - GET  /fms/v1/dispatcher/vehicleGroup/getVehicleGroups    全量分组选项（P03 代建共享契约，
 *    P03/P20 消费中，本层保持原实现不动）
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - pageVehicleGroups 的分页参数按字段平铺为 query（pageVehicles 同族后端实证行为；
 *   文档把 pageParam 声明为单个对象参数，序列化差异沿用 G04 登记口径）；
 * - 全部函数接收 RequestOptions.signal，取消语义与请求层一致；
 * - 增删改是影响调度配置的写操作：确认对象与影响、防重复提交由页面负责，
 *   本层不做自动重试（成功响应仅代表后端受理）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  VehicleGroupAddParam,
  VehicleGroupDeleteParam,
  VehicleGroupDto,
  VehicleGroupPage,
  VehicleGroupPageParam,
  VehicleGroupUpdateParam,
} from '@/services/vehicle/vehicle-group.service.types'

/** 分组分页查询：pageNo 从 1 计数（页面用 toBackendPage 从零基 pageIndex 换算） */
export async function pageVehicleGroups(
  params: VehicleGroupPageParam,
  options?: RequestOptions,
): Promise<VehicleGroupPage> {
  return api.get<VehicleGroupPage>('/dispatcher/vehicleGroup/pageVehicleGroups', {
    params,
    signal: options?.signal,
  })
}

/** 新增分组：成功返回 data 为 string（ResultString；页面只关心业务码） */
export async function addVehicleGroup(
  params: VehicleGroupAddParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/vehicleGroup/addVehicleGroup', params, {
    signal: options?.signal,
  })
}

/** 编辑分组（groupKey 定位；vehicleKeys 全量语义，失效/移除条目由用户显式决定） */
export async function updateVehicleGroup(
  params: VehicleGroupUpdateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/vehicleGroup/updateVehicleGroup', params, {
    signal: options?.signal,
  })
}

/** 删除分组（按唯一 key；高危操作，页面确认后调用） */
export async function deleteVehicleGroup(
  params: VehicleGroupDeleteParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/vehicleGroup/deleteVehicleGroup', params, {
    signal: options?.signal,
  })
}

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
