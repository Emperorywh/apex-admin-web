/**
 * 动作分组管理服务（P24 整页重写交付；owner 归 P24，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/action/agvActionGroup/pageAGVActionGroups   分页查询（query 平铺）
 * - POST /fms/v1/action/agvActionGroup/addAGVActionGroup     创建（body=AGVActionGroupParam）
 * - POST /fms/v1/action/agvActionGroup/updateAGVActionGroup  编辑（int64 id 定位，整组提交：
 *   名称 + 动作 id 集合；列表拖拽重排与弹窗编辑共用本 operation，旧实现同形态）
 * - POST /fms/v1/action/agvActionGroup/deleteAGVActionGroup  删除（body=AGVActionGroupParam，
 *   旧实现仅提交 {id}，本服务同形态）
 *
 * 不落地 operation（只迁当前来源可达控制，P16/P18/P22/P23 同口径）：
 * - GET /fms/v1/action/agvActionGroup/getAGVActionGroups：旧动作分组页零消费者；
 *   新仓库已由 P03 代建共享选项服务（services/action/agv-action.service，
 *   fetchAGVActionGroups 供创建任务按组消费），本服务不重复落地。
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 增改删为配置类写操作：确认与防重复提交由页面负责，本层不做自动重试。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  AgvActionGroupPageDto,
  AgvActionGroupPageParam,
  AgvActionGroupParamDto,
} from '@/services/action/agv-action-group-manage.service.types'

/** 动作分组控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const AGV_ACTION_GROUP_BASE = '/action/agvActionGroup'

/** 分页查询动作分组：pageNo 从 1 计数（页面用 toBackendPage 换算；G04 平铺口径） */
export async function pageAgvActionGroups(
  params: AgvActionGroupPageParam,
  options?: RequestOptions,
): Promise<AgvActionGroupPageDto> {
  return api.get<AgvActionGroupPageDto>(`${AGV_ACTION_GROUP_BASE}/pageAGVActionGroups`, {
    params,
    signal: options?.signal,
  })
}

/** 创建动作分组（名称 + 组内动作 id 集合，业务校验在页面表单） */
export async function addAgvActionGroup(
  params: AgvActionGroupParamDto,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AGV_ACTION_GROUP_BASE}/addAGVActionGroup`, params, {
    signal: options?.signal,
  })
}

/** 编辑动作分组（按 int64 主键 id 定位整组提交——旧实现 getFieldsValue(true)
 * 全量提交同边界；列表拖拽重排同走本 operation，协议语义页面照实提交） */
export async function updateAgvActionGroup(
  params: AgvActionGroupParamDto,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AGV_ACTION_GROUP_BASE}/updateAGVActionGroup`, params, {
    signal: options?.signal,
  })
}

/** 删除动作分组（OpenAPI body=AGVActionGroupParam；旧实现仅提交 {id}，本服务同形态；
 * 破坏性操作，页面确认后调用） */
export async function deleteAgvActionGroup(
  params: AgvActionGroupParamDto,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AGV_ACTION_GROUP_BASE}/deleteAGVActionGroup`, params, {
    signal: options?.signal,
  })
}
