/**
 * 车辆状态服务（P39 owner：完整车辆详情页 /vehicle-info）。
 *
 * 接口（逐字段核对基线 OpenAPI，SHA-256 A82E…49C7C）：
 * - GET /fms/v1/dispatcher/vehicle/getVehicleState（query: vehicleKey 必填 string）
 *   → ResultVehicleStateRecord
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 参数按字段平铺为 query（G04：GET 对象序列化沿用 P05 已实证的后端接受口径）；
 * - 返回类型如实标注可空：任务详情同族接口已实证「目标不存在时 code=200 +
 *   data=null」的语义（P38 对 getOrderRecordDetail 的带令牌实证），车辆详情
 *   联验时对不存在车辆实证该行为后由页面呈现「车辆不存在或已被删除」；
 * - 本接口是只读查询，进轮询（useVisiblePolling）；signal 必须透传请求层。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { VehicleStateRecordDto } from '@/services/vehicle/vehicle-state.service.types'

/** 车辆完整状态查询：vehicleKey 为车辆唯一标识（页面经 vehicleDetailNavigation 解析） */
export async function fetchVehicleState(
  params: { vehicleKey: string },
  options?: RequestOptions,
): Promise<VehicleStateRecordDto | null> {
  return api.get<VehicleStateRecordDto | null>('/dispatcher/vehicle/getVehicleState', {
    params,
    signal: options?.signal,
  })
}
