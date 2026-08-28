/**
 * 任务（订单）域跨层实体（页面、组件与 service 共用的 ViewModel）。
 */

import type { PageResult } from '@/services/request/request.types'

/** 任务类型 */
export type OrderType = 'WORK' | 'PARK'

/** 任务状态 */
export type OrderState = 'IN_QUEUE' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'HANG'

/** 任务实体（与调度后端 order 记录同构） */
export interface OrderEntity {
  id: number
  orderKey: string
  orderName: string
  orderType: OrderType
  taskId: string | null
  processKey: string | null
  appointVehicleKey: string | null
  appointVehicleName: string | null
  priority: number
  priorityAsc: number | null
  appointVehicleGroupKey: string | null
  appointVehicleGroupName: string | null
  extendParameters: unknown[]
  executeVehicleKey: string | null
  executeVehicleName: string | null
  orderState: OrderState
  executeTime: string | null
  finalTime: string | null
  hangReason: string
  cancelReason: string
  failReason: string
  createTime: string
  createUser: string
  updateTime: string
  updateUser: string
  orderMissions: unknown[]
}

/** 任务分页结果 */
export type OrderPage = PageResult<OrderEntity>
