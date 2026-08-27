/**
 * 页面缓存宿主：为每个可缓存页签保持一个稳定 key 的 <Activity>（SPEC §5.1）。
 * - 隐藏页保存 React state 与 DOM；Effects 被清理，重新显示时恢复并重建
 * - LRU 淘汰（cached=false）的页签不渲染 Activity，再激活时重新挂载
 * - noCache / hideInTabs 的当前页面走「当前实例」分支，离开即卸载
 * - 每个实例拥有独立 PageErrorBoundary、Suspense 与请求 scope
 */

import { Activity } from 'react'
import { useMemo } from 'react'
import type { Location } from 'react-router'
import { RequestScopeProvider } from '@/components/RequestScopeProvider/RequestScopeProvider'
import { useAppSelector } from '@/hooks/useAppSelector'
import { CachedRouteView } from '@/layouts/BasicLayout/components/CachedRouteView/CachedRouteView'
import { PageErrorBoundary } from '@/layouts/BasicLayout/components/PageErrorBoundary/PageErrorBoundary'
import type { RouteMeta } from '@/router/router.types'
import type { TabEntry, TabLocationSnapshot } from '@/store/slices/tabsSlice'

interface PageCacheHostProps {
  currentLocation: Location
  currentRouteId: string
  currentMeta: RouteMeta | null
}

export function PageCacheHost({ currentLocation, currentRouteId, currentMeta }: PageCacheHostProps) {
  const tabs = useAppSelector((state) => state.tabs.tabs)
  const activeTabKey = useAppSelector((state) => state.tabs.activeTabKey)

  return (
    <>
      {tabs
        .filter((tab) => tab.cached)
        .map((tab) => (
          <Activity key={tab.key} mode={tab.key === activeTabKey ? 'visible' : 'hidden'}>
            <CachedPage tab={tab} isActive={tab.key === activeTabKey} />
          </Activity>
        ))}
      {currentMeta !== null && (currentMeta.noCache === true || currentMeta.hideInTabs === true) && (
        <CurrentPage location={currentLocation} routeId={currentRouteId} />
      )}
    </>
  )
}

function CachedPage({ tab, isActive }: { tab: TabEntry; isActive: boolean }) {
  return (
    <PageErrorBoundary>
      <RequestScopeProvider scopeKey={tab.key} revision={tab.revision} isActive={isActive}>
        <CachedRouteView snapshot={tab.location} />
      </RequestScopeProvider>
    </PageErrorBoundary>
  )
}

/** 当前实例：以 location.key 为 scope，导航离开即整体卸载并取消请求 */
function CurrentPage({ location, routeId }: { location: Location; routeId: string }) {
  const snapshot = useMemo<TabLocationSnapshot>(
    () => ({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      key: location.key,
    }),
    [location.pathname, location.search, location.hash, location.key],
  )
  return (
    <PageErrorBoundary>
      <RequestScopeProvider
        scopeKey={`current:${routeId}:${location.key}`}
        revision={0}
        isActive={true}
      >
        <CachedRouteView snapshot={snapshot} />
      </RequestScopeProvider>
    </PageErrorBoundary>
  )
}
