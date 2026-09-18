/**
 * 500 服务错误页（P42 核对收口）：受保护根内辅助页（守卫保证渲染时已登录），
 * 布局内渲染、工作区玻璃窗口已提供衬底，不再另加面板。
 *
 * 恢复动作按真实登录态区分（DoD 3；跨窗口登出同步时 user 为 null 的真实状态）：
 * - 重新加载：服务类错误的直接恢复动作（整页刷新）；
 * - 已登录 → 旧 key「首页」按钮：按 T00 落点规则（resolveLandingPath）导航到
 *   当前会话的合法落点，replace 让 /500 不残留在历史中；旧实现固定跳
 *   /over-look（新系统为暂缓说明页 H01），不复刻该地址；
 * - 未登录（防御分支）→ 「去登录」。
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button, Result } from 'antd'
import { useAppSelector } from '@/hooks/useAppSelector'
import { resolveLandingPath } from '@/router/routeAccess'
import { ROUTE_PATHS } from '@/router/definitions'

export default function ServerError() {
  const { t } = useTranslation('error')
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)
  // 落点解析在 selector 内按最新会话快照计算；未登录快照不解析（出口是登录页）
  const landing = useAppSelector((state) =>
    state.auth.user !== null ? resolveLandingPath(state.auth) : null,
  )

  /** 返回首页（落点）：replace 让 500 页不残留在历史记录中 */
  const handleHome = useCallback(() => {
    if (landing !== null) navigate(landing, { replace: true })
  }, [landing, navigate])

  /** 去登录：仅跨窗口登出同步瞬间可达的防御分支 */
  const handleGoLogin = useCallback(() => {
    navigate(ROUTE_PATHS['auth-login'], { replace: true })
  }, [navigate])

  return (
    <Result
      status="500"
      title="500"
      subTitle={t('服务暂时不可用，请稍后重试')}
      extra={[
        <Button key="reload" type="primary" onClick={() => window.location.reload()}>
          {t('重新加载')}
        </Button>,
        user !== null ? (
          <Button key="home" type="text" onClick={handleHome}>
            {t('首页')}
          </Button>
        ) : (
          <Button key="login" type="text" onClick={handleGoLogin}>
            {t('去登录')}
          </Button>
        ),
      ]}
    />
  )
}
