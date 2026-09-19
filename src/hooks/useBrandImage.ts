/**
 * 品牌展示位图片 Hook（P27）：拉取展示位二进制 → objectURL，
 * 品牌变更通知到达时自动重拉（上传成功后外壳即时刷新真实资源）。
 *
 * - 品牌图是装饰层：失败/非图片/空体一律返回 null，调用方兜底默认视觉，
 *   不弹错误不阻塞（与登录背景 P01 同纪律）
 * - objectURL 在「替换前/卸载时」精确释放（A16 释放纪律）；
 *   释放时机与 setState 异步解耦：先换 ref 再 revoke 旧值，避免 React 重渲染
 *   与 revoke 竞争出现瞬时破图
 */

import { useEffect, useRef, useState } from 'react'
import {
  fetchSystemImageBlob,
  isUsableImageBlob,
  subscribeBrandResourcesChanged,
} from '@/services/system/brand/brand.service'

/** 无资源时的返回值（调用方以 null 兜底默认视觉） */
type BrandImageUrl = string | null

/**
 * 拉取指定展示位的品牌图，返回可用的 objectURL 或 null。
 * @param placementKey 展示位 key（headerLogo / loginBackground / favicon 等）
 */
export function useBrandImage(placementKey: string): BrandImageUrl {
  const [url, setUrl] = useState<BrandImageUrl>(null)
  // 当前 objectURL 的精确引用：重拉先建新 URL 再 revoke 旧值，卸载时释放最后一份
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    /** 拉取并应用；拉到不可用内容清空回退默认视觉（旧版 img onError→占位同语义） */
    const load = (): void => {
      fetchSystemImageBlob(placementKey)
        .then((blob) => {
          if (cancelled) return
          // 非图片/空体（如后端接受了伪图片文件）：清空当前显示，不伪装有图
          if (!isUsableImageBlob(blob)) {
            const previous = objectUrlRef.current
            objectUrlRef.current = null
            setUrl(null)
            if (previous) URL.revokeObjectURL(previous)
            return
          }
          const next = URL.createObjectURL(blob)
          const previous = objectUrlRef.current
          objectUrlRef.current = next
          setUrl(next)
          if (previous) URL.revokeObjectURL(previous)
        })
        .catch(() => {
          // 请求失败（网络异常）：保持现状静默兜底，不阻塞页面（装饰层纪律）
        })
    }

    load()
    // 上传成功后即时刷新已挂载的外壳品牌（P27 约定：登录/外壳消费真实资源）
    const unsubscribe = subscribeBrandResourcesChanged(load)
    return () => {
      cancelled = true
      unsubscribe()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [placementKey])

  return url
}
