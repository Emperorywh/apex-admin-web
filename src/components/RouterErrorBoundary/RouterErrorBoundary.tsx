/**
 * 路由级错误边界（Data Router errorElement，P42 核对收口）：
 * 处理顶层 loader/guard 抛错与顶层页面代码加载失败，展示稳定错误内容与恢复动作。
 *
 * 渲染位置在路由树顶层（替换整棵树），无任何布局衬底，与公开 /404 同因：
 * Result 直接叠固定壁纸时深色主题反白不可读，故用玻璃窗口材质面板提供
 * 两主题衬底（令牌单源）。
 *
 * 五语言：错误边界可随时出现在任意路由（包括 error 分片未随页面预载的
 * 公开页），文案显式指定 error 命名空间；该分片已列入 i18n 基座常载集合
 * （BASE_NAMESPACES），类组件直读 i18next 时资源必然就绪。
 *
 * 恢复动作按渲染时会话快照区分（错误边界渲染一次，不订阅后续变化）：
 * - 重新加载：整页刷新，重置全部 React 状态；
 * - 已登录 → 「首页」：整页跳转到 T00 落点规则解析的合法落点（旧实现固定
 *   跳 /over-look 暂缓说明页，不复刻）；整页跳转让错误边界彻底重建；
 * - 未登录 → 「去登录」。
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isRouteErrorResponse } from 'react-router'
import { Button, Result } from 'antd'
import i18next from '@/i18n/i18n'
import { resolveLandingPath } from '@/router/routeAccess'
import { ROUTE_PATHS } from '@/router/definitions'
import { store } from '@/store/store'
import styles from '@/components/RouterErrorBoundary/RouterErrorBoundary.module.css'

/** error 命名空间文案便捷读取：错误边界为类组件，直读 i18next 实例 */
function tError(key: string): string {
  return i18next.t(key, { ns: 'error' })
}

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

    // 会话快照只在错误呈现时读取一次：登录态随后变化的场景由重新加载收敛
    const { auth } = store.getState()

    const isRouteError = isRouteErrorResponse(error)
    const status = isRouteError ? error.status : 500
    // statusText/data 为路由层技术性描述（非会话信息），缺失时回退五语言说明
    const title = isRouteError
      ? error.statusText || (typeof error.data === 'string' ? error.data : tError('页面加载失败'))
      : tError('页面加载失败')

    return (
      <div className={styles.page}>
        <div className={styles.panel}>
          <Result
            status={status === 404 ? '404' : status === 403 ? '403' : '500'}
            title={status}
            subTitle={title}
            extra={[
              <Button key="reload" type="primary" onClick={() => window.location.reload()}>
                {tError('重新加载')}
              </Button>,
              auth.user !== null ? (
                <Button
                  key="home"
                  type="text"
                  onClick={() => window.location.assign(resolveLandingPath(auth))}
                >
                  {tError('首页')}
                </Button>
              ) : (
                <Button
                  key="login"
                  type="text"
                  onClick={() => window.location.assign(ROUTE_PATHS['auth-login'])}
                >
                  {tError('去登录')}
                </Button>
              ),
            ]}
          />
        </div>
      </div>
    )
  }
}
