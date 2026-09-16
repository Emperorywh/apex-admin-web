/**
 * 暂缓模块统一提示页（SPEC §1.2 / P41 / A04）。
 *
 * 三个本轮暂缓模块（调度监控、地图编辑、录制回放）的路由仍注册在 definitions
 * 中并保留原菜单位置与权限码；通过认证与权限校验的直访/菜单进入后，本页以
 * 「下一轮实现」状态呈现，不加载模块业务实现、不发业务请求、不引入专用运行时。
 * 提供「返回本轮可用页面」与「退出登录」入口；返回目标解析跳过暂缓模块。
 */

import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { App, Button, Result } from 'antd'
import { Clock } from 'lucide-react'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { ROUTE_PATHS, findDefinitionByPath } from '@/router/definitions'
import { resolveFirstAccessiblePath } from '@/router/firstAccessible'
import { logout } from '@/services/auth/auth.service'
import { useAuth } from '@/hooks/useAuth'
import { sessionExpired } from '@/store/slices/authSlice'

export default function DeferredPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { identity } = useAuth()
  const { t } = useTranslation(['common', 'menu'])
  const { message } = App.useApp()

  /** 按当前地址反查路由定义：取菜单标题与模块名，不在此复制文案 */
  const definition = useMemo(
    () => findDefinitionByPath(location.pathname),
    [location.pathname],
  )

  const goBackToWorkspace = () => {
    navigate(resolveFirstAccessiblePath(identity ?? {}))
  }

  const signOut = async () => {
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
      icon={<Clock style={{ color: 'var(--app-text-3)' }} />}
      title={t(definition?.meta.title ?? '', { ns: 'menu' })}
      subTitle={t('该模块将在下一轮实现，当前版本暂未开放')}
      extra={
        <>
          <Button type="primary" onClick={goBackToWorkspace}>
            {t('返回本轮可用页面')}
          </Button>
          <Button onClick={signOut}>{t('退出登录')}</Button>
        </>
      }
    />
  )
}
