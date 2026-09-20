/**
 * 服务器资源服务（P40 owner：/analyze-visual/server-resource-monitor）。
 *
 * 接口（逐字段核对基线 OpenAPI，SHA-256 A82E…49C7C）：
 * - GET /fms/v1/serverResource/current → ResultServerResourceSnapshot（无参数）
 *
 * 协议纪律：
 * - 响应解包/业务码（code=200）判定统一由请求层完成，本层不重复处理，
 *   也不依赖旧实现 message === 'success' 的英文字符串（规格 4.2）；
 * - 只读查询，进 useVisiblePolling 可见轮询；signal 必须透传请求层；
 * - data 理论上恒有值（服务器指标快照），类型如实标注可空，
 *   页面对 null 按该轮无有效数据处理（清空快照区域 + 错误态）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { ServerResourceSnapshotDto } from './server-resource.service.types'

/** 服务器实时资源快照查询（CPU / 内存 / JVM 堆 / 磁盘分区） */
export async function fetchServerResourceCurrent(
  options?: RequestOptions,
): Promise<ServerResourceSnapshotDto | null> {
  return api.get<ServerResourceSnapshotDto | null>('/serverResource/current', {
    signal: options?.signal,
  })
}
