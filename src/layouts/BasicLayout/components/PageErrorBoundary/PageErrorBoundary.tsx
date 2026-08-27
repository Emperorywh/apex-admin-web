/**
 * 页面渲染错误边界：每个缓存实例一层，出错时显示 500 内容（SPEC §4.2）。
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Result } from 'antd'
import i18next from '@/i18n/i18n'

interface PageErrorBoundaryProps {
  children: ReactNode
}

interface PageErrorBoundaryState {
  error: Error | null
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[PageErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children
    return (
      <Result
        status="500"
        title={i18next.t('页面渲染出错')}
        subTitle={error.message}
        extra={
          <Button type="primary" onClick={() => this.setState({ error: null })}>
            {i18next.t('重试')}
          </Button>
        }
      />
    )
  }
}
