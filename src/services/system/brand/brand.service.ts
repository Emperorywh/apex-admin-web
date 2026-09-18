/**
 * 品牌资源服务：系统界面图（systemLogos 二进制通道）。
 *
 * - 列表元数据 GET /systemLogos 与二进制 GET /systemLogos/{placementKey}/file
 *   已在 contracts.md 登记（P01/P27 共用）；登录页消费 placementKey=loginBackground，
 *   外壳顶栏 logo（headerLogo 等）由 P27 复用本服务
 * - 二进制响应由请求层按文件通道原样透传（非 JSON content-type 不套 Result 解包）；
 *   该接口无需认证（旧系统登录前调用，已实证无令牌可用）
 * - 品牌图属于装饰性资源：调用方必须兜底默认视觉，任何失败都不得阻塞登录
 */

import { api } from '@/services/request/request'

/**
 * 获取系统界面图的二进制内容（Blob）。
 * 失败（网络异常 / 无此 placementKey / 会话拒绝）抛 ApiError，由调用方兜底处理。
 */
export function fetchSystemImageBlob(placementKey: string): Promise<Blob> {
  return api.get<Blob>(`/systemLogos/${encodeURIComponent(placementKey)}/file`, {
    responseType: 'blob',
  })
}

/**
 * 校验响应 Blob 是否为可用图片：非空且媒体类型为 image/*。
 * 后端可能以 200 返回空体或非图片内容，使用前必须校验，不盲信。
 */
export function isUsableImageBlob(blob: Blob | undefined | null): blob is Blob {
  return !!blob && blob.size > 0 && blob.type.startsWith('image/')
}
