/**
 * 路由级错误边界（Data Router errorElement）：
 * 处理 loader/guard 抛出的错误，展示稳定错误内容与恢复动作。
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isRouteErrorResponse } from 'react-router'
import { Button, Result } from 'antd'
import { FALLBACK_PATH } from '@/constants/route.constants'
import i18next from '@/i18n/i18n'

interface RouterErrorBoundaryProps {
  /** 作为 errorElement 挂载时可无 children */
  children?: ReactNode
}

interface RouterErrorBoundaryState {
  error: unknown
}

export class RouterErrorBoundary extends Component<RouterErrorBoundaryProps, RouterErrorBoundaryState> {
  state: RouterErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): RouterErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[RouterErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    const isRouteError = isRouteErrorResponse(error)
    const status = isRouteError ? error.status : 500
    const title = isRouteError
      ? error.statusText || (typeof error.data === 'string' ? error.data : i18next.t('页面加载失败'))
      : i18next.t('页面加载失败')

    return (
      <Result
        status={status === 404 ? '404' : status === 403 ? '403' : '500'}
        title={status}
        subTitle={title}
        extra={[
          <Button key="reload" type="primary" onClick={() => window.location.reload()}>
            {i18next.t('重新加载')}
          </Button>,
          <Button key="home" onClick={() => window.location.assign(FALLBACK_PATH)}>
            {i18next.t('返回工作台')}
          </Button>,
        ]}
      />
    )
  }
}
