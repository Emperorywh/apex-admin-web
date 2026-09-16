/**
 * useProtectedLogout：主动退出统一入口（G01，T017）。
 *
 * 编排顺序按 T013 合同保持：先 confirmSessionExit 完成草稿/写入/传输确认
 * （无保护时直接放行，取消则留在当前页）→ 二次确认（声明式宿主，替代
 * 命令式 modal.confirm——该方式在本工程产生无法销毁的僵尸弹窗）→
 * logout 请求 → 成功后 dispatch sessionExpired 统一收敛（SessionHost
 * 自动回登录页）。后端登出失败保留会话并提示（源行为）。
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { App } from 'antd'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { apiErrorMessage } from '@/services/request/request'
import { logout } from '@/services/auth/auth.service'
import { confirmSessionExit } from '@/services/page-session/leaveGuard'
import { requestLogoutConfirm } from '@/features/auth/logoutConfirmBus'
import { sessionExpired } from '@/store/slices/authSlice'

export interface ProtectedLogoutOptions {
  /** 覆盖二次确认文案（如改密成功后的提示），缺省为通用退出确认 */
  confirmContent?: string
}

export function useProtectedLogout() {
  const { t } = useTranslation('common')
  const dispatch = useAppDispatch()
  const { message } = App.useApp()

  return useCallback(
    async (options?: ProtectedLogoutOptions): Promise<void> => {
      /* 主动退出保护（T013 §9.1）：先完成草稿/写入/传输确认——无保护时
         confirmSessionExit 直接放行；取消则留在当前页。确认后再走登出请求。 */
      const leaveConfirmed = await confirmSessionExit()
      if (!leaveConfirmed) return
      // 二次确认经声明式宿主（LogoutConfirmHost）裁决，不走命令式 modal.confirm
      const confirmed = await requestLogoutConfirm({
        content: options?.confirmContent ?? t('退出后需要重新输入账号密码。'),
      })
      if (!confirmed) return
      try {
        // 源行为：后端登出失败时保留会话并提示，不本地登出
        await logout()
      } catch (error) {
        const text = apiErrorMessage(error)
        void message.error(text ? `${t('退出登录出错')}${text}` : t('退出登录出错'))
        return
      }
      // 成功后统一收敛：清身份/页签/缓存，SessionHost 监听未登录自动回登录页
      dispatch(sessionExpired())
    },
    [dispatch, message, t],
  )
}
