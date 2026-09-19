/**
 * 地图推送记录服务（P12 整页重写交付；owner 归 P12，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/dispatcher/mapPushRecord/pageMapPushRecords   分页查询推送记录
 * - POST /fms/v1/dispatcher/mapPushRecord/rePushMap            重新推送地图
 * - POST /fms/v1/dispatcher/mapPushRecord/cancelPushMap        取消推送地图
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 分页查询与 P09 pageMapInfos 同款：GET + query 平铺（G04），联验实测确认；
 * - 重推/取消是影响现场车辆的命令类写操作：受理 ≠ 子记录状态已变更，
 *   最终状态以重新查询（本页轮询/写后刷新）为准，本层不做自动重试。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  MapPushRecordPageDto,
  MapPushRecordPageParam,
  MapRePushParam,
} from '@/services/map-push-record/map-push-record.service.types'

/** 地图推送记录控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const MAP_PUSH_RECORD_BASE = '/dispatcher/mapPushRecord'

/**
 * 分页查询地图推送记录：pageNo 从 1 计数（页面用 toBackendPage 换算）。
 * 接口无筛选/排序参数（G09），每次返回整批记录及其子记录集合。
 */
export async function pageMapPushRecords(
  params: MapPushRecordPageParam,
  options?: RequestOptions,
): Promise<MapPushRecordPageDto> {
  return api.get<MapPushRecordPageDto>(`${MAP_PUSH_RECORD_BASE}/pageMapPushRecords`, {
    params,
    signal: options?.signal,
  })
}

/**
 * 重新推送地图（命令类写操作，页面 confirmCommand 确认后调用）：
 * - 记录级：不传 mapPushSubRecordIds，后端对该记录下全部车辆重推；
 * - 子记录级：传单个子记录 id，仅重推该车辆。
 * 返回 void（受理语义）：命令提交不代表推送完成，状态以重新查询为准。
 */
export async function rePushMap(
  params: MapRePushParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${MAP_PUSH_RECORD_BASE}/rePushMap`, params, {
    signal: options?.signal,
  })
}

/**
 * 取消推送地图（命令类写操作，页面 confirmCommand 确认后调用；请求体与重推一致）：
 * - 记录级：不传 mapPushSubRecordIds，后端对该记录下全部未完成推送取消；
 * - 子记录级：传单个子记录 id，仅取消该车辆推送。
 * 仅等待/推送中的子记录可取消（可取消性判断与入口显隐由页面负责）。
 */
export async function cancelPushMap(
  params: MapRePushParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${MAP_PUSH_RECORD_BASE}/cancelPushMap`, params, {
    signal: options?.signal,
  })
}
