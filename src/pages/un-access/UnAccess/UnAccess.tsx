/**
 * 无权限页（P41 / SPEC §4）：
 * - 无可访问业务时明确提示，允许退出／重新登录，不循环重定向；
 * - 仅持有暂缓模块权限时（入口解析以 scope=deferred-only 标记）明确提示
 *   「暂无本轮可用业务页面，相关模块将在下一轮实现」，不误报没有任何权限。
 */

import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { App, Button, Result } from 'antd'
import { ShieldX } from 'lucide-react'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { ROUTE_PATHS } from '@/router/definitions'
import { logout } from '@/services/auth/auth.service'
import { sessionExpired } from '@/store/slices/authSlice'

/** 与 firstAccessible 解析约定的查询标记：仅持有暂缓模块权限 */
const DEFERRED_ONLY_SCOPE = 'deferred-only'

export default function UnAccess() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { t } = useTranslation('common')
  const { message } = App.useApp()
  const [searchParams] = useSearchParams()
  const deferredOnly = searchParams.get('scope') === DEFERRED_ONLY_SCOPE

  const relogin = async () => {
    try {
      // 源行为：登出失败保留会话并提示；成功清存储与请求头
      await logout()
    } catch {
      message.error(t('退出失败，会话已保留'))
      return
    }
    dispatch(sessionExpired())
    navigate(ROUTE_PATHS['auth-login'], { replace: true })
  }

  return (
    <Result
      icon={<ShieldX style={{ color: 'var(--app-orange-text)' }} />}
      title={t('无权限')}
      subTitle={
        deferredOnly
          ? t('暂无本轮可用业务页面，相关模块将在下一轮实现')
          : t('当前账号无权访问该页面或没有可用业务页面')
      }
      extra={
        <Button type="primary" onClick={relogin}>
          {t('退出并重新登录')}
        </Button>
      }
    />
  )
}
