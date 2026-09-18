/**
 * 工艺模板共享选项服务（contracts.md 第 5 节唯一 operation 登记：owner=P03）。
 *
 * GET /fms/v1/dispatcher/orderTemplate/getOrderTemplates：全量工艺模板选项。
 * 旧系统 OrderRecord 可达链不含快捷创建（QuickCreateOrderModal 仅被暂缓页
 * Overlook/ForceGraph 引用，随 H01 暂缓），本服务按 T00 冻结契约交付只读查询，
 * 供 P20 任务工艺 / P21 工艺管理页面任务直接消费，避免届时复制请求。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { OrderTemplateDto } from '@/services/order-template/order-template.service.types'

/** 拉取工艺模板选项列表（全量） */
export async function fetchOrderTemplates(options?: RequestOptions): Promise<OrderTemplateDto[]> {
  const list = await api.get<OrderTemplateDto[]>('/dispatcher/orderTemplate/getOrderTemplates', {
    signal: options?.signal,
  })
  if (!Array.isArray(list)) {
    throw new Error('工艺模板选项响应结构异常（期望数组）')
  }
  // 过滤缺模板 key 的条目：无标识模板无法作为选项值提交或回显
  return list.filter((item) => typeof item?.orderTemplateKey === 'string' && item.orderTemplateKey !== '')
}
