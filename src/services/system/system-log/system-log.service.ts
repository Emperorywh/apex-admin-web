/**
 * 系统日志服务（P26 系统日志页；owner 归 P26，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对最新 OpenAPI，method/path/请求体形态一致）：
 * - GET  /fms/v1/systemLog/pageSystemLogs     分页查询系统日志（GET + query 平铺，G04 口径）
 * - GET  /fms/v1/systemLog/getSystemLogTypes  查询日志文件类型集合（字符串数组，选项动态下发）
 * - POST /fms/v1/systemLog/downloadSystemLog  下载系统日志（body DownloadSystemLogParam → zip Blob）
 *
 * 协议纪律：
 * - 分页参数 GET query 平铺（后端 pageParam 平铺读取，与 P08 pageAlarmCodes
 *   同款形态），时间参数 yyyy-MM-dd HH:mm:ss 字符串序列化后提交；
 * - 下载：POST + JSON 请求体 + Blob 通道；返回 Blob 与解析后的文件名
 *   （content-disposition 解析失败/缺失返回 null，由调用方回退 default.zip
 *   命名——旧实现同兜底语义）；JSON 业务错误仍走统一解包收敛，绝不把错误
 *   JSON 保存为伪文件（DoD 9）；onDownloadProgress 供页面呈现真实接收进度
 *   （G11：已知总字节才显示百分比，否则不确定进度，不伪造）；
 * - 本服务不自动重试、不缓存：查询失败由表格内建错误态呈现，下载失败如实
 *   反馈（下载鉴权与会话失效由请求层统一收敛，A16）。
 */

import { api, resolveDownloadFilename } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  DownloadSystemLogParam,
  SystemLogPageParam,
  SystemLogPageResult,
} from '@/services/system/system-log/system-log.service.types'

/** 系统日志控制器统一前缀（三 operation 共用；request 层 baseURL 已含 /fms/v1） */
const BASE = '/systemLog'

/**
 * 分页查询系统日志：GET + query 平铺（pageNo 从 1 计数）；空字符串条件
 * 由页面裁剪后提交，本层原样透传不补默认值（仅提供接口支持的筛选）。
 */
export async function pageSystemLogs(
  params: SystemLogPageParam,
  options?: RequestOptions,
): Promise<SystemLogPageResult> {
  return api.get<SystemLogPageResult>(`${BASE}/pageSystemLogs`, {
    signal: options?.signal,
    params,
  })
}

/** 查询日志文件类型集合（getSystemLogTypes，返回字符串数组；选项 label=value=类型原值） */
export async function getSystemLogTypes(options?: RequestOptions): Promise<string[]> {
  return api.get<string[]>(`${BASE}/getSystemLogTypes`, {
    signal: options?.signal,
  })
}

/**
 * 下载系统日志：POST DownloadSystemLogParam + zip Blob；返回 Blob 与解析后的
 * 文件名（content-disposition 优先，RFC 5987 已在请求层解析；取不到返回 null，
 * 由调用方回退 default.zip）。
 */
export async function downloadSystemLog(
  params: DownloadSystemLogParam,
  onDownloadProgress: (event: { loaded: number; total?: number | null }) => void,
  options?: RequestOptions,
): Promise<{ blob: Blob; filename: string | null }> {
  const response = await api.downloadPost(`${BASE}/downloadSystemLog`, params, {
    signal: options?.signal,
    onDownloadProgress,
  })
  return {
    blob: response.data,
    // 文件名解析统一走请求层工具（RFC 5987 优先，规格 10.6）
    filename: resolveDownloadFilename(response.headers?.['content-disposition']),
  }
}
