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

import { useEffect, useMemo, useRef } from 'react'
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { GlobalProgress } from '@/components/GlobalProgress/GlobalProgress'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAuth } from '@/hooks/useAuth'
import { collectAffixTabSeeds, ROUTE_IDS } from '@/router/definitions'
import { buildLoginPath } from '@/router/redirect'
import { findRouteMeta } from '@/router/projections'
import { buildObjectTabKey } from '@/router/objectTab'
import type { RouteHandle, RouteMeta } from '@/router/router.types'
import { affixTabsSeeded, tabSynced } from '@/store/slices/tabsSlice'
import { normalizeSearchString } from '@/utils/url'
import { DockMenu } from '@/layouts/BasicLayout/components/DockMenu/DockMenu'
import { Header } from '@/layouts/BasicLayout/components/Header/Header'
import { PageCacheHost } from '@/layouts/BasicLayout/components/PageCacheHost/PageCacheHost'
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
  const { isAuthenticated } = useAuth()
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

  /* 页签同步：hideInTabs 视图不生成页签；对象详情按「路径 + 对象标识」生成稳定 key */
  useEffect(() => {
    if (leaf === null || leaf.meta.hideInTabs) return
    const search = normalizeSearchString(location.search)
    let tabKey = leaf.meta.tabKeyMode === 'pathname' ? location.pathname : `${location.pathname}${search}`
    let tabSearch = search
    if (leaf.meta.objectParam !== undefined) {
      // 对象页签：兼容旧裸 query 并归一到规范参数，其余 query 不参与身份。
      // 页签快照统一存储规范参数形式的 search：激活导航据此把裸 query 地址
      // replace 成规范形式，二次同步命中同一页签只更新快照，不会因
      // normalizeSearchString 给裸 key 补「=」而产生第二个无身份页签
      const resolved = buildObjectTabKey(location.pathname, location.search, leaf.meta.objectParam)
      tabKey = resolved.key
      if (resolved.objectKey !== null) {
        tabSearch = `?${leaf.meta.objectParam}=${encodeURIComponent(resolved.objectKey)}`
      }
    }
    dispatch(
      tabSynced({
        tabKey,
        routeId: leaf.routeId,
        affix: leaf.meta.affixTab === true,
        closable: leaf.meta.affixTab !== true,
        cacheable: leaf.meta.noCache !== true,
        location: {
          pathname: location.pathname,
          search: tabSearch,
          hash: location.hash,
          key: location.key,
        },
      }),
    )
  }, [dispatch, leaf, location.pathname, location.search, location.hash, location.key])

  /* 页签操作（关闭/批量关闭）后的激活导航：URL 未变而激活页签变化时跳转到新激活页 */
  const activeTab = useMemo(
    () => tabsState.tabs.find((tab) => tab.key === tabsState.activeTabKey) ?? null,
    [tabsState],
  )
  const lastLocationKeyRef = useRef(location.key)
  useEffect(() => {
    /* URL 自身变化造成的差异由上方 tabSynced 对齐，属于瞬时状态：此时闭包里的
       activeTab 还是同步前的旧页签，据此跳转会立刻把地址拉回上一页，与同步
       交替发生即形成两页来回循环，因此本次判定直接跳过 */
    if (lastLocationKeyRef.current !== location.key) {
      lastLocationKeyRef.current = location.key
      return
    }
    if (activeTab === null) return
    const target = `${activeTab.location.pathname}${activeTab.location.search}${activeTab.location.hash}`
    const current = `${location.pathname}${location.search}${location.hash}`
    if (target !== current) {
      navigate(target, { replace: true })
    }
  }, [activeTab, location.pathname, location.search, location.hash, location.key, navigate])

  /* 会话失效：跳登录页并携带回跳地址（页签与缓存已由 sessionExpired 统一清空） */
  useEffect(() => {
    if (!isAuthenticated && !isPublicRoute) {
      navigate(buildLoginPath(location.pathname, location.search), { replace: true })
    }
  }, [isAuthenticated, isPublicRoute, navigate, location.pathname, location.search])

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
            布局与页签宿主之上），保证切页签/进全屏/切布局时任务继续接收回执 */}
      </main>
      <div className={styles.dockSlot}>
        <DockMenu />
      </div>
    </div>
  )
}
