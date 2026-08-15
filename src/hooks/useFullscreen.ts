/**
 * 全屏 Hook（规格 §10.1/§10.2/§17.18）：全屏是浏览器瞬时状态，唯一属于 app slice
 * （不属于 settings，也不持久化）。状态以 Fullscreen API 的 fullscreenchange 事件
 * 为唯一同步来源：进入、退出（含 Esc 退出）都经事件回写；请求被拒绝时不触发事件，
 * 状态自然保持原样，仅提示用户，不写入 settings。
 */
import { useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { appI18n, COMMON_NAMESPACE } from '@/i18n/i18n'
import { showUiWarning } from '@/services/feedback/uiFeedback'
import { fullscreenSet } from '@/store/slices/app.slice'
import type { RootState } from '@/store/store'

export interface UseFullscreenResult {
  /** 当前全屏状态：来自 app slice，随 fullscreenchange 事件实时同步 */
  fullscreen: boolean
  /** 切换全屏：Fullscreen API 不可用或被权限策略拒绝时保持原状态并提示（规格 §17.18） */
  toggle: () => void
}

/** 全屏不可用提示 */
function warnFullscreenUnsupported(): void {
  showUiWarning(appI18n.t('当前浏览器不支持全屏功能', { ns: COMMON_NAMESPACE }))
}

/** 全屏请求被拒绝提示（如 iframe 未授权 fullscreen 的权限策略） */
function warnFullscreenRejected(): void {
  showUiWarning(appI18n.t('无法切换全屏，可能被浏览器权限策略拒绝', { ns: COMMON_NAMESPACE }))
}

/** 进入全屏：API 不可用直接提示；请求被拒（同步抛错或 Promise 拒绝）提示并保持原状态 */
async function enterFullscreen(): Promise<void> {
  const element = document.documentElement
  if (typeof element.requestFullscreen !== 'function') {
    warnFullscreenUnsupported()
    return
  }
  try {
    await element.requestFullscreen()
  } catch {
    warnFullscreenRejected()
  }
}

/** 退出全屏：与进入同源的降级处理 */
async function exitFullscreen(): Promise<void> {
  if (typeof document.exitFullscreen !== 'function') {
    warnFullscreenUnsupported()
    return
  }
  try {
    await document.exitFullscreen()
  } catch {
    warnFullscreenRejected()
  }
}

export function useFullscreen(): UseFullscreenResult {
  const dispatch = useDispatch()
  const fullscreen = useSelector((state: RootState) => state.app.fullscreen)

  useEffect(() => {
    // 挂载时先按浏览器实际状态校正一次，再监听后续变化；卸载时移除监听。
    // 使用宽松空值判断：未实现 Fullscreen API 的环境（如 jsdom）属性为 undefined，视同未全屏
    const syncFromDocument = () => {
      dispatch(fullscreenSet({ fullscreen: document.fullscreenElement != null }))
    }
    syncFromDocument()
    document.addEventListener('fullscreenchange', syncFromDocument)
    return () => {
      document.removeEventListener('fullscreenchange', syncFromDocument)
    }
  }, [dispatch])

  const toggle = useCallback(() => {
    if (document.fullscreenElement != null) {
      void exitFullscreen()
      return
    }
    void enterFullscreen()
  }, [])

  return { fullscreen, toggle }
}
