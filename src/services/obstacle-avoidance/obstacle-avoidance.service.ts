/**
 * 避障模板服务（P22 整页重写交付；owner 归 P22，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/dispatcher/obstacleAvoidance/pageObstacleAvoidance     分页查询
 * - POST /fms/v1/dispatcher/obstacleAvoidance/createObstacleAvoidance   创建
 * - POST /fms/v1/dispatcher/obstacleAvoidance/updateObstacleAvoidance   编辑（id 定位）
 * - POST /fms/v1/dispatcher/obstacleAvoidance/deleteObstacleAvoidance   删除（query id）
 *
 * 不落地 operation（只迁当前来源可达控制，P16/P18 同口径）：
 * - GET  /fms/v1/dispatcher/obstacleAvoidance/getObstacleAvoidanceList
 *   旧仓库唯一活跃消费者为地图嵌套修改页（H02 本期暂缓）安全区面板的模板
 *   选项加载，本页不可达，不重复落地；H02 迁移时再由该页 owner 接入。
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 增改删为配置类写操作：确认与防重复提交由页面负责，本层不做自动重试。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  ObstacleAvoidanceAddParam,
  ObstacleAvoidanceDeleteParam,
  ObstacleAvoidancePageDto,
  ObstacleAvoidancePageParam,
  ObstacleAvoidanceUpdateParam,
} from '@/services/obstacle-avoidance/obstacle-avoidance.service.types'

/** 避障模板控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const OBSTACLE_AVOIDANCE_BASE = '/dispatcher/obstacleAvoidance'

/** 分页查询避障模板：pageNo 从 1 计数（页面用 toBackendPage 换算；G04 平铺口径） */
export async function pageObstacleAvoidance(
  params: ObstacleAvoidancePageParam,
  options?: RequestOptions,
): Promise<ObstacleAvoidancePageDto> {
  return api.get<ObstacleAvoidancePageDto>(
    `${OBSTACLE_AVOIDANCE_BASE}/pageObstacleAvoidance`,
    {
      params,
      signal: options?.signal,
    },
  )
}

/** 创建避障模板（名称 + 避障参数集合，业务校验在页面表单） */
export async function createObstacleAvoidance(
  params: ObstacleAvoidanceAddParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${OBSTACLE_AVOIDANCE_BASE}/createObstacleAvoidance`, params, {
    signal: options?.signal,
  })
}

/** 编辑避障模板（按 int64 主键 id 定位；parameters 整体替换——协议语义页面照实提交） */
export async function updateObstacleAvoidance(
  params: ObstacleAvoidanceUpdateParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${OBSTACLE_AVOIDANCE_BASE}/updateObstacleAvoidance`, params, {
    signal: options?.signal,
  })
}

/** 删除避障模板（OpenAPI 将 id 声明为 required query 参数：POST + ?id=；
 * 破坏性操作，页面确认后调用） */
export async function deleteObstacleAvoidance(
  params: ObstacleAvoidanceDeleteParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(
    `${OBSTACLE_AVOIDANCE_BASE}/deleteObstacleAvoidance`,
    null,
    {
      params: { id: params.id },
      signal: options?.signal,
    },
  )
}
