/**
 * 系统图片读取服务（T017，P27/G04 共用）。
 *
 * - `fetchSystemImage(placementKey)`：GET /fms/v1/systemLogos/{encodedPlacementKey}/file，
 *   经 T003 downloadBinary 携带鉴权头取 Blob（SPEC 附录B：fetchSystemImage 返回 Blob，
 *   必须处理图片类型、默认图与 Object URL 释放——释放由消费方 useSystemImage 负责）；
 * - 位置失效通知：上传成功方（T074）调用 `notifySystemImagesReplaced`，
 *   外壳消费方（登录背景/品牌图/favicon）订阅后按位置重新拉取；
 * - 未上传/读取失败不属于异常场景：消费方以默认资源回退（源行为 catch → default）。
 */

import { downloadBinary } from '@/services/request/legacy/legacyRequest'
import type { SystemImagePlacement } from '@/services/system-involve/system-setting/system-setting.service.types'

/** 旧接口地址：路径段为 encodeURIComponent 后的位置键（B.1 特殊契约） */
function buildSystemImageFileUrl(placementKey: string): string {
  return `/fms/v1/systemLogos/${encodeURIComponent(placementKey)}/file`
}

/**
 * 判定 Blob 是否可作为图片使用（源行为：size>0 且 type 含 image）。
 * 未配置位置时后端返回错误报文（已被 downloadBinary 嗅探为业务错误抛出），
 * 此处只做最终形态校验。
 */
export function isUsableImageBlob(blob: Blob): boolean {
  return blob.size > 0 && blob.type.includes('image')
}

/** 拉取指定位置的系统图片原始 Blob；失败原样抛出，由消费方回退默认资源 */
export async function fetchSystemImage(placementKey: SystemImagePlacement): Promise<Blob> {
  const { blob } = await downloadBinary(buildSystemImageFileUrl(placementKey))
  return blob
}

/* -------------------------------------------------------------------------- */
/* 位置失效通知（图片刷新合同，T074 上传成功后调用）                            */
/* -------------------------------------------------------------------------- */

type SystemImageInvalidationListener = (placementKeys: SystemImagePlacement[]) => void

/** 订阅表：外壳消费方按位置键注册，通知时精确匹配，不相关位置不重拉 */
const invalidationListeners = new Set<SystemImageInvalidationListener>()

/**
 * 通知指定位置的图片已被替换（上传成功后调用）。
 * 同步广播；订阅方自行决定重拉时机（当前实现为立即重拉）。
 */
export function notifySystemImagesReplaced(placementKeys: SystemImagePlacement[]): void {
  for (const listener of invalidationListeners) {
    listener(placementKeys)
  }
}

/** 订阅位置失效通知；返回取消订阅函数（消费方卸载时调用，防泄漏） */
export function subscribeSystemImageInvalidation(
  listener: SystemImageInvalidationListener,
): () => void {
  invalidationListeners.add(listener)
  return () => {
    invalidationListeners.delete(listener)
  }
}
