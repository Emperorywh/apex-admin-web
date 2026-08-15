/**
 * 页面级错误边界（规格 §4.2/§9.1/§17.19）：
 * 每个缓存实例独立包裹 CachedRouteView，页面渲染错误（含 lazy 加载失败）在本实例内
 * 显示 500 内容，不影响其他缓存页签；guard/loader 错误由 Data Router 的
 * RouterErrorBoundary 处理，与本边界无关。事件回调和异步任务错误由调用端捕获，
 * 不宣称 ErrorBoundary 能捕获全部错误（§17.19）。
 * 500 内容复用 /500 页面实现（单一权威），重试语义为返回 Dashboard。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ServerError } from '@/pages/error/ServerError/ServerError'

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
    // 页面渲染错误只记录诊断，不弹全局反馈（页面边界已就地展示 500）
    console.error('[apex-page] 页面渲染错误', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      return <ServerError />
    }
    return this.props.children
  }
}
