/**
 * 页面缓存宿主：为每个可缓存页签保持一个稳定 key 的 <Activity>。
 * - 隐藏页保存 React state 与 DOM；Effects 被清理，重新显示时恢复并重建
 * - LRU 淘汰（cached=false）的页签不渲染 Activity，再激活时重新挂载
 * - noCache / hideInTabs 的当前页面走「当前实例」分支，离开即卸载
 * - 每个实例拥有独立 PageErrorBoundary、Suspense 与请求 scope
 * - 窗口开合动画：页面图层挂载时自 Dock 缩放浮入；被移除的激活页签在
 *   同一次渲染内转入「关闭中」继续保留（实例只移动不卸载，动画播完再移除），
 *   后台页签移除不做动画；macOS 语义见 PageCacheHost.module.css
 */

import { Activity, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Location } from 'react-router'
import { RequestScopeProvider } from '@/components/RequestScopeProvider/RequestScopeProvider'
import { useAppSelector } from '@/hooks/useAppSelector'
import { CachedRouteView } from '@/layouts/BasicLayout/components/CachedRouteView/CachedRouteView'
import { PageErrorBoundary } from '@/layouts/BasicLayout/components/PageErrorBoundary/PageErrorBoundary'
import type { RouteMeta } from '@/router/router.types'
import type { TabEntry, TabLocationSnapshot } from '@/store/slices/tabsSlice'
import styles from '@/layouts/BasicLayout/components/PageCacheHost/PageCacheHost.module.css'

interface PageCacheHostProps {
  currentLocation: Location
  currentRouteId: string
  currentMeta: RouteMeta | null
}

/** 关闭动画的兜底清理时限：正常由图层 pageClose 的 animationend 先行移除（如系统关闭动画时） */
const CLOSE_FALLBACK_MS = 1000

export function PageCacheHost({ currentLocation, currentRouteId, currentMeta }: PageCacheHostProps) {
  const tabs = useAppSelector((state) => state.tabs.tabs)
  const activeTabKey = useAppSelector((state) => state.tabs.activeTabKey)

  /** 已从 store 移除、正在播放关闭动画的页签（保留原 TabEntry 以继续渲染其快照） */
  const [dyingTabs, setDyingTabs] = useState<TabEntry[]>([])
  const [prevTabs, setPrevTabs] = useState(tabs)
  const [prevActiveKey, setPrevActiveKey] = useState(activeTabKey)
  const fallbackTimersRef = useRef(new Map<string, number>())

  const tabKeys = useMemo(() => new Set(tabs.map((tab) => tab.key)), [tabs])

  /* 渲染期调整（React 认可的 derived-state 模式，同 RequestScopeProvider）：
     激活页签被移除的判定必须与 store 变更同帧生效，否则其实例会先卸载再重挂，
     页面 DOM 与滚动位置都会丢失，收合动画也就无从谈起 */
  if (prevTabs !== tabs || prevActiveKey !== activeTabKey) {
    const removedActiveTab =
      prevActiveKey !== null && !tabKeys.has(prevActiveKey)
        ? prevTabs.find((tab) => tab.key === prevActiveKey)
        : undefined
    setPrevTabs(tabs)
    setPrevActiveKey(activeTabKey)
    setDyingTabs((prev) => {
      let changed = false
      const next = prev.filter((tab) => {
        /* 关闭动画期间又被重新打开的页签退出关闭中，实例交还原列表 */
        if (tabKeys.has(tab.key)) {
          changed = true
          return false
        }
        return true
      })
      if (removedActiveTab !== undefined && !next.some((tab) => tab.key === removedActiveTab.key)) {
        next.push(removedActiveTab)
        changed = true
      }
      return changed ? next : prev
    })
  }

  /* 为关闭中的页签武装兜底定时器（幂等）；animationend 正常触发时会先清理 */
  useEffect(() => {
    const timers = fallbackTimersRef.current
    for (const tab of dyingTabs) {
      if (timers.has(tab.key)) continue
      timers.set(
        tab.key,
        window.setTimeout(() => {
          timers.delete(tab.key)
          setDyingTabs((prev) => prev.filter((item) => item.key !== tab.key))
        }, CLOSE_FALLBACK_MS),
      )
    }
  }, [dyingTabs])

  useEffect(() => {
    const timers = fallbackTimersRef.current
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer)
      timers.clear()
    }
  }, [])

  const settleClosedTab = (key: string) => {
    const timer = fallbackTimersRef.current.get(key)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      fallbackTimersRef.current.delete(key)
    }
    setDyingTabs((prev) => prev.filter((tab) => tab.key !== key))
  }

  const dyingShown = dyingTabs.filter((tab) => !tabKeys.has(tab.key))

  return (
    <>
      {tabs
        .filter((tab) => tab.cached)
        .map((tab) => (
          <Activity key={tab.key} mode={tab.key === activeTabKey ? 'visible' : 'hidden'}>
            <PageLayer>
              <CachedPage tab={tab} isActive={tab.key === activeTabKey} />
            </PageLayer>
          </Activity>
        ))}
      {dyingShown.map((tab) => (
        <Activity key={tab.key} mode="visible">
          <PageLayer closing onCloseAnimationEnd={() => settleClosedTab(tab.key)}>
            <CachedPage tab={tab} isActive={false} />
          </PageLayer>
        </Activity>
      ))}
      {currentMeta !== null && (currentMeta.noCache === true || currentMeta.hideInTabs === true) && (
        <PageLayer>
          <CurrentPage location={currentLocation} routeId={currentRouteId} />
        </PageLayer>
      )}
    </>
  )
}

/**
 * 页面图层：挂载即播放一次自 Dock 浮入的开窗动画。
 * Activity 隐藏/显示通过 display 切换，而 display 复位会重放元素上存续的动画，
 * 因此 pageOpening 播毕即移除，保证切回缓存页时瞬时呈现、不重放。
 */
function PageLayer({
  closing = false,
  onCloseAnimationEnd,
  children,
}: {
  closing?: boolean
  onCloseAnimationEnd?: () => void
  children: ReactNode
}) {
  const [opening, setOpening] = useState(true)
  const className =
    styles.pageLayer +
    (opening && !closing ? ` ${styles.pageOpening}` : '') +
    (closing ? ` ${styles.pageClosing}` : '')
  return (
    <div
      className={className}
      aria-hidden={closing || undefined}
      onAnimationEnd={(event) => {
        /* 只认图层自身的动画结束；页面内容冒泡上来的动画一律忽略 */
        if (event.target !== event.currentTarget) return
        if (closing) onCloseAnimationEnd?.()
        else setOpening(false)
      }}
    >
      {children}
    </div>
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
