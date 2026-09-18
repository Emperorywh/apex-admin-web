/**
 * 载具类型服务（P06 整页重写交付；owner 归 P06，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - POST /fms/v1/dispatcher/carrier/pageCarriers   分页查询（body 平铺参数）
 * - POST /fms/v1/dispatcher/carrier/createCarrier  新增载具类型
 * - POST /fms/v1/dispatcher/carrier/updateCarrier  编辑载具类型（id 定位）
 * - POST /fms/v1/dispatcher/carrier/deleteCarrier  删除载具类型（id 定位）
 *
 * 协议纪律：
 * - 与 vehicleGroup 分页（GET+query）不同，carrier 四接口在旧实现与 OpenAPI
 *   清单中均为 POST+JSON 请求体，本层保持该形态不做「归一化」改写；
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 全部函数接收 RequestOptions.signal，取消语义与请求层一致；
 * - 增删改是影响调度配置的写操作：确认对象与影响、防重复提交由页面负责，
 *   本层不做自动重试（成功响应仅代表后端受理）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  CarrierAddParam,
  CarrierDeleteParam,
  CarrierPage,
  CarrierPageParam,
  CarrierUpdateParam,
} from '@/services/vehicle/carrier.service.types'

/** 载具类型分页查询：pageNo 从 1 计数（页面用 toBackendPage 从零基 pageIndex 换算） */
export async function pageCarriers(
  params: CarrierPageParam,
  options?: RequestOptions,
): Promise<CarrierPage> {
  return api.post<CarrierPage>('/dispatcher/carrier/pageCarriers', params, {
    signal: options?.signal,
  })
}

/** 新增载具类型：成功仅代表后端受理（页面提交成功后自行刷新列表） */
export async function addCarrier(
  params: CarrierAddParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/carrier/createCarrier', params, {
    signal: options?.signal,
  })
}

/** 编辑载具类型（id 定位；名称/编码/尺寸全量提交） */
export async function updateCarrier(
  params: CarrierUpdateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/carrier/updateCarrier', params, {
    signal: options?.signal,
  })
}

/** 删除载具类型（按 id；破坏性操作，页面确认后调用） */
export async function deleteCarrier(
  params: CarrierDeleteParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/carrier/deleteCarrier', params, {
    signal: options?.signal,
  })
}
