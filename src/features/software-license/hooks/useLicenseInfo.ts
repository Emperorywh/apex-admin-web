/**
 * 授权信息加载 Hook（P29 软件信息页）。
 *
 * - 挂载即 POST /auth/license/getLicense（查询性质 POST，真实只读接口）；
 * - 三态：加载中 / 失败（error 文案）/ 成功（license 可为 null = 暂无授权信息，
 *   由页面呈现空态）；读取失败绝不以空态或「已授权」冒充（P29 专项验收）；
 * - 取消：在途请求随工作区页签 scope 信号中止（页签关闭/缓存淘汰/刷新），
 *   每次加载换新 AbortController 防旧响应乱序覆盖（useHardwareInfo 同款纪律）；
 * - 自愈：本页无表格无轮询（旧版同语义，单次加载），按 AGENTS 4 纪律不设
 *   手动刷新/重试按钮，失败恢复依赖「页签重新激活自动重查一次」（恢复即查）；
 * - 语言切换不重发：业务值不含服务端语言文案，切换语言只影响页面静态标签。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchLicense } from '@/services/license-activation/license.service'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import type { LicenseProofDto } from '@/services/license-activation/license.service.types'
import { usePageActive } from '@/hooks/usePageActive'
import { usePageRequest } from '@/hooks/usePageRequest'

export interface LicenseInfoState {
  /** 授权信息；仅真实成功后有值（可能为 null = 后端无授权数据），失败保持 null */
  license: LicenseProofDto | null
  /** 首次加载与重查期间为 true */
  loading: boolean
  /** 真实失败的可展示文案；null = 无错误（含尚未加载完成） */
  error: string | null
  /** 重新查询（激活成功后刷新真实状态） */
  reload: () => void
}

export function useLicenseInfo(): LicenseInfoState {
  const [license, setLicense] = useState<LicenseProofDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 重查计数：变化即触发一次新加载（避免调用方持有不稳定回调）
  const [attempt, setAttempt] = useState(0)

  // 页签生命周期：scope 信号中止（页签关闭/缓存淘汰）时取消在途请求
  const { signal: scopeSignal } = usePageRequest()
  // 页签重新激活（revision 递增）即自动重查一次；首个 revision 是首次挂载，跳过
  const { revision: activeRevision } = usePageActive()
  const skipFirstActiveRef = useRef(true)

  useEffect(() => {
    if (skipFirstActiveRef.current) {
      skipFirstActiveRef.current = false
      return
    }
    setAttempt((n) => n + 1)
  }, [activeRevision])

  useEffect(() => {
    // 每次加载独立 controller：scope 中止或卸载/重查都经它取消在途请求
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)
    const onScopeAbort = () => controller.abort()
    scopeSignal.addEventListener('abort', onScopeAbort)
    fetchLicense({ signal: controller.signal })
      .then((data) => {
        if (!active) return
        // 真实成功：null 是后端「无授权数据」的真实结果，交由页面呈现空态
        setLicense(data ?? null)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active || isCancelledError(err)) return
        // 真实失败：记录后端/网络文案；license 保持 null，页面呈现失败态
        setError(apiErrorMessage(err))
        setLoading(false)
      })
    return () => {
      active = false
      scopeSignal.removeEventListener('abort', onScopeAbort)
      controller.abort()
    }
  }, [attempt, scopeSignal])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  return { license, loading, error, reload }
}
