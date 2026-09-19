/**
 * 品牌资源服务：系统界面图（systemLogos 六 operation 通道）。
 *
 * - P01 交付查询/二进制消费（登录背景）；P27 扩展上传（PUT upsert）与
 *   品牌变更通知（上传成功后登录/外壳刷新真实资源），contracts.md 第 5 节登记
 * - 二进制响应由请求层按文件通道原样透传（非 JSON content-type 不套 Result 解包）；
 *   该接口族无需认证（旧系统登录前调用，已实证无令牌可用）
 * - 品牌图属于装饰性资源：调用方必须兜底默认视觉，任何失败都不得阻塞登录；
 *   品牌图不伪装成后端业务记录（无列表/无 CRUD 表格，仅展示位预览+上传）
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'

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
 * 上传或覆盖展示位品牌图（OpenAPI upsert：PUT /systemLogos/{placementKey}，
 * multipart/form-data、字段名 file，与旧实现 uploadSystemImage 同形态；G05）。
 * 文件类型校验由页面完成，本层只负责真实传输；页签关闭经 signal 中止。
 */
export function upsertSystemImage(
  placementKey: string,
  file: File,
  options?: RequestOptions,
): Promise<unknown> {
  const formData = new FormData()
  formData.append('file', file)
  return api.put<unknown>(`/systemLogos/${encodeURIComponent(placementKey)}`, formData, {
    signal: options?.signal,
    // multipart 边界由 axios 按 FormData 自动生成，此处不手动设置 Content-Type
  })
}

/* -------------------------------------------------------------------------- */
/* 品牌变更通知：上传成功后已挂载消费者（顶栏 logo / favicon）即时重拉真实资源。 */
/* 登录页不在同一布局内挂载，每次进入重挂载自然拉取最新资源，无需订阅。         */
/* -------------------------------------------------------------------------- */

/** 模块级事件总线：品牌资源变更单例（服务层无 React 依赖，仅 EventTarget） */
const brandEvents = new EventTarget()
/** 品牌资源变更事件名 */
const BRAND_CHANGED_EVENT = 'brand-changed'

/** 上传成功后调用：通知全部已挂载的品牌消费者重新拉取真实资源 */
export function notifyBrandResourcesChanged(): void {
  brandEvents.dispatchEvent(new Event(BRAND_CHANGED_EVENT))
}

/**
 * 订阅品牌资源变更，返回退订函数（useEffect 清理直接消费）。
 * 消费者收到通知后自行重拉——本层不缓存 Blob，不做第二次真相源。
 */
export function subscribeBrandResourcesChanged(listener: () => void): () => void {
  brandEvents.addEventListener(BRAND_CHANGED_EVENT, listener)
  return () => brandEvents.removeEventListener(BRAND_CHANGED_EVENT, listener)
}

/**
 * 校验响应 Blob 是否为可用图片：非空且媒体类型为 image/*。
 * 后端可能以 200 返回空体或非图片内容，使用前必须校验，不盲信。
 */
export function isUsableImageBlob(blob: Blob | undefined | null): blob is Blob {
  return !!blob && blob.size > 0 && blob.type.startsWith('image/')
}
