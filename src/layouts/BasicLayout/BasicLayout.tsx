/**
 * 基础布局：复刻 macOS 风格外壳（顶部工具条（品牌+页签+状态）/ 工作区 / 底部 Dock）。
 *
 * - 在受保护根路由只挂载一次；不渲染 <Outlet/>，业务页全部经 PageCacheHost 输出
 * - 根据 Data Router location/matches 同步页签
 * - 页签状态变化后的激活跳转、会话失效跳转与 document.title 均在此收敛
 */

import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useMatches, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { GlobalProgress } from '@/components/GlobalProgress/GlobalProgress'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAuth } from '@/hooks/useAuth'
import { ROUTE_IDS } from '@/router/definitions'
import { buildLoginPath } from '@/router/redirect'
import { findRouteMeta } from '@/router/projections'
import type { RouteHandle, RouteMeta } from '@/router/router.types'
import { tabSynced } from '@/store/slices/tabsSlice'
import { normalizeSearchString } from '@/utils/url'
import { DockMenu } from '@/layouts/BasicLayout/components/DockMenu/DockMenu'
import { Header } from '@/layouts/BasicLayout/components/Header/Header'
import { PageCacheHost } from '@/layouts/BasicLayout/components/PageCacheHost/PageCacheHost'
import styles from '@/layouts/BasicLayout/BasicLayout.module.css'

interface ActiveLeaf {
  routeId: string
  meta: RouteMeta
}

type RouterMatches = ReturnType<typeof useMatches>

/** 取最深业务叶子；跳过受保护根与 index 重定向节点 */
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

export function BasicLayout() {
  const location = useLocation()
  const matches = useMatches()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { isAuthenticated } = useAuth()
  const tabsState = useAppSelector((state) => state.tabs)
  const { t } = useTranslation('menu')

  const leaf = useMemo(() => resolveLeaf(matches), [matches])

  /* 页签同步：hash 变化只更新快照（同 key 替换），hideInTabs 不生成页签 */
  useEffect(() => {
    if (leaf === null || leaf.meta.hideInTabs) return
    const search = normalizeSearchString(location.search)
    const tabKey = leaf.meta.tabKeyMode === 'pathname' ? location.pathname : `${location.pathname}${search}`
    dispatch(
      tabSynced({
        tabKey,
        routeId: leaf.routeId,
        affix: leaf.meta.affixTab === true,
        closable: leaf.meta.affixTab !== true,
        cacheable: leaf.meta.noCache !== true,
        location: {
          pathname: location.pathname,
          search,
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

  /* 会话失效：跳登录页并携带回跳地址 */
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(buildLoginPath(location.pathname, location.search), { replace: true })
    }
  }, [isAuthenticated, navigate, location.pathname, location.search])

  /* document.title 跟随当前激活页签 */
  const activeTitle = activeTab ? findRouteMeta(activeTab.routeId)?.title : leaf?.meta.title
  useEffect(() => {
    if (activeTitle) {
      document.title = `${t(activeTitle)} · ${t('企业运营中心')}`
    }
  }, [activeTitle, t])

  return (
    <div className={styles.shell}>
      <GlobalProgress />
      <Header />
      <main className={styles.workspace}>
        <PageCacheHost
          currentLocation={location}
          currentRouteId={leaf?.routeId ?? ''}
          currentMeta={leaf?.meta ?? null}
        />
      </main>
      <DockMenu />
    </div>
  )
}
