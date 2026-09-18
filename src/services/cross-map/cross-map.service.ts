/**
 * 跨地图关联服务（P10 整页重写交付；owner 归 P10，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/dispatcher/crossMap/pageCrossMaps      跨地图关联分页（query 平铺）
 * - POST /fms/v1/dispatcher/crossMap/createCrossMap     创建跨地图关联
 * - POST /fms/v1/dispatcher/crossMap/updateCrossMap     编辑跨地图关联（id 定位）
 * - POST /fms/v1/dispatcher/crossMap/deleteCrossMap     删除跨地图关联（id 定位）
 * - GET  /fms/v1/dispatcher/crossMap/getCrossMapStations 指定地图的跨地图站点选项
 * - GET  /fms/v1/device/elevator/getElevators           电梯选项全量（contracts 第 88 行
 *   登记 owner=P10，服务随 P10 落地；P14 电梯管理页另行落地自己的页面服务）
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 站点/电梯选项只做结构校验与缺标识条目过滤（无标识选项无法回显引用，
 *   静默保留会产出无法提交的选择值），不做业务加工；
 * - 增改删为配置类写操作：确认与防重复提交由页面负责，本层不做自动重试。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  CrossMapCreateParam,
  CrossMapDeleteParam,
  CrossMapPageDto,
  CrossMapPageParam,
  CrossMapUpdateParam,
  ElevatorOptionDto,
  SimpleStationDto,
} from '@/services/cross-map/cross-map.service.types'

/** 跨地图关联控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const CROSS_MAP_BASE = '/dispatcher/crossMap'
/** 电梯控制器统一前缀 */
const ELEVATOR_BASE = '/device/elevator'

/** 跨地图关联分页查询：pageNo 从 1 计数（页面用 toBackendPage 从零基 pageIndex 换算） */
export async function pageCrossMaps(
  params: CrossMapPageParam,
  options?: RequestOptions,
): Promise<CrossMapPageDto> {
  return api.get<CrossMapPageDto>(`${CROSS_MAP_BASE}/pageCrossMaps`, {
    params,
    signal: options?.signal,
  })
}

/** 创建跨地图关联（名称 + 电梯 + 至少两条地图-节点对，业务校验在页面表单） */
export async function createCrossMap(
  params: CrossMapCreateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${CROSS_MAP_BASE}/createCrossMap`, params, {
    signal: options?.signal,
  })
}

/** 编辑跨地图关联（按 id 定位；crossMaps 集合整体替换——协议语义，页面照实提交） */
export async function updateCrossMap(
  params: CrossMapUpdateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${CROSS_MAP_BASE}/updateCrossMap`, params, {
    signal: options?.signal,
  })
}

/** 删除跨地图关联（按 id 定位；破坏性操作，页面确认后调用） */
export async function deleteCrossMap(
  params: CrossMapDeleteParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${CROSS_MAP_BASE}/deleteCrossMap`, params, {
    signal: options?.signal,
  })
}

/**
 * 拉取指定地图下的跨地图站点选项（GET query 平铺）。
 * - mapId 必填：站点集合按地图隔离，缺参请求无业务语义，直接抛出定位调用方；
 * - 过滤掉缺 id 的条目（同 fetchSimpleMaps 纪律）；消费方（关联行）按行独立
 *   加载并防乱序，本服务只做单次查询。
 */
export async function fetchCrossMapStations(
  mapId: string,
  options?: RequestOptions,
): Promise<SimpleStationDto[]> {
  if (!mapId) {
    throw new Error('fetchCrossMapStations 需要有效的 mapId')
  }
  const list = await api.get<SimpleStationDto[]>(`${CROSS_MAP_BASE}/getCrossMapStations`, {
    params: { mapId },
    signal: options?.signal,
  })
  if (!Array.isArray(list)) {
    throw new Error('跨地图站点选项响应结构异常（期望数组）')
  }
  return list.filter((item) => typeof item?.id === 'string' && item.id !== '')
}

/**
 * 拉取电梯选项全量（GET 无参；跨地图关联的「跨地图电梯」下拉数据源）。
 * 过滤掉缺 deviceKey 的条目：没有 key 的电梯无法作为选项值提交或回显。
 */
export async function fetchElevatorOptions(
  options?: RequestOptions,
): Promise<ElevatorOptionDto[]> {
  const list = await api.get<ElevatorOptionDto[]>(`${ELEVATOR_BASE}/getElevators`, {
    signal: options?.signal,
  })
  if (!Array.isArray(list)) {
    throw new Error('电梯选项响应结构异常（期望数组）')
  }
  return list.filter((item) => typeof item?.deviceKey === 'string' && item.deviceKey !== '')
}
