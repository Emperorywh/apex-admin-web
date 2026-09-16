/**
 * useSystemImage：外壳/登录页系统图片统一消费 Hook（T017，G04）。
 *
 * - 挂载后按位置键拉取图片 Blob → Object URL；无配置/读取失败/非图片内容
 *   时保持 fallback（源行为 catch → default，登录前无 token 亦走此分支）；
 * - 订阅位置失效通知：上传替换（T074）后仅重拉本位置；
 * - Object URL 生命周期收敛在 Hook 内：换图/卸载时 revoke 旧 URL，不泄漏。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchSystemImage,
  isUsableImageBlob,
  subscribeSystemImageInvalidation,
} from '@/services/system-involve/system-setting/system-setting.service'
import type { SystemImagePlacement } from '@/services/system-involve/system-setting/system-setting.service.types'

export interface SystemImageState {
  /** 当前可用图片地址：配置图 Object URL 或 fallback 默认资源 */
  url: string
  /** 是否已完成首次判定（成功取到配置图，或确认回退默认） */
  ready: boolean
}

export function useSystemImage(
  placementKey: SystemImagePlacement,
  fallbackUrl: string,
): SystemImageState {
  const [url, setUrl] = useState(fallbackUrl)
  const [ready, setReady] = useState(false)
  /* Object URL 需要在「替换/卸载」时 revoke，用 ref 记录当前在用 URL；
     fallback 可能是打包内静态资源（不可 revoke），仅记录 blob: 地址 */
  const activeObjectUrlRef = useRef<string | null>(null)

  const revokeActiveObjectUrl = useCallback(() => {
    if (activeObjectUrlRef.current !== null) {
      URL.revokeObjectURL(activeObjectUrlRef.current)
      activeObjectUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const blob = await fetchSystemImage(placementKey)
        if (cancelled) return
        if (!isUsableImageBlob(blob)) {
          // 形态不可用（空内容/非图片）：与失败同口径回退默认图（源行为）
          revokeActiveObjectUrl()
          setUrl(fallbackUrl)
          setReady(true)
          return
        }
        const objectUrl = URL.createObjectURL(blob)
        revokeActiveObjectUrl()
        activeObjectUrlRef.current = objectUrl
        setUrl(objectUrl)
      } catch {
        // 读取失败（未配置/网络/鉴权）：保留默认图，不视为页面级异常（源行为）
        if (cancelled) return
        revokeActiveObjectUrl()
        setUrl(fallbackUrl)
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void load()

    // 位置失效通知：本位置被上传替换时重拉；其他位置通知直接忽略
    const unsubscribe = subscribeSystemImageInvalidation((keys) => {
      if (!keys.includes(placementKey)) return
      void load()
    })

    return () => {
      cancelled = true
      unsubscribe()
      revokeActiveObjectUrl()
    }
  }, [placementKey, fallbackUrl, revokeActiveObjectUrl])

  return { url, ready }
}
