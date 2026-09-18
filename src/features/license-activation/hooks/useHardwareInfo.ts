/**
 * 硬件码加载 Hook（P02 授权页消费；P29 如需同源展示硬件码可复用）。
 *
 * - 挂载即请求 GET /auth/license/getHardwareInfo（真实只读接口）；
 * - 失败区分主动取消（静默，不覆盖状态）与真实失败（记录错误并支持重试），
 *   不以空串冒充成功（DoD 6：失败清空远端区域并显示错误重试）；
 * - 卸载/重试时取消在途请求，防止旧响应乱序覆盖新一次加载。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchHardwareInfo } from '@/services/license-activation/license.service'
import { isCancelledError, toApiError } from '@/services/request/request'

export interface HardwareInfoState {
  /** 硬件码；仅真实成功后有值，失败时保持空串并由 error 区分 */
  hardwareId: string
  /** 首次加载与重试期间为 true */
  loading: boolean
  /** 真实失败的可展示文案；null = 无错误（含尚未加载完成） */
  error: string | null
  /** 手动重试（重新发起查询） */
  reload: () => void
}

export function useHardwareInfo(): HardwareInfoState {
  const [hardwareId, setHardwareId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 重试计数：变化即触发一次新加载（避免调用方持有不稳定回调）
  const [attempt, setAttempt] = useState(0)
  // 卸载取消在途请求；每次加载换新 controller，防旧响应乱序覆盖
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // 取消上一次在途请求（重试场景），再发起新请求
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    let active = true
    setLoading(true)
    setError(null)
    fetchHardwareInfo({ signal: controller.signal })
      .then((id) => {
        if (!active) return
        setHardwareId(typeof id === 'string' ? id : '')
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active || isCancelledError(err)) return
        // 真实失败：展示错误并提供重试；hardwareId 保持空串不冒充成功
        setError(toApiError(err).detail || toApiError(err).title)
        setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [attempt])

  const reload = useCallback(() => {
    setAttempt((n) => n + 1)
  }, [])

  return { hardwareId, loading, error, reload }
}
