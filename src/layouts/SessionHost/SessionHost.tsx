/**
 * 稳定会话宿主：挂在全部受保护路由之上的最外层布局（SPEC §8.1/§9.1）。
 *
 * - 登录页（meta.public）直接 <Outlet/>，不进入会话宿主；
 * - 其余路由（业务页、全屏、暂缓提示、404、无权限、软件授权）同属登录会话内的
 *   视图切换：宿主保持挂载，页签缓存宿主不销毁；全屏/暂缓/提示类视图仅隐藏
 *   外壳（顶栏/Dock），对应页签转入隐藏态——查询暂停、草稿与选中保留；
 * - 页签同步、激活导航、会话失效跳转与 document.title 在此收敛
 *   （自原 BasicLayout 迁移，宿主层级提升后独立于布局切换）；
 * - T011 挂载点：会话级写入/文件传输任务层应挂载在 PageCacheHost 旁
 *   （宿主层级），保证切页签/切布局时任务继续接收回执。
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Outlet, useBlocker, useLocation, useMatches, useNavigate } from 'react-router'
import { Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { GlobalProgress } from '@/components/GlobalProgress/GlobalProgress'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAuth } from '@/hooks/useAuth'
import { collectAffixTabSeeds, ROUTE_IDS, ROUTE_PATHS } from '@/router/definitions'
import { resolveFirstAccessiblePath } from '@/router/firstAccessible'
import { buildLoginPath } from '@/router/redirect'
import { findRouteMeta } from '@/router/projections'
import { resolveTabIdentity } from '@/router/tabIdentity'
import type { RouteHandle, RouteMeta } from '@/router/router.types'
import { affixTabsSeeded, tabSynced } from '@/store/slices/tabsSlice'
import {
  collectProtectedTabKeys,
  needsCapacityAdmission,
} from '@/services/page-session/leaveGuard'
import { DockMenu } from '@/layouts/BasicLayout/components/DockMenu/DockMenu'
import { Header } from '@/layouts/BasicLayout/components/Header/Header'
import { PageCacheHost } from '@/layouts/BasicLayout/components/PageCacheHost/PageCacheHost'
import { LeaveGuardHost } from '@/layouts/SessionHost/LeaveGuardHost'
import { SessionTasksHost } from '@/layouts/SessionHost/SessionTasksHost'
import { LogoutConfirmHost } from '@/features/auth/components/LogoutConfirmHost/LogoutConfirmHost'
import styles from '@/layouts/SessionHost/SessionHost.module.css'

interface ActiveLeaf {
  routeId: string
  meta: RouteMeta
}

type RouterMatches = ReturnType<typeof useMatches>

/** 取最深业务叶子；跳过受保护根、根 index 重定向与无 handle 的包装节点 */
function resolveLeaf(matches: RouterMatches): ActiveLeaf | null {
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i]
    if (match.id === ROUTE_IDS['root'] || match.id === ROUTE_IDS['root-index']) continue
    const handle = match.handle as RouteHandle | undefined
    if (handle?.meta) {
      return { routeId: String(match.id), meta: handle.meta }
    }
  }
  return null
}

