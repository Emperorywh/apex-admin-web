/**
 * 路由级错误边界（规格 §4.2/§4.3）：
 * guard/loader 错误（如 profile 网络失败）由本组件承接，提供「重试」与「退出登录」，
 * 不把网络故障误判为未登录。页面渲染错误由各缓存实例外层 PageErrorBoundary 承接（TASK-011）。
 * 重试以 replace 重新导航当前地址：loader 失败后该路由没有 loaderData，
 * 重新导航即触发 loader 重跑；退出登录经注入的 onLogout 回调执行认证会话状态机，
 * 本组件不依赖任何业务 service（登出后的 post-logout 导航意图由路由接线消费）。
 */
import { Button, Result } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, useLocation, useNavigate, useRouteError } from 'react-router'
import { MENU_NAMESPACE } from '@/i18n/i18n'

export interface RouterErrorBoundaryProps {
  /** 退出登录回调：由路由装配处注入认证会话状态机（logoutSession） */
  onLogout: () => Promise<void>
}

/**
 * 提取错误诊断文案：useRouteError 可能是原始 Error（loader 抛错）、
 * ErrorResponse（路由级错误）或字符串；取不到可读信息时返回 null，由调用方回退固定文案。
 */
function describeError(error: unknown): string | null {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  if (isRouteErrorResponse(error)) {
    if (typeof error.data === 'string' && error.data.length > 0) {
      return error.data
    }
    if (error.statusText.length > 0) {
      return error.statusText
    }
    return `HTTP ${error.status}`
  }
  if (typeof error === 'string' && error.length > 0) {
    return error
  }
  return null
}

export function RouterErrorBoundary({ onLogout }: RouterErrorBoundaryProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const error = useRouteError()
  const [loggingOut, setLoggingOut] = useState(false)

  const retry = () => {
    // replace 重新导航当前地址：失败的 loader 没有 loaderData，重导航即重跑（isNewLoader 语义）
    navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true })
  }

  const logout = async () => {
    setLoggingOut(true)
    try {
      await onLogout()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <Result
      status="500"
      title={t('服务器错误', { ns: MENU_NAMESPACE })}
      subTitle={describeError(error) ?? t('服务器开小差了，请稍后重试')}
      extra={
        <>
          <Button type="primary" onClick={retry}>
            {t('重试')}
          </Button>
          <Button loading={loggingOut} onClick={() => void logout()}>
            {t('退出登录')}
          </Button>
        </>
      }
    />
  )
}
