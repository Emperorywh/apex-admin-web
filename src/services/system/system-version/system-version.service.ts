/**
 * 系统版本服务（P25 版本管理；owner 归 P25，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对最新 OpenAPI，method/path/请求体形态一致）：
 * - GET  /fms/v1/systemVersion/getSystemVersions          查询全部系统版本（无分页参数）
 * - POST /fms/v1/systemVersion/restartSystem              重启系统（无请求体）
 * - POST /fms/v1/systemVersion/rollback                   回滚版本包并重启（body SystemVersionParam）
 * - POST /fms/v1/systemVersion/deletePendingJar           删除待升级 jar（body SystemVersionParam）
 * - POST /fms/v1/systemVersion/downloadSystemVersionJar   下载系统版本包（body SystemVersionParam → Blob）
 * - POST /fms/v1/systemVersion/uploadSystemVersion        上传系统版本更新包（multipart，字段 file）
 *
 * G08 旧路径替代核实（开工对照旧仓库 api.ts）：旧 pageSystemVersions /
 * updateJarRestart 两个端点在最新 OpenAPI 中已不存在——旧列表消费点本页改用
 * getSystemVersions（全集，旧页面同为不分页全量渲染）、重启消费 restartSystem
 * （旧页面实际调用即 restartSystem，updateJarRestart 在旧页面零可达消费者）。
 *
 * 协议纪律：
 * - 上传（G05）：OpenAPI 把请求体声明为 application/json 内 binary 字段，旧实现
 *   真实行为是 multipart/form-data、字段名 file——本层按旧实现适配（axios 按
 *   FormData 自动生成 multipart 边界），真实媒体类型以带令牌联验抓包实证为准；
 * - 下载：POST + SystemVersionParam 请求体 + Blob 通道；JSON 业务错误仍走统一
 *   解包收敛（绝不把错误 JSON 保存为伪文件，DoD 9）；onDownloadProgress 供页面
 *   呈现真实接收进度（G11：已知总字节才显示百分比，否则不确定进度，不伪造）；
 * - 上传 onUploadProgress 同理回报真实字节进度；100% 后仍需等待服务端处理
 *   （落盘/校验），「传输完成 ≠ 处理完成」由页面按阶段呈现，本层不自动重试；
 * - 重启/回滚是破坏性系统命令：确认对象与影响、防重复提交由页面负责；
 *   响应仅代表后端受理（先响应后重启），命令接受 ≠ 重启完成。
 */

import { api, resolveDownloadFilename } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { SystemVersionDto, SystemVersionParam } from '@/services/system/system-version/system-version.service.types'

/** 系统版本控制器统一前缀（六 operation 共用；request 层 baseURL 已含 /fms/v1） */
const BASE = '/systemVersion'

/**
 * 查询全部系统版本信息：GET 无参数，返回全集（旧页面同形态全量渲染，
 * 接口无分页/筛选/排序参数——G09 不开放排序）。
 */
export async function getSystemVersions(options?: RequestOptions): Promise<SystemVersionDto[]> {
  return api.get<SystemVersionDto[]>(`${BASE}/getSystemVersions`, {
    signal: options?.signal,
  })
}

/** 重启系统：无请求体；成功响应仅代表命令受理，重启期间后端会断连（页面按未知态呈现） */
export async function restartSystem(options?: RequestOptions): Promise<unknown> {
  return api.post<unknown>(`${BASE}/restartSystem`, undefined, {
    signal: options?.signal,
  })
}

/** 回滚到指定构建版本并重启（buildId 定位；危险操作，页面确认后调用） */
export async function rollbackSystemVersion(
  params: SystemVersionParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${BASE}/rollback`, params, {
    signal: options?.signal,
  })
}

/** 删除待升级 jar（buildId 定位；破坏性操作，页面确认后调用） */
export async function deletePendingJar(
  params: SystemVersionParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${BASE}/deletePendingJar`, params, {
    signal: options?.signal,
  })
}

/**
 * 下载系统版本包：POST SystemVersionParam + Blob；返回 Blob 与解析后的文件名
 * （content-disposition 解析失败/缺失返回 null，由调用方回退 buildId.jar 命名）。
 */
export async function downloadSystemVersionJar(
  params: SystemVersionParam,
  onDownloadProgress: (event: { loaded: number; total?: number | null }) => void,
  options?: RequestOptions,
): Promise<{ blob: Blob; filename: string | null }> {
  const response = await api.downloadPost(`${BASE}/downloadSystemVersionJar`, params, {
    signal: options?.signal,
    onDownloadProgress,
  })
  return {
    blob: response.data,
    // 文件名解析统一走请求层工具（RFC 5987 优先，规格 10.6）
    filename: resolveDownloadFilename(response.headers?.['content-disposition']),
  }
}

/**
 * 上传系统版本更新包（加入待升级列表，不自动重启）：multipart/form-data、
 * 字段名 file（旧实现同形态）。文件类型校验由页面完成，本层只负责真实传输。
 */
export async function uploadSystemVersion(
  file: File,
  onUploadProgress: (event: { loaded: number; total?: number | null }) => void,
  options?: RequestOptions,
): Promise<unknown> {
  const formData = new FormData()
  formData.append('file', file)
  return api.post<unknown>(`${BASE}/uploadSystemVersion`, formData, {
    signal: options?.signal,
    // multipart 边界由 axios 按 FormData 自动生成，此处不手动设置 Content-Type
    onUploadProgress,
  })
}
