/**
 * 任务工艺模板管理服务（P20 整页重写交付；owner 归 P20，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/dispatcher/orderTemplate/pageOrderTemplates   分页查询
 *   （GET query 对象平铺 {pageNo,pageSize,query}，G04 口径；query=模板名称或编号）
 * - POST /fms/v1/dispatcher/orderTemplate/createOrderTemplate  创建（body=OrderTemplateParam）
 * - POST /fms/v1/dispatcher/orderTemplate/updateOrderTemplate  编辑（body=OrderTemplateUpdateParam，
 *   int64 id 定位整模板替换；旧实现 getFieldsValue(true) 全量提交，本服务按
 *   OpenAPI 显式组装提交所需字段，行为等价——后端只消费这些字段）
 * - POST /fms/v1/dispatcher/orderTemplate/deleteOrderTemplate  删除（body={orderTemplateKey}，
 *   按调度 key 定位，旧实现同形态；注意与 P23/P24 按 int64 id 定位不同族）
 *
 * 不落地 operation（只迁当前来源可达控制，P16/P18/P22/P23/P24 同口径）：
 * - GET /fms/v1/dispatcher/orderTemplate/getOrderTemplates：旧任务工艺页零消费者，
 *   新仓库已由 P03 代建共享选项服务（order-template.service，fetchOrderTemplates）；
 * - POST /fms/v1/dispatcher/orderTemplate/createOrderRecords：旧任务工艺页零
 *   消费者（属订单执行链路，非本页配置管理范围）。
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 增改删为配置类写操作：确认与防重复提交由页面负责，本层不做自动重试。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  TemplateCreateParamDto,
  TemplateDeleteParamDto,
  TemplatePageDto,
  TemplatePageParam,
  TemplateRowDto,
  TemplateUpdateParamDto,
} from '@/services/order-template/order-template-manage.service.types'

/** 任务工艺模板控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const ORDER_TEMPLATE_BASE = '/dispatcher/orderTemplate'

/** 分页查询任务工艺模板：pageNo 从 1 计数（页面用 toBackendPage 换算；G04 平铺口径） */
export async function pageOrderTemplates(
  params: TemplatePageParam,
  options?: RequestOptions,
): Promise<TemplatePageDto> {
  return api.get<TemplatePageDto>(`${ORDER_TEMPLATE_BASE}/pageOrderTemplates`, {
    params,
    signal: options?.signal,
  })
}

/** 创建任务工艺模板（body=OrderTemplateParam，车辆与车辆分组互斥二选一） */
export async function createOrderTemplate(
  param: TemplateCreateParamDto,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${ORDER_TEMPLATE_BASE}/createOrderTemplate`, param, {
    signal: options?.signal,
  })
}

/** 编辑任务工艺模板（int64 id 定位整模板替换；子任务/动作/参数全量重提交） */
export async function updateOrderTemplate(
  param: TemplateUpdateParamDto,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${ORDER_TEMPLATE_BASE}/updateOrderTemplate`, param, {
    signal: options?.signal,
  })
}

/** 删除任务工艺模板（body 仅 {orderTemplateKey}，旧实现同形态） */
export async function deleteOrderTemplate(
  param: TemplateDeleteParamDto,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${ORDER_TEMPLATE_BASE}/deleteOrderTemplate`, param, {
    signal: options?.signal,
  })
}

/** 供弹窗回显兜底：单模板行结构即分页行结构（本页直接消费分页行数据，不单独请求详情） */
export type { TemplateRowDto }
