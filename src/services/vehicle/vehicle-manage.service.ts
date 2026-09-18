/**
 * 车辆管理服务（P05 重写：接入真实调度接口 dispatcher/vehicle）。
 *
 * 接口族（逐 operation 核对 OpenAPI，method/path/字段与文档一致）：
 * - GET  /fms/v1/dispatcher/vehicle/pageVehicles               列表分页（query=名称/标识）
 * - POST /fms/v1/dispatcher/vehicle/addVehicle                 接入车辆（新增）
 * - POST /fms/v1/dispatcher/vehicle/updateVehicle              编辑（含调度状态切换）
 * - POST /fms/v1/dispatcher/vehicle/deleteVehicle              删除车辆
 * - POST /fms/v1/dispatcher/vehicle/vehicleOperate             单车指令（暂停/继续）
 * - POST /fms/v1/dispatcher/vehicle/allVehicleOperate          批量指令（暂停/继续/启用/禁用）
 * - GET  /fms/v1/dispatcher/vehicle/getUnRelationSimpleVehicles 未接入调度系统的上报车辆选项
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - pageVehicles 的分页参数按字段平铺为 query（旧系统同后端实证行为；文档把
 *   pageParam 声明为单个对象参数，序列化差异沿用 G04 登记口径）；
 * - 全部函数接收 RequestOptions.signal，取消语义与请求层一致；
 * - 指令/增删改是影响现场或破坏性的写操作：确认、状态核验、防重复提交由页面
 *   负责，本层不做自动重试（ResultVoid 仅代表命令接受，不代表动作完成）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  SimpleVehicleDto,
} from '@/services/vehicle/vehicle.service.types'
import type {
  VehicleBatchOperateParam,
  VehicleDeleteParam,
  VehicleFormParam,
  VehicleOperateParam,
  VehiclePage,
  VehiclePageParam,
} from '@/services/vehicle/vehicle-manage.service.types'

/** 车辆列表查询：pageNo 从 1 计数（页面用 toBackendPage 从零基 pageIndex 换算） */
export async function pageVehicles(
  params: VehiclePageParam,
  options?: RequestOptions,
): Promise<VehiclePage> {
  return api.get<VehiclePage>('/dispatcher/vehicle/pageVehicles', {
    params,
    signal: options?.signal,
  })
}

/** 接入车辆（新增）：成功返回 data 为空（ResultVoid 语义） */
export async function addVehicle(
  params: VehicleFormParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/vehicle/addVehicle', params, {
    signal: options?.signal,
  })
}

/** 编辑车辆（含调度状态 ENABLE/DISABLE 切换，与旧实现同通道） */
export async function updateVehicle(
  params: VehicleFormParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/vehicle/updateVehicle', params, {
    signal: options?.signal,
  })
}

/** 删除车辆（按唯一 key） */
export async function deleteVehicle(
  params: VehicleDeleteParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/vehicle/deleteVehicle', params, {
    signal: options?.signal,
  })
}

/** 单车指令（暂停/继续）：返回仅代表命令接受，动作完成以实际状态核实 */
export async function operateVehicle(
  params: VehicleOperateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/vehicle/vehicleOperate', params, {
    signal: options?.signal,
  })
}

/**
 * 批量指令（暂停/继续/启用/禁用）：vehicleKeys 不传 = 全部车辆（旧实现语义）。
 * 后端只返回整批结果（无逐项反馈），页面按「整批接受」诚实呈现，不伪造逐车完成。
 */
export async function operateAllVehicles(
  params: VehicleBatchOperateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/vehicle/allVehicleOperate', params, {
    signal: options?.signal,
  })
}

/** 未接入调度系统的上报车辆选项（新增车辆「关联上报车辆」下拉唯一数据源） */
export async function fetchUnrelationSimpleVehicles(
  options?: RequestOptions,
): Promise<SimpleVehicleDto[]> {
  const list = await api.get<SimpleVehicleDto[]>('/dispatcher/vehicle/getUnRelationSimpleVehicles', {
    signal: options?.signal,
  })
  if (!Array.isArray(list)) {
    throw new Error('未关联上报车辆响应结构异常（期望数组）')
  }
  // 缺 key 的条目无法作为选项值提交，过滤（与共享选项服务同口径）
  return list.filter((item) => typeof item?.key === 'string' && item.key !== '')
}
