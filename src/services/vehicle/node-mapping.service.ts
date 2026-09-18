/**
 * AGV 节点映射服务（P07 整页重写交付；owner 归 P07，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 清单与旧实现，method/path/参数形态一致）：
 * - GET  /fms/v1/dispatcher/agvNodeMapping/pageAGVNodeMapping               分页查询（query）
 * - POST /fms/v1/dispatcher/agvNodeMapping/saveAGVNodeMapping               新增（body）
 * - POST /fms/v1/dispatcher/agvNodeMapping/updateAGVNodeMapping             编辑（body，整体替换语义）
 * - POST /fms/v1/dispatcher/agvNodeMapping/deleteAGVNodeMapping             删除（body，mappingKey 定位）
 * - GET  /fms/v1/dispatcher/agvNodeMapping/getSuggestionsForCollectionNodes 采集点位建议（query）
 *
 * 协议纪律：
 * - 分页/建议是 GET+query，增删改是 POST+JSON 请求体，形态与旧实现一致；
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 全部函数接收 RequestOptions.signal，取消语义与请求层一致；
 * - 增删改是影响调度配置的写操作：确认对象与影响、防重复提交由页面负责，
 *   本层不做自动重试（成功响应仅代表后端受理）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  AgvNodeMappingDeleteParam,
  AgvNodeMappingPageDto,
  AgvNodeMappingPageParam,
  AgvNodeMappingSaveParam,
  AgvNodeMappingUpdateParam,
  CollectionNodeSuggestionDto,
  CollectionNodeSuggestionParam,
} from '@/services/vehicle/node-mapping.service.types'

/** 节点映射分页查询：pageNo 从 1 计数（页面用 toBackendPage 从零基 pageIndex 换算） */
export async function pageAgvNodeMappings(
  params: AgvNodeMappingPageParam,
  options?: RequestOptions,
): Promise<AgvNodeMappingPageDto> {
  return api.get<AgvNodeMappingPageDto>('/dispatcher/agvNodeMapping/pageAGVNodeMapping', {
    params,
    signal: options?.signal,
  })
}

/** 新增节点映射：成功仅代表后端受理（页面提交成功后自行刷新列表） */
export async function saveAgvNodeMapping(
  params: AgvNodeMappingSaveParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/agvNodeMapping/saveAGVNodeMapping', params, {
    signal: options?.signal,
  })
}

/** 编辑节点映射（mappingKey 定位；全量分组结构整体替换） */
export async function updateAgvNodeMapping(
  params: AgvNodeMappingUpdateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/agvNodeMapping/updateAGVNodeMapping', params, {
    signal: options?.signal,
  })
}

/** 删除节点映射（按 mappingKey；破坏性操作，页面确认后调用） */
export async function deleteAgvNodeMapping(
  params: AgvNodeMappingDeleteParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>('/dispatcher/agvNodeMapping/deleteAGVNodeMapping', params, {
    signal: options?.signal,
  })
}

/**
 * 获取采集点位建议。mapId 缺省视为调用方编程错误（直接抛出，不发无参请求）；
 * expectedCount 仅在有值时随 query 传递（后端自动预算）。
 */
export async function fetchCollectionNodeSuggestions(
  params: CollectionNodeSuggestionParam,
  options?: RequestOptions,
): Promise<CollectionNodeSuggestionDto> {
  if (!params.mapId) {
    throw new Error('fetchCollectionNodeSuggestions 需要有效的 mapId')
  }
  return api.get<CollectionNodeSuggestionDto>(
    '/dispatcher/agvNodeMapping/getSuggestionsForCollectionNodes',
    {
      params: {
        mapId: params.mapId,
        ...(params.expectedCount ? { expectedCount: params.expectedCount } : {}),
      },
      signal: options?.signal,
    },
  )
}