export function SessionHost() {
  const location = useLocation()
  const matches = useMatches()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { isAuthenticated, identity } = useAuth()
  const tabsState = useAppSelector((state) => state.tabs)
  const { t } = useTranslation('menu')

  const leaf = useMemo(() => resolveLeaf(matches), [matches])

  /** 登录页等公开路由：不进会话宿主，直接渲染子路由 */
  const isPublicRoute = leaf?.meta.public === true

  /**
   * 会话内满幅视图（全屏/暂缓提示/404/无权限/软件授权）：
   * 不生成页签且无缓存的当前视图，隐藏外壳并挂起全部页签查询。
   */
  const isOverlayView = leaf !== null && leaf.meta.hideInTabs === true && !isPublicRoute

  /* 常驻页签播种：刷新/重登后从路由定义恢复 affix 页签；先于页签同步，保证 affix 位于固定区 */
  useEffect(() => {
    dispatch(affixTabsSeeded(collectAffixTabSeeds()))
  }, [dispatch])

  /* 页签同步：hideInTabs 视图不生成页签；对象详情按「路径 + 对象标识」生成稳定 key。
     身份规则收敛在 router/tabIdentity（页面侧 usePageSession 共用）；
     受保护页签清单按保护快照现算传入，LRU 淘汰时豁免（T013 §9.1） */
  useEffect(() => {
    if (leaf === null) return
    const identity = resolveTabIdentity(leaf.meta, location)
    if (identity === null) return
    dispatch(
      tabSynced({
        tabKey: identity.tabKey,
        routeId: leaf.routeId,
        affix: leaf.meta.affixTab === true,
        closable: leaf.meta.affixTab !== true,
        cacheable: leaf.meta.noCache !== true,
        location: {
          pathname: location.pathname,
          search: identity.tabSearch,
          hash: location.hash,
          key: location.key,
        },
        protectedTabKeys: collectProtectedTabKeys(),
      }),
    )
  }, [dispatch, leaf, location.pathname, location.search, location.hash, location.key])

  /* 容量准入（T013 §9.1）：目标会新建页签、缓存已满且候选全部受保护时，
     在导航提交前（useBlocker 保持 blocked）弹确认——确认则继续打开（暂时
     超容量、受保护页不淘汰），取消则留在当前页；其余导航不被拦截。 */
  const { t: tCommon } = useTranslation('common')
  const isAuthenticatedRef = useRef(isAuthenticated)
  isAuthenticatedRef.current = isAuthenticated
  const shouldCheckCapacity = useCallback((to: { pathname: string; search: string }) => {
    /* 认证失效跳转登录页永不拦截；容量判定在守卫回调内同步完成 */
    if (!isAuthenticatedRef.current) return false
    return needsCapacityAdmission(to.pathname, to.search)
  }, [])
  const capacityBlocker = useBlocker(({ nextLocation: to }) => shouldCheckCapacity(to))

  /* 页签操作（关闭/批量关闭）后的激活导航：URL 未变而激活页签变化时跳转到新激活页 */  const activeTab = useMemo(
    () => tabsState.tabs.find((tab) => tab.key === tabsState.activeTabKey) ?? null,
    [tabsState],
  )
  const lastLocationKeyRef = useRef(location.key)
  /* 会话内是否出现过任意页签：挂载初期的渲染（含 StrictMode 双挂载）读到的是
     播种/同步 dispatch 落地前的空快照，不能据此认定「用户关闭了全部页签」；
     只有先见过页签、后变为空，才允许触发兜底导航（T015 修复的深链竞态） */
  const hadTabsRef = useRef(false)
  if (tabsState.tabs.length > 0) hadTabsRef.current = true
  useEffect(() => {
    /* URL 自身变化造成的差异由上方 tabSynced 对齐，属于瞬时状态：此时闭包里的
       activeTab 还是同步前的旧页签，据此跳转会立刻把地址拉回上一页，与同步
       交替发生即形成两页来回循环，因此本次判定直接跳过 */
    if (lastLocationKeyRef.current !== location.key) {
      lastLocationKeyRef.current = location.key
      return
    }
    if (activeTab === null) {
      /* 全部页签被关闭（T013）：不留无宿主空页，replace 回首个有权入口，
         由页签同步重新播种；满幅视图/公开路由不在此列 */
      if (
        tabsState.tabs.length === 0 &&
        hadTabsRef.current &&
        !isOverlayView &&
        !isPublicRoute &&
        identity !== null
      ) {
        navigate(resolveFirstAccessiblePath(identity), { replace: true })
      }
      return
    }
    const target = `${activeTab.location.pathname}${activeTab.location.search}${activeTab.location.hash}`
    const current = `${location.pathname}${location.search}${location.hash}`
    if (target !== current) {
      navigate(target, { replace: true })
    }
  }, [activeTab, identity, isOverlayView, isPublicRoute, location.pathname, location.search, location.hash, location.key, navigate, tabsState.tabs.length])

  /* 会话失效：跳登录页并携带回跳地址（页签与缓存已由 sessionExpired 统一清空） */
  useEffect(() => {
    if (!isAuthenticated && !isPublicRoute) {
      navigate(buildLoginPath(location.pathname, location.search), { replace: true })
    }
  }, [isAuthenticated, isPublicRoute, navigate, location.pathname, location.search])

  /* 软件授权挂起（1001000，T015）：转入授权页视图（会话内切换，不销毁页签
     宿主）；任务停等/传输取消由失效编排器完成，草稿与页签会话保留。
     恢复后的返回路由由 T018 授权页在激活恢复接口通过后编排 */
  const authorizationRequired = useAppSelector((state) => state.auth.authorizationRequired)
  const onAuthorizeRoute = leaf?.routeId === ROUTE_IDS['authorize-ingress']
  useEffect(() => {
    if (authorizationRequired && identity !== null && !onAuthorizeRoute) {
      navigate(ROUTE_PATHS['authorize-ingress'], { replace: true })
    }
  }, [authorizationRequired, identity, onAuthorizeRoute, navigate])

  /* document.title：满幅视图跟随时叶子标题；常规视图跟随当前激活页签 */
  const activeTitle = isOverlayView
    ? leaf?.meta.title
    : (activeTab ? findRouteMeta(activeTab.routeId)?.title : leaf?.meta.title)
  useEffect(() => {
    if (activeTitle) {
      document.title = `${t(activeTitle)} · ${t('调度系统')}`
    }
  }, [activeTitle, t])

  if (isPublicRoute) {
    return <Outlet />
  }

  return (
    <div className={`${styles.shell} ${isOverlayView ? styles.shellBare : ''}`}>
      <GlobalProgress />
      <div className={styles.headerSlot}>
        <Header />
      </div>
      <main className={styles.workspace}>
        <PageCacheHost
          currentLocation={location}
          currentRouteId={leaf?.routeId ?? ''}
          currentMeta={leaf?.meta ?? null}
          overlayActive={isOverlayView}
        />
        {/* T011 挂载点：会话级写入/文件传输任务层挂载于此（与 PageCacheHost 同级、
            布局与页签宿主之上），保证切页签/进全屏/切布局时任务继续接收回执；
            纪元变化（登出/切账号/失效）时由宿主清空旧会话任务记录 */}
        <SessionTasksHost />
        {/* T013：离开保护宿主——离开确认弹窗、beforeunload 原生守卫与
            页面会话（草稿/轻量状态）纪元复位，同处稳定会话层 */}
        <LeaveGuardHost />
        {/* T017：退出二次确认宿主（声明式，替代命令式 modal.confirm） */}
        <LogoutConfirmHost />
      </main>
      <div className={styles.dockSlot}>
        <DockMenu />
      </div>
      {/* 容量准入确认（T013）：声明式渲染——blocked 即挂载、裁决后随状态卸载，
          由 React 保证清理；不用命令式 modal.confirm，连续拦截下它会产生无法
          销毁的僵尸弹窗实例（与 LeaveGuardHost 同一教训）。blocked 期间再次
          导航会换新 capacityBlocker，闭包始终 proceed/reset 当前被拦导航 */}
      {capacityBlocker.state === 'blocked' && (
        <Modal
          open
          title={tCommon('页签容量已满')}
          okText={tCommon('仍要打开')}
          cancelText={tCommon('留在当前页')}
          onOk={() => capacityBlocker.proceed()}
          onCancel={() => capacityBlocker.reset()}
        >
          {tCommon(
            '存在带草稿或执行中任务的受保护页签且缓存已满。可先处理任务、保存或关闭受保护页签；仍要打开将继续，受保护页签不会被淘汰。',
          )}
        </Modal>
      )}
    </div>
  )
}
