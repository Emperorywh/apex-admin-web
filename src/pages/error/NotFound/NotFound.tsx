/**
 * 404 兜底错误页（P42）：旧 NotFound（antd Result 404 + 首页按钮）等价迁移。
 *
 * 同一组件有两种挂载场景，恢复路径按真实登录态区分：
 * - 显式 /404（公开路由，BlankLayout 独立渲染）：未登录直达时唯一合法恢复
 *   路径是登录页（未知 URL 不能作为回跳参数，resolveSafeRedirectPath 会拒绝）；
 * - 受保护根内 * 兜底（BasicLayout 页签区渲染）：守卫保证渲染时已登录。
 * 两种场景统一从会话快照分支：已登录 → 旧 key「首页」按钮，按 T00 落点规则
 * （resolveLandingPath：首页优先 → 首个可用业务页 → 无权限页）导航；落点由
 * 落点解析产出，只可能是当前会话有权到达的定义树内地址，不构成 404 循环；
 * 未登录 → 「去登录」。
 *
 * 旧按钮固定跳 /over-look：该地址在新系统为暂缓说明页（H01），不作为
 * 恢复落点复刻；落点规则才是旧「回到可用页」语义的等价实现。
 *
 * 视觉：公开 /404 无外壳衬底，Result 直接叠在固定壁纸上，深色主题反白文字
 * 不可读（P41 同因），以玻璃窗口材质面板提供两主题衬底；布局内 * 兜底渲染
 * 同一面板，与外壳玻璃体系一致（令牌单源，无第二份配色）。
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button, Result } from 'antd'
import { useAppSelector } from '@/hooks/useAppSelector'
import { resolveLandingPath } from '@/router/routeAccess'
import { ROUTE_PATHS } from '@/router/definitions'
import styles from '@/pages/error/NotFound/NotFound.module.css'

export default function NotFound() {
  const { t } = useTranslation('error')
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)
  // 落点解析在 selector 内按最新会话快照计算（字符串结果，引用稳定）；
  // 未登录快照不解析（此时唯一合法出口是登录页）
  const landing = useAppSelector((state) =>
    state.auth.user !== null ? resolveLandingPath(state.auth) : null,
  )

  /** 返回首页（落点）：replace 让未知 URL 不残留在历史记录中 */
  const handleHome = useCallback(() => {
    if (landing !== null) navigate(landing, { replace: true })
  }, [landing, navigate])

  /** 去登录：未知 URL 不携带回跳参数（回跳校验会拒绝未知路径，带了也无效） */
  const handleGoLogin = useCallback(() => {
    navigate(ROUTE_PATHS['auth-login'], { replace: true })
  }, [navigate])

  return (
    <div className={styles.page}>
      {/* 玻璃反馈面板：公开 /404 直接叠壁纸，深浅主题都为 Result 提供可读衬底 */}
      <div className={styles.panel}>
        <Result
          status="404"
          title="404"
          /* 旧页主说明 key 等价迁移（en 沿用旧真译，见 error 分片四语言） */
          subTitle={t('抱歉，您访问的页面不存在')}
          extra={
            user !== null ? (
              <Button type="primary" onClick={handleHome}>
                {/* 旧按钮 key 等价迁移：落点=首页优先的首个可用业务页 */}
                {t('首页')}
              </Button>
            ) : (
              <Button type="primary" onClick={handleGoLogin}>
                {t('去登录')}
              </Button>
            )
          }
        />
      </div>
    </div>
  )
}
