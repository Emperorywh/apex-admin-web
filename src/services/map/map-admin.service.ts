/**
 * 地图管理服务（P09 整页重写交付；owner 归 P09，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/dispatcher/map/pageMapInfos            地图分页（query 平铺）
 * - POST /fms/v1/dispatcher/map/createMap               创建地图
 * - POST /fms/v1/dispatcher/map/updateMap               编辑地图（mapKey 定位）
 * - POST /fms/v1/dispatcher/map/deleteMap               删除地图（mapId 定位）
 * - POST /fms/v1/dispatcher/map/uploadMap               导入调度地图（.zip）
 * - POST /fms/v1/dispatcher/map/uploadVehicleMap        导入车载地图（.bin）
 * - POST /fms/v1/dispatcher/map/downloadMap             下载地图版本文件（Blob）
 * - GET  /fms/v1/dispatcher/mapVersion/pageMapInfoVersions   版本分页（query 平铺）
 * - POST /fms/v1/dispatcher/mapVersion/publishMapInfoVersion 发布版本
 * - POST /fms/v1/dispatcher/mapVersion/pushMapInfoVersion    推送版本到车辆
 *
 * 协议纪律：
 * - 旧实现 downloadMapInfo（拉取地图）不在 OpenAPI：缺口 G07，本层不提供该
 *   operation，也不得用 downloadMap/vehicleDownloadMap 猜替其语义（页面保留
 *   禁用入口并说明原因）；upLoadMap/updateMapResource（G08 未声明路径）同样不迁移；
 * - 上传（G05）：OpenAPI 把请求体声明为 application/json 内 binary 字段，
 *   旧实现真实行为是 multipart/form-data、字段名 file——本层按旧实现适配
 *   （与 P08 告警码上传同形态），真实媒体类型以带令牌联验抓包实证为准；
 * - 下载：POST JSON 请求体 + Blob 通道（api.downloadPost），JSON 业务错误仍走
 *   统一解包收敛（绝不把错误 JSON 保存为伪文件，DoD 9）；
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 发布/推送是影响在线地图与车辆的命令类写操作：确认与防重复提交由页面负责，
 *   本层不做自动重试（成功响应仅代表后端受理，推送最终结果由推送记录核实）。
 */

import { api, resolveDownloadFilename } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  MapCreateParam,
  MapDeleteParam,
  MapPageDto,
  MapPageParam,
  MapUpdateParam,
  MapVersionPageDto,
  MapVersionPageParam,
  MapVersionPublishParam,
  MapVersionPushParam,
} from '@/services/map/map-admin.service.types'

/** 地图控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const MAP_BASE = '/dispatcher/map'
/** 地图版本控制器统一前缀 */
const VERSION_BASE = '/dispatcher/mapVersion'

/** 地图分页查询：pageNo 从 1 计数（页面用 toBackendPage 从零基 pageIndex 换算） */
export async function pageMaps(
  params: MapPageParam,
  options?: RequestOptions,
): Promise<MapPageDto> {
  return api.get<MapPageDto>(`${MAP_BASE}/pageMapInfos`, {
    params,
    signal: options?.signal,
  })
}

/** 创建地图（名称/状态/楼层） */
export async function createMap(
  params: MapCreateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${MAP_BASE}/createMap`, params, {
    signal: options?.signal,
  })
}

/** 编辑地图（mapKey 定位；状态与楼层全量提交，名称不在编辑参数内——旧实现同形态） */
export async function updateMap(
  params: MapUpdateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${MAP_BASE}/updateMap`, params, {
    signal: options?.signal,
  })
}

/** 删除地图（按 mapId 字符串定位；破坏性操作，页面确认后调用） */
export async function deleteMap(
  params: MapDeleteParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${MAP_BASE}/deleteMap`, params, {
    signal: options?.signal,
  })
}

/**
 * 导入调度地图（.zip 压缩包）：multipart/form-data、字段名 file（旧实现同形态）。
 * 文件类型校验由页面完成，本层只负责真实传输；onUploadProgress 供传输管理器
 * 回报真实字节进度（G11：仅真实进度，不伪造）。
 */
export async function uploadDispatcherMapFile(
  file: File,
  onUploadProgress: (event: { loaded: number; total?: number | null }) => void,
  options?: RequestOptions,
): Promise<unknown> {
  const formData = new FormData()
  formData.append('file', file)
  return api.post<unknown>(`${MAP_BASE}/uploadMap`, formData, {
    signal: options?.signal,
    // multipart 边界由 axios 按 FormData 自动生成，此处不手动设置 Content-Type
    onUploadProgress,
  })
}

/** 导入车载地图（.bin 固件包）：multipart 通道同上 */
export async function uploadVehicleMapFile(
  file: File,
  onUploadProgress: (event: { loaded: number; total?: number | null }) => void,
  options?: RequestOptions,
): Promise<unknown> {
  const formData = new FormData()
  formData.append('file', file)
  return api.post<unknown>(`${MAP_BASE}/uploadVehicleMap`, formData, {
    signal: options?.signal,
    onUploadProgress,
  })
}

/** 地图版本分页查询（按 mapId 隔离；pageNo 从 1 计数） */
export async function pageMapVersions(
  params: MapVersionPageParam,
  options?: RequestOptions,
): Promise<MapVersionPageDto> {
  return api.get<MapVersionPageDto>(`${VERSION_BASE}/pageMapInfoVersions`, {
    params,
    signal: options?.signal,
  })
}

/** 发布地图版本（发布后替换当前线上地图数据；页面确认后调用） */
export async function publishMapVersion(
  params: MapVersionPublishParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${VERSION_BASE}/publishMapInfoVersion`, params, {
    signal: options?.signal,
  })
}

/** 推送地图版本到车辆集合（命令受理 ≠ 车辆已生效，最终结果由推送记录核实） */
export async function pushMapVersion(
  params: MapVersionPushParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${VERSION_BASE}/pushMapInfoVersion`, params, {
    signal: options?.signal,
  })
}

/** 下载地图版本压缩包：POST JSON 请求体 + Blob；返回 Blob 与解析后的文件名（取不到为 null） */
export async function downloadMapFile(
  mapInfoVersionId: number,
  options?: RequestOptions,
): Promise<{ blob: Blob; filename: string | null }> {
  const response = await api.downloadPost(
    `${MAP_BASE}/downloadMap`,
    { mapInfoVersionId },
    {
      signal: options?.signal,
    },
  )
  return {
    blob: response.data,
    // 文件名解析统一走请求层工具（RFC 5987 优先，规格 10.6）
    filename: resolveDownloadFilename(response.headers?.['content-disposition']),
  }
}
