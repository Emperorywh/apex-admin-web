/**
 * 持久化恢复失败一次性提示（规格 §4.3/§8.2/§17.22）：
 * 应用外壳消费 app 初始化状态中的 recoveryFailed 标记（TASK-004 由 persistor
 * bootstrap 回调写入），在进入登录页后经 uiFeedback 显示一次恢复失败提示
 * （降级已清理认证字段、以默认设置继续启动），随后不再重复。
 * 订阅 Data Router 的 location（组件位于 RouterProvider 之外，不能使用 useLocation）。
 */
import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { appI18n } from '@/i18n/i18n'
import { showUiWarning } from '@/services/feedback/uiFeedback'
import type { AppRouter } from '@/router/router'
import type { RootState } from '@/store/store'

/** 跟随 Data Router 当前 pathname：初始读 state，后续经 subscribe 同步 */
function useRouterPathname(router: AppRouter): string {
  const [pathname, setPathname] = useState(() => router.state.location.pathname)
  useEffect(() => {
    setPathname(router.state.location.pathname)
    const unsubscribe = router.subscribe((state) => {
      const next = state.location.pathname
      setPathname((current) => (current === next ? current : next))
    })
    return unsubscribe
  }, [router])
  return pathname
}

export function RecoveryFailureNotice({ router }: { router: AppRouter }) {
  const recoveryFailed = useSelector((state: RootState) => state.app.initialization.recoveryFailed)
  const pathname = useRouterPathname(router)
  const shownRef = useRef(false)

  useEffect(() => {
    // 只显示一次：StrictMode 双挂载与后续导航均不重复（规格 §4.3「显示一次」）
    if (!recoveryFailed || shownRef.current || pathname !== ROUTE_PATHS.LOGIN) {
      return
    }
    shownRef.current = true
    showUiWarning(appI18n.t('本地设置恢复失败，已使用默认设置'))
  }, [recoveryFailed, pathname])

  return null
}
