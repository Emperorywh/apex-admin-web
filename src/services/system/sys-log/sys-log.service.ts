/**
 * 操作日志服务（P28 操作日志页；owner 归 P28，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对最新 OpenAPI，method/path/请求体形态一致）：
 * - POST /fms/v1/common/sysLog/pageSysLogs  分页查询操作日志（POST + JSON body）
 *
 * 协议纪律：
 * - 与 carrier 分页（P06）同为 POST+JSON 请求体形态（OpenAPI requestBody
 *   required），保持该形态不做「归一化」改写成 GET query；
 * - 时间条件以 yyyy-MM-dd HH:mm:ss 秒级字符串提交（旧实现 dayjs 同格式序列化；
 *   边界与序列化证据随页面联验记录，G15 部署时区语义）；
 * - 空字符串条件由页面裁剪后提交，本层原样透传不补默认值（仅提供接口支持的
 *   筛选：标题/类型/模块/目标名称/起止请求时间）；
 * - 本服务不自动重试、不缓存：查询失败由表格内建错误态呈现（重试入口在表格
 *   内部，按钮纪律），会话失效由请求层统一收敛（1000000 → 登录页）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { SysLogPageParam, SysLogPageResult } from '@/services/system/sys-log/sys-log.service.types'

/** 操作日志控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const BASE = '/common/sysLog'

/** 分页查询操作日志：POST + JSON body（pageNo 从 1 计数） */
export async function pageSysLogs(
  params: SysLogPageParam,
  options?: RequestOptions,
): Promise<SysLogPageResult> {
  return api.post<SysLogPageResult>(`${BASE}/pageSysLogs`, params, {
    signal: options?.signal,
  })
}
