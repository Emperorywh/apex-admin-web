/**
 * 地图只读查询服务（T00.7 共享地图能力，operation 已逐项核对 OpenAPI）。
 *
 * - GET /fms/v1/dispatcher/map/getMapInfo?mapId=...：按地图拉取节点/路径结构，
 *   供只读地图渲染与选点（P07/P10/P11 等）；响应 schema 未在文档定义，
 *   结构依据旧可达实现登记（见 map.service.types.ts），联调后如有差异集中适配；
 * - GET /fms/v1/dispatcher/map/getSimpleMaps：地图下拉选项（简单地图全量）；
 * - 地图元数据增改删、版本、发布推送（dispatcher/map 其余 operation）归 P09
 *   页面任务，不在本服务扩展；
 * - 结构异常（缺 currentMapInfoVersion/mapJson）按失败抛错，绝不返回空集合
 *   冒充成功（空地图仅在 mapJson 明确给出空数组时成立）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { MapGraph, MapJsonDto, SimpleMapDto } from '@/services/map/map.service.types'

/** getMapInfo 响应 data 的声明形状（文档未定义，按旧可达实现登记） */
interface MapInfoDataDto {
  currentMapInfoVersion?: {
    mapJson?: MapJsonDto
  }
}

/**
 * 拉取地图节点/路径结构。mapId 缺省视为调用方编程错误（直接抛出，
 * 不发无参请求）；加载/失败/取消语义由消费方 hook 或组件状态层负责。
 */
export async function fetchMapGraph(mapId: string, options?: RequestOptions): Promise<MapGraph> {
  if (!mapId) {
    throw new Error('fetchMapGraph 需要有效的 mapId')
  }
  const data = await api.get<MapInfoDataDto>('/dispatcher/map/getMapInfo', {
    params: { mapId },
    signal: options?.signal,
  })

  // 结构校验：currentMapInfoVersion / mapJson 缺失属于协议形状异常，
  // 与"真实空地图"严格区分——前者必须报错，不得渲染成空画布冒充成功
  const mapJson = data.currentMapInfoVersion?.mapJson
  if (!mapJson || typeof mapJson !== 'object') {
    throw new Error('地图数据结构异常（缺少 mapJson）')
  }

  const nodes = Array.isArray(mapJson.nodes) ? mapJson.nodes : []
  const edges = Array.isArray(mapJson.edges) ? mapJson.edges : []
  return { nodes, edges }
}

/**
 * 拉取简单地图信息列表（地图下拉选项，全量）。
 * 返回前过滤掉缺 mapId 的条目：没有标识的地图无法作为选项被引用，
 * 静默保留会让下游产出无法回显的选择值。
 */
export async function fetchSimpleMaps(options?: RequestOptions): Promise<SimpleMapDto[]> {
  const list = await api.get<SimpleMapDto[]>('/dispatcher/map/getSimpleMaps', {
    signal: options?.signal,
  })
  if (!Array.isArray(list)) {
    throw new Error('地图选项响应结构异常（期望数组）')
  }
  return list.filter((item) => typeof item?.mapId === 'string' && item.mapId !== '')
}
