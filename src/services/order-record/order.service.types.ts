/**
 * 任务域请求/响应 DTO：调度后端返回 code envelope + MyBatis-Plus 风格分页
 * （records/total/size/current/pages），与站点后台协议（无 envelope）不同，
 * 由 service 层负责解包并转换为 PageResult。
 */

import type { OrderEntity, OrderState, OrderType } from '@/types/order-record/order.types'

/** 任务记录 DTO（字段与 OrderEntity 同构） */
export type OrderRecordDto = OrderEntity

/** 调度后端分页数据体 */
export interface OrderPageDataDto {
  records: OrderRecordDto[]
  total: number
  size: number
  current: number
  pages: number
}

/** 调度后端 code envelope 响应 */
export interface OrderPageEnvelopeDto {
  code: number
  message: string
  timestamp: number
  data: OrderPageDataDto
}

/** 任务列表查询条件 */
export interface OrderListQuery {
  page: number
  pageSize: number
  /** 关键字：模糊匹配 orderName / orderKey / taskId */
  keyword?: string
  orderType?: OrderType
  orderState?: OrderState
  /** 执行车辆名（模糊匹配） */
  executeVehicleName?: string
  /** 创建时间范围（含），格式 YYYY-MM-DD HH:mm:ss */
  createdStart?: string
  createdEnd?: string
}
