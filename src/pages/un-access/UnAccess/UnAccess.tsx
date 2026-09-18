/**
 * 无权限页（P41，独立全屏页，受认证守卫但无菜单码——布局外辅助落点）。
 *
 * 旧 UnAccess 迁移（antd Result 403 + 登出/去登录），到达路径均为已登录：
 * - 守卫把无权限访问一律 redirect 到本页；登录落点规则在全部业务页不可用时
 *   也落本页（A05/A22：无权限有明确落点，不白屏不死循环）；
 * - 返回动作不指向固定地址：按真实会话经 resolveLandingPath（T00 导航判断）
 *   计算合法落点；落点仍为本页（无任何可用业务页）时不渲染返回入口——
 *   页面提供的返回永不构成 /no-permission 重定向循环，也不提供绕过权限的
 *   入口（落点解析本身只产出当前会话有权到达的地址）；
 * - 退出登录走真实登出接口（POST /auth/authorize/logout），接口失败不阻塞
 *   本地清会话（客户端登出语义，不冒充服务端已登出），写操作不自动重试；
 * - 驻留期间会话被其他窗口登出时（user 为 null 的真实状态），呈现「去登录」
 *   而不是假装仍已登录（DoD 3 状态区分）；
 * - 本页只表达「无权限」一种语义：服务离线/接口缺口/本期暂缓由各业务页的
 *   StateBlock 呈现，不在本页混用（专项验收的状态区分）。
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button, Result } from 'antd'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { sessionExpired } from '@/store/slices/authSlice'
import { logout } from '@/services/auth/auth.service'
import { resolveLandingPath } from '@/router/routeAccess'
import { ROUTE_PATHS } from '@/router/definitions'
import styles from '@/pages/un-access/UnAccess/UnAccess.module.css'

export default function UnAccess() {
  const { t } = useTranslation('access-denied')
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.auth.user)
  // 落点解析在 selector 内按最新会话快照计算（字符串结果，引用稳定）；
  // 未登录快照不解析（此时唯一合法出口是登录页）
  const landing = useAppSelector((state) =>
    state.auth.user !== null ? resolveLandingPath(state.auth) : null,
  )
  // 落点即本页 = 当前会话无任何可用业务页：不提供返回入口（防循环）
  const canReturn = landing !== null && landing !== ROUTE_PATHS['no-permission']

  /** 返回落点：replace 避免无权限页残留在历史记录中反复被弹出 */
  const handleBack = useCallback(() => {
    if (landing !== null) navigate(landing, { replace: true })
  }, [landing, navigate])

  /** 退出登录：真实接口 + 本地清会话；接口失败也必须终止本地会话 */
  const handleSignOut = useCallback(() => {
    void (async () => {
      try {
        await logout()
      } catch {
        // 服务端登出失败（网络/会话已失效）不阻塞本地登出；
        // 旧系统同为本地直接清凭证，服务端状态随下次登录收敛
      } finally {
        dispatch(sessionExpired())
        navigate(ROUTE_PATHS['auth-login'], { replace: true })
      }
    })()
  }, [dispatch, navigate])

  /** 去登录：仅在会话已失效的防御场景可达（正常流程守卫不会送未登录用户到此） */
  const handleGoLogin = useCallback(() => {
    navigate(ROUTE_PATHS['auth-login'], { replace: true })
  }, [navigate])

  return (
    <div className={styles.page}>
      {/* 玻璃反馈面板：深浅主题下都为 Result 提供可读衬底（壁纸固定照片不随主题变化） */}
      <div className={styles.panel}>
        <Result
        status="403"
        title="403"
        subTitle={
          <>
            {t('无权限访问当前页面')}
            <p className={styles.hint}>
              {t('如需访问该页面，请联系管理员开通相应权限')}
            </p>
          </>
        }
        extra={
          user !== null ? (
            <>
              {canReturn && (
                <Button type="primary" onClick={handleBack}>
                  {t('返回可用页面')}
                </Button>
              )}
              <Button onClick={handleSignOut}>
                {/* 退出登录为全站通用动作：沿用 common 常驻命名空间的既有术语 */}
                {t('退出登录', { ns: 'common' })}
              </Button>
            </>
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
