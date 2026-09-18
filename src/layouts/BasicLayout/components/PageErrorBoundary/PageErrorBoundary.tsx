/**
 * 页面渲染错误边界：每个缓存实例一层，出错时显示 500 内容。
 *
 * 渲染位置在布局内页签区（工作区玻璃窗口已提供衬底），不另加面板；
 * 文案显式指定 error 命名空间——该分片已列入 i18n 基座常载集合
 * （BASE_NAMESPACES），类组件直读 i18next 时四语言资源必然就绪，
 * 不再出现英文界面下回退中文 key 的问题。
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Result } from 'antd'
import i18next from '@/i18n/i18n'

/** error 命名空间文案便捷读取：错误边界为类组件，直读 i18next 实例 */
function tError(key: string): string {
  return i18next.t(key, { ns: 'error' })
}

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
        title={tError('页面渲染出错')}
        subTitle={error.message}
        extra={
          <Button type="primary" onClick={() => this.setState({ error: null })}>
            {tError('重试')}
          </Button>
        }
      />
    )
  }
}
