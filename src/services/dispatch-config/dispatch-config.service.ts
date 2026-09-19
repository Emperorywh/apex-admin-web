/**
 * 调度配置服务（P13 整页重写交付；owner 归 P13，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/dispatcher/taskConfig/getTaskConfigs    全量查询调度配置（树形分组）
 * - POST /fms/v1/dispatcher/taskConfig/batchEditConfigs  批量编辑配置（数组整批提交）
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理（A06：不依赖英文
 *   success 文案判断成败——旧实现 res.message === "success" 的判断方式废弃）；
 * - getTaskConfigs 无分页参数，一次返回全部分组与子配置；
 * - batchEditConfigs 为整批请求，后端不提供逐项结果与原子事务承诺（G13）：
 *   页面按「整批已提交」呈现，成功后重新查询核实，不伪造逐项成败；
 * - 配置保存是参数更新（非车辆命令），失败不自动重试、不自动重放。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { TaskConfigDto, TaskConfigEditParam } from '@/services/dispatch-config/dispatch-config.service.types'

/** 调度配置控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const TASK_CONFIG_BASE = '/dispatcher/taskConfig'

/**
 * 全量查询调度配置：返回按 configType 分组的顶层节点数组，
 * 每个顶层节点的 childTaskConfigs 为该分类下的配置明细行。
 */
export async function getTaskConfigs(options?: RequestOptions): Promise<TaskConfigDto[]> {
  return api.get<TaskConfigDto[]>(`${TASK_CONFIG_BASE}/getTaskConfigs`, {
    signal: options?.signal,
  })
}

/**
 * 批量编辑配置（页面经确认框后调用）：请求体为 TaskConfigEditParam 数组，
 * 只含 configKey + configValue（字符串化后的值，select 多选 ";" 连接）。
 * 返回 void：整批提交语义，落库结果以保存后的重新查询为准。
 */
export async function batchEditConfigs(
  params: TaskConfigEditParam[],
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${TASK_CONFIG_BASE}/batchEditConfigs`, params, {
    signal: options?.signal,
  })
}
