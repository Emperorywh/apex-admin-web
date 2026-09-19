/**
 * 车辆动作管理服务（P23 整页重写交付；owner 归 P23，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/action/agvAction/pageAGVActions   分页查询（query 平铺）
 * - POST /fms/v1/action/agvAction/addAGVAction     创建（body=AGVActionParam）
 * - POST /fms/v1/action/agvAction/updateAGVAction  编辑（int64 id 定位，整体提交）
 * - POST /fms/v1/action/agvAction/deleteAGVAction  删除（body=AGVActionParam，
 *   旧实现仅提交 {id}，本服务同形态）
 *
 * 不落地 operation（只迁当前来源可达控制，P16/P18/P22 同口径）：
 * - GET /fms/v1/action/agvAction/getAGVActions：旧仓库无 UI 消费者；新仓库已由
 *   P03 代建共享选项服务（services/action/agv-action.service），本服务不重复落地；
 * - POST /fms/v1/action/agvAction/importExcel、GET exportExcel：旧仓库（含车辆
 *   动作页在内）零 UI 消费者，本页不可达，不落地（P23 交接记录登记核实结论）。
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 增改删为配置类写操作：确认与防重复提交由页面负责，本层不做自动重试。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  AgvActionPageDto,
  AgvActionPageParam,
  AgvActionParamDto,
} from '@/services/action/agv-action-manage.service.types'

/** 车辆动作控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const AGV_ACTION_BASE = '/action/agvAction'

/** 分页查询车辆动作：pageNo 从 1 计数（页面用 toBackendPage 换算；G04 平铺口径） */
export async function pageAgvActions(
  params: AgvActionPageParam,
  options?: RequestOptions,
): Promise<AgvActionPageDto> {
  return api.get<AgvActionPageDto>(`${AGV_ACTION_BASE}/pageAGVActions`, {
    params,
    signal: options?.signal,
  })
}

/** 创建车辆动作（表单四字段 + 参数集合，业务校验在页面表单） */
export async function addAgvAction(
  params: AgvActionParamDto,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AGV_ACTION_BASE}/addAGVAction`, params, {
    signal: options?.signal,
  })
}

/** 编辑车辆动作（按 int64 主键 id 定位整体提交——旧实现 getFieldsValue(true)
 * 全量提交同边界，协议语义页面照实提交） */
export async function updateAgvAction(
  params: AgvActionParamDto,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AGV_ACTION_BASE}/updateAGVAction`, params, {
    signal: options?.signal,
  })
}

/** 删除车辆动作（OpenAPI body=AGVActionParam；旧实现仅提交 {id}，本服务同形态；
 * 破坏性操作，页面确认后调用） */
export async function deleteAgvAction(
  params: AgvActionParamDto,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AGV_ACTION_BASE}/deleteAGVAction`, params, {
    signal: options?.signal,
  })
}
