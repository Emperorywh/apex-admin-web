/**
 * 车辆告警码服务（P08 整页重写交付；owner 归 P08，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/dispatcher/vehicleAlarmCode/pageVehicleAlarmCodes    分页查询（query 平铺）
 * - POST /fms/v1/dispatcher/vehicleAlarmCode/addVehicleAlarmCode      新增告警码
 * - POST /fms/v1/dispatcher/vehicleAlarmCode/updateVehicleAlarmCode   编辑告警码（id 定位）
 * - POST /fms/v1/dispatcher/vehicleAlarmCode/deleteVehicleAlarmCode   删除告警码（alarmCode 定位）
 * - POST /fms/v1/dispatcher/vehicleAlarmCode/uploadVehicleAlarmCodeFile 上传告警码文件（全量覆盖）
 * - POST /fms/v1/dispatcher/vehicleAlarmCode/downVehicleAlarmCodeFile   下载告警码文件（Blob）
 *
 * 协议纪律：
 * - 分页与其他 vehicle 族一致为 GET+query 平铺（文档对象参数形态，G04 同款）；
 * - 上传（G05）：OpenAPI 把请求体声明为 application/json 内 binary 字段，
 *   旧实现真实行为是 multipart/form-data、字段名 file——本层按旧实现适配，
 *   真实媒体类型以带令牌联验抓包实证为准，不按文档猜测改写；
 * - 下载：POST 空请求体 {}（旧实现原样）+ Blob 通道，JSON 业务错误仍走统一
 *   解包收敛（绝不把错误 JSON 保存为伪文件，DoD 9）；
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 上传是全量覆盖写操作、增删改影响告警字典：确认对象与影响、防重复提交由
 *   页面负责，本层不做自动重试（成功响应仅代表后端受理）。
 */

import { api, resolveDownloadFilename } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  AlarmCodeAddParam,
  AlarmCodeDeleteParam,
  AlarmCodePage,
  AlarmCodePageParam,
  AlarmCodeRecord,
  AlarmCodeUpdateParam,
} from '@/services/vehicle/vehicle-alarm-code.service.types'

/** 车辆告警码控制器统一前缀（六 operation 共用；request 层 baseURL 已含 /fms/v1） */
const BASE = '/dispatcher/vehicleAlarmCode'

/** 告警码分页查询：pageNo 从 1 计数（页面用 toBackendPage 从零基 pageIndex 换算） */
export async function pageAlarmCodes(
  params: AlarmCodePageParam,
  options?: RequestOptions,
): Promise<AlarmCodePage> {
  return api.get<AlarmCodePage>(`${BASE}/pageVehicleAlarmCodes`, {
    params,
    signal: options?.signal,
  })
}

/** 新增告警码：多语言记录整体选填（空数组与缺省等价，按用户输入原样提交） */
export async function addAlarmCode(
  params: AlarmCodeAddParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${BASE}/addVehicleAlarmCode`, params, {
    signal: options?.signal,
  })
}

/** 编辑告警码（id 定位；告警码与多语言记录全量提交） */
export async function updateAlarmCode(
  params: AlarmCodeUpdateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${BASE}/updateVehicleAlarmCode`, params, {
    signal: options?.signal,
  })
}

/** 删除告警码（按告警码字符串定位；破坏性操作，页面确认后调用） */
export async function deleteAlarmCode(
  params: AlarmCodeDeleteParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${BASE}/deleteVehicleAlarmCode`, params, {
    signal: options?.signal,
  })
}

/**
 * 上传告警码文件（全量覆盖）：multipart/form-data、字段名 file（旧实现同形态）。
 * 文件类型校验（.xlsx/.xls）与二次确认由页面完成，本层只负责真实传输；
 * onUploadProgress 供传输管理器回报真实字节进度（G11：仅真实进度，不伪造）。
 */
export async function uploadAlarmCodeFile(
  file: File,
  onUploadProgress: (event: { loaded: number; total?: number | null }) => void,
  options?: RequestOptions,
): Promise<unknown> {
  const formData = new FormData()
  formData.append('file', file)
  return api.post<unknown>(`${BASE}/uploadVehicleAlarmCodeFile`, formData, {
    signal: options?.signal,
    // multipart 边界由 axios 按 FormData 自动生成，此处不手动设置 Content-Type
    onUploadProgress,
  })
}

/** 下载告警码文件：POST 空请求体 + Blob；返回 Blob 与解析后的文件名（取不到为 null） */
export async function downloadAlarmCodeFile(
  options?: RequestOptions,
): Promise<{ blob: Blob; filename: string | null }> {
  const response = await api.downloadPost(`${BASE}/downVehicleAlarmCodeFile`, {}, {
    signal: options?.signal,
  })
  return {
    blob: response.data,
    // 文件名解析统一走请求层工具（RFC 5987 优先，规格 10.6）
    filename: resolveDownloadFilename(response.headers?.['content-disposition']),
  }
}

/** 导出行记录类型（页面列定义消费；类型仅视图用途，不进协议） */
export type { AlarmCodeRecord }
