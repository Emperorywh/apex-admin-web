/**
 * 控制前状态核验（P05 控制交互样板）：落实迁移规格 8.2「后台页签保留最后快照，
 * 影响现场的操作需先核验新状态」与 A14「状态核实后再由用户决定重试」。
 *
 * 语义：写命令（调度状态切换/单车指令）发出前，用列表同通道（pageVehicles + query）
 * 重查目标车辆，比较快照关键字段：
 * - 查不到目标 → 目标可能已被删除（或极端分页挤出），不执行，提示刷新后重试；
 * - 调度状态或网络状态与快照不一致 → 用户基于陈旧快照做决策（典型场景：页签
 *   从后台激活回来、轮询恢复查询之前），不执行，刷新列表让用户基于新状态重新确认；
 * - 一致 → 放行执行。
 * 不引入额外单车详情接口：核验与列表共用 pageVehicles 通道（权限/口径一致），
 * 供设备类控制页复用（样板的目的是统一「先核验再开放控制」的交互形态）。
 */

import { pageVehicles } from '@/services/vehicle/vehicle-manage.service'
import type { RequestOptions } from '@/services/request/request.types'
import type { VehicleRecordDto } from '@/services/vehicle/vehicle-manage.service.types'

/** 核验结论（可辨识联合）：ok=可执行；missing=目标已不存在；stale=快照过期（状态已变化） */
export type VehicleFreshnessCheck =
  | { outcome: 'ok'; fresh: VehicleRecordDto }
  | { outcome: 'missing' }
  | { outcome: 'stale'; fresh: VehicleRecordDto }

/** 核验查询页大小：query 模糊命中行可能多于目标一行，取较大页容错 */
const VERIFY_PAGE_SIZE = 100

export async function verifyVehicleFresh(
  vehicleKey: string,
  snapshot: VehicleRecordDto,
  options?: RequestOptions,
): Promise<VehicleFreshnessCheck> {
  const page = await pageVehicles(
    { pageNo: 1, pageSize: VERIFY_PAGE_SIZE, query: vehicleKey },
    options,
  )
  const fresh = (page.records ?? []).find((record) => record.key === vehicleKey)
  if (!fresh) {
    return { outcome: 'missing' }
  }
  // 关键控制相关字段与快照不一致即视为过期（不做业务推断，只比对协议值）
  if (
    fresh.dispatchState !== snapshot.dispatchState ||
    fresh.connectionState !== snapshot.connectionState
  ) {
    return { outcome: 'stale', fresh }
  }
  return { outcome: 'ok', fresh }
}
