/**
 * 数据库备份服务（P30 数据库备份页；owner 归 P30，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对最新 OpenAPI，method/path/参数形态一致）：
 * - GET /fms/v1/dataBase/getDataBases                查询所有备份数据库（无参数 → 字符串数组）
 * - GET /fms/v1/dataBase/getDataBaseBackupFiles      查询指定库的备份文件（GET + query 平铺，全集返回无分页）
 * - GET /fms/v1/dataBase/downloadDataBaseBackupFile  下载备份文件（GET + query database/backupFileName → Blob；
 *                                                     OpenAPI 双参数 required，与旧页面 a 标签 GET 同形态）
 *
 * 协议纪律：
 * - 下载走请求层 downloadGet Blob 通道：JSON 业务错误仍走统一解包收敛，绝不把
 *   错误 JSON 保存为伪文件（DoD 9）；返回 Blob 与解析后的文件名（content-disposition
 *   解析失败/缺失返回 null，由调用方回退 backupFileName 命名——旧实现 a.download
 *   同语义）；onDownloadProgress 供页面呈现真实接收进度（G11：已知总字节才显示
 *   百分比，否则不确定进度，不伪造）；
 * - 查询不自动重试、不缓存：库列表失败由页面如实反馈，文件列表失败由表格内建
 *   错误态呈现（A16 下载鉴权与会话失效由请求层统一收敛）。
 */

import { api, resolveDownloadFilename } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  DataBaseBackupDownloadParam,
  DataBaseBackupFilesParam,
  BackupFileRecord,
} from '@/services/system/database-backup/database-backup.service.types'

/** 数据库备份控制器统一前缀（三 operation 共用；request 层 baseURL 已含 /fms/v1） */
const BASE = '/dataBase'

/** 查询所有备份数据库（无参数；返回库名字符串数组，空库返回空数组） */
export async function getDataBases(options?: RequestOptions): Promise<string[]> {
  return api.get<string[]>(`${BASE}/getDataBases`, {
    signal: options?.signal,
  })
}

/** 查询指定数据库的备份文件列表（GET + query 平铺；全集返回，不虚构分页语义） */
export async function getDataBaseBackupFiles(
  params: DataBaseBackupFilesParam,
  options?: RequestOptions,
): Promise<BackupFileRecord[]> {
  return api.get<BackupFileRecord[]>(`${BASE}/getDataBaseBackupFiles`, {
    signal: options?.signal,
    params,
  })
}

/**
 * 下载数据库备份文件：GET query + Blob；返回 Blob 与解析后的文件名
 * （content-disposition 优先，RFC 5987 已在请求层解析；取不到返回 null，
 * 由调用方回退 backupFileName 命名）。
 */
export async function downloadDataBaseBackupFile(
  params: DataBaseBackupDownloadParam,
  onDownloadProgress: (event: { loaded: number; total?: number | null }) => void,
  options?: RequestOptions,
): Promise<{ blob: Blob; filename: string | null }> {
  const response = await api.downloadGet(
    `${BASE}/downloadDataBaseBackupFile`,
    { ...(params as unknown as Record<string, unknown>) },
    {
      signal: options?.signal,
      onDownloadProgress,
    },
  )
  return {
    blob: response.data,
    // 文件名解析统一走请求层工具（RFC 5987 优先，规格 10.6）
    filename: resolveDownloadFilename(response.headers?.['content-disposition']),
  }
}
