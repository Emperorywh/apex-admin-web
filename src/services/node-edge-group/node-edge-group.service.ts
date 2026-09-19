/**
 * 多地图点边组合服务（P11 整页重写交付；owner 归 P11，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/dispatcher/systemNodeEdgeGroup/pageSystemNodeEdgeGroups      分页查询
 * - POST /fms/v1/dispatcher/systemNodeEdgeGroup/createSystemNodeEdgeGroup     创建
 * - POST /fms/v1/dispatcher/systemNodeEdgeGroup/updateSystemNodeEdgeGroup     编辑（id 定位）
 * - POST /fms/v1/dispatcher/systemNodeEdgeGroup/deleteSystemNodeEdgeGroup     删除（id 定位）
 * - GET  /fms/v1/dispatcher/systemNodeEdgeGroup/getAllSimpleNodeEdgeGroups    全部地图的
 *        点边组合选项（弹窗穿梭框数据源；页面私有消费，owner=P11）
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 选项只做结构校验与缺标识条目过滤（无 id 的选项无法作为提交值或回显引用，
 *   静默保留会产出无法提交的选择值），不做业务加工；
 * - 增改删为配置类写操作：确认与防重复提交由页面负责，本层不做自动重试。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  SimpleNodeEdgeGroupOptionDto,
  SystemNodeEdgeGroupCreateParam,
  SystemNodeEdgeGroupDeleteParam,
  SystemNodeEdgeGroupPageDto,
  SystemNodeEdgeGroupPageParam,
  SystemNodeEdgeGroupUpdateParam,
} from '@/services/node-edge-group/node-edge-group.service.types'

/** 多地图点边组合控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const NODE_EDGE_GROUP_BASE = '/dispatcher/systemNodeEdgeGroup'

/** 分页查询多地图点边组合：pageNo 从 1 计数（页面用 toBackendPage 换算） */
export async function pageSystemNodeEdgeGroups(
  params: SystemNodeEdgeGroupPageParam,
  options?: RequestOptions,
): Promise<SystemNodeEdgeGroupPageDto> {
  return api.get<SystemNodeEdgeGroupPageDto>(
    `${NODE_EDGE_GROUP_BASE}/pageSystemNodeEdgeGroups`,
    {
      params,
      signal: options?.signal,
    },
  )
}

/** 创建多地图点边组合（名称 + 至少一个点边组合 id，业务校验在页面表单） */
export async function createSystemNodeEdgeGroup(
  params: SystemNodeEdgeGroupCreateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${NODE_EDGE_GROUP_BASE}/createSystemNodeEdgeGroup`, params, {
    signal: options?.signal,
  })
}

/** 编辑多地图点边组合（按 id 定位；mapNodeEdgeGroupIds 整体替换——协议语义页面照实提交） */
export async function updateSystemNodeEdgeGroup(
  params: SystemNodeEdgeGroupUpdateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${NODE_EDGE_GROUP_BASE}/updateSystemNodeEdgeGroup`, params, {
    signal: options?.signal,
  })
}

/** 删除多地图点边组合（按 id 定位；破坏性操作，页面确认后调用） */
export async function deleteSystemNodeEdgeGroup(
  params: SystemNodeEdgeGroupDeleteParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${NODE_EDGE_GROUP_BASE}/deleteSystemNodeEdgeGroup`, params, {
    signal: options?.signal,
  })
}

/**
 * 拉取全部地图的点边组合选项（GET 无参；弹窗穿梭框数据源）。
 * 过滤掉缺 id 的条目：没有 id 的点边组合无法作为选项值提交或回显引用。
 */
export async function fetchAllSimpleNodeEdgeGroups(
  options?: RequestOptions,
): Promise<SimpleNodeEdgeGroupOptionDto[]> {
  const list = await api.get<SimpleNodeEdgeGroupOptionDto[]>(
    `${NODE_EDGE_GROUP_BASE}/getAllSimpleNodeEdgeGroups`,
    {
      signal: options?.signal,
    },
  )
  if (!Array.isArray(list)) {
    throw new Error('点边组合选项响应结构异常（期望数组）')
  }
  return list.filter((item) => typeof item?.id === 'string' && item.id !== '')
}
