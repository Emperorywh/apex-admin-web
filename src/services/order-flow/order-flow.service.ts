/**
 * 工艺管理（订单工艺）服务（P21 整页重写交付；owner=P21，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/dispatcher/orderFlow/pageOrderFlows        分页查询
 *   （GET query 对象平铺 {pageNo,pageSize,query}，G04 口径；query=工艺名称模糊）
 * - POST /fms/v1/dispatcher/orderFlow/createOrderFlow       创建（body=OrderFlowParam）
 * - POST /fms/v1/dispatcher/orderFlow/orderFlowOperation    主工艺控制
 *   （body={id,operation}，operation=PAUSE|CONTINUE|CANCEL，int64 id 定位）
 * - POST /fms/v1/dispatcher/orderFlow/subOrderFlowOperation 子工艺控制
 *   （body 同主工艺 OperationParam，id=子工艺数据库 id）
 *
 * 模板选项 getOrderTemplates 不在本服务：P03 已代建共享选项服务
 * （services/order-template/order-template.service fetchOrderTemplates），
 * 本页弹窗按 contracts 第 5 节共享行直接消费，不复制请求。
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 控制命令为调度写命令：确认（confirmCommand）与防重复提交由页面负责，
 *   本层不做自动重试（G13：不承诺强一致，结果以列表刷新后的真实状态为准）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  OrderFlowCreateParam,
  OrderFlowOperationParam,
  OrderFlowPageDto,
  OrderFlowPageParam,
} from '@/services/order-flow/order-flow.service.types'

/** 订单工艺控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const ORDER_FLOW_BASE = '/dispatcher/orderFlow'

/** 分页查询工艺列表：pageNo 从 1 计数（页面用 toBackendPage 换算；G04 平铺口径） */
export async function pageOrderFlows(
  params: OrderFlowPageParam,
  options?: RequestOptions,
): Promise<OrderFlowPageDto> {
  return api.get<OrderFlowPageDto>(`${ORDER_FLOW_BASE}/pageOrderFlows`, {
    params,
    signal: options?.signal,
  })
}

/** 创建工艺（重发工艺=按行回显后走同一创建接口，旧实现同语义） */
export async function createOrderFlow(
  param: OrderFlowCreateParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${ORDER_FLOW_BASE}/createOrderFlow`, param, {
    signal: options?.signal,
  })
}

/** 主工艺控制命令（PAUSE=暂停 / CONTINUE=继续 / CANCEL=取消） */
export async function orderFlowOperation(
  param: OrderFlowOperationParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${ORDER_FLOW_BASE}/orderFlowOperation`, param, {
    signal: options?.signal,
  })
}

/** 子工艺控制命令（body 与主工艺同形，id=子工艺数据库 id） */
export async function subOrderFlowOperation(
  param: OrderFlowOperationParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${ORDER_FLOW_BASE}/subOrderFlowOperation`, param, {
    signal: options?.signal,
  })
}
