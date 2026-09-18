/**
 * 任务管理服务（P03 重写：模板 mock 实现删除，接入真实调度接口）。
 *
 * 接口族（逐 operation 核对 OpenAPI，method/path/字段与文档一致）：
 * - GET  /fms/v1/dispatcher/orderRecord/pageOrderRecords        列表分页
 * - GET  /fms/v1/dispatcher/orderRecord/orderRecordStateStatistic 状态统计
 * - GET  /fms/v1/dispatcher/orderRecord/exportOrderRecords      导出 Excel（文件通道）
 * - POST /fms/v1/dispatcher/orderRecord/createOrderRecord       创建任务
 * - POST /fms/v1/dispatcher/orderRecord/getOrderRecordDetail    详情（mission 分页）
 * - POST /fms/v1/dispatcher/orderTask/orderTaskOperate          任务操作（取消/移队列/跳过/继续）
 * - POST /fms/v1/dispatcher/orderTask/mockDispatch              模拟分配（真实仿真）
 *
 * 协议纪律：
 * - 响应解包/业务码/取消/健康反馈统一由请求层完成，本层不重复处理；
 * - GET 查询参数按对象 DTO 字段平铺为 query（旧系统同后端实证行为；
 *   文档将其声明为单个对象参数，真实序列化差异登记 G04 联调核实）；
 * - 全部函数接收 RequestOptions.signal，取消语义与请求层一致；
 * - 写操作（创建/操作/模拟分配）由页面防重复提交，本层不做自动重试。
 */

import { api, resolveDownloadFilename } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  CreateOrderRecordParam,
  DispatcherStatusCode,
  MockDispatchParam,
  OrderRecordDetailDto,
  OrderRecordDetailParam,
  OrderRecordPage,
  OrderRecordPageParam,
  OrderRecordStateStatisticDto,
  OrderTaskOperateParam,
} from '@/services/order-record/order.service.types'

/** 列表查询：pageNo 从 1 计数（页面用 toBackendPage 从零基 pageIndex 换算） */
export async function pageOrderRecords(
  params: OrderRecordPageParam,
  options?: RequestOptions,
): Promise<OrderRecordPage> {
  return api.get<OrderRecordPage>('/dispatcher/orderRecord/pageOrderRecords', {
    params,
    signal: options?.signal,
  })
}

/** 状态统计：七个状态计数一次返回（实时轮询与手动刷新共用） */
export async function fetchOrderRecordStateStatistic(
  options?: RequestOptions,
): Promise<OrderRecordStateStatisticDto> {
  return api.get<OrderRecordStateStatisticDto>(
    '/dispatcher/orderRecord/orderRecordStateStatistic',
    { signal: options?.signal },
  )
}

/** 导出查询参数：与列表共用筛选口径，但不携带分页（导出为全量筛选结果） */
export type OrderRecordsExportParam = Omit<OrderRecordPageParam, 'pageNo' | 'pageSize'>

/** 导出下载结果：Blob + 服务端文件名（取不到时由调用方回退默认名） */
export interface OrderRecordsExport {
  blob: Blob
  filename: string | null
}

/**
 * 导出订单记录 Excel：沿用列表查询参数（后端按同一 DTO 过滤与数据范围执行）。
 * 走请求层文件下载通道（downloadGet）：JSON 错误仍按统一协议抛 ApiError，
 * 成功时从 content-disposition 解析服务端文件名（RFC 5987 优先）。
 */
export async function exportOrderRecords(
  params: OrderRecordsExportParam,
  options?: RequestOptions,
): Promise<OrderRecordsExport> {
  const response = await api.downloadGet('/dispatcher/orderRecord/exportOrderRecords', {
    ...(params as unknown as Record<string, unknown>),
  }, { signal: options?.signal })
  return {
    blob: response.data,
    filename: resolveDownloadFilename(response.headers?.['content-disposition']),
  }
}

/** 创建任务：成功返回 data（后端语义为提示性字符串，通常为 null） */
export async function createOrderRecord(
  params: CreateOrderRecordParam,
  options?: RequestOptions,
): Promise<string | null> {
  return api.post<string | null>('/dispatcher/orderRecord/createOrderRecord', params, {
    signal: options?.signal,
  })
}

/** 任务详情：主体信息 + 子任务分页（详情弹窗主体与子任务表格共用一次请求） */
export async function getOrderRecordDetail(
  params: OrderRecordDetailParam,
  options?: RequestOptions,
): Promise<OrderRecordDetailDto> {
  return api.post<OrderRecordDetailDto>('/dispatcher/orderRecord/getOrderRecordDetail', params, {
    signal: options?.signal,
  })
}

/**
 * 任务操作（取消/移出队列/移入队列/跳过/继续）。
 * 返回调度状态码：null=命令已接受；非空=调度子系统业务拒绝（页面按拒绝呈现，
 * 文案映射见 DISPATCHER_STATUS_TEXT，未知码显示原值，不当成功处理）。
 */
export async function operateOrderTask(
  params: OrderTaskOperateParam,
  options?: RequestOptions,
): Promise<DispatcherStatusCode | null> {
  return api.post<DispatcherStatusCode | null>('/dispatcher/orderTask/orderTaskOperate', params, {
    signal: options?.signal,
  })
}

/** 模拟分配（真实仿真接口 mockDispatch，页面明确标注「仿真」） */
export async function mockDispatch(
  params: MockDispatchParam,
  options?: RequestOptions,
): Promise<string | null> {
  return api.post<string | null>('/dispatcher/orderTask/mockDispatch', params, {
    signal: options?.signal,
  })
}
