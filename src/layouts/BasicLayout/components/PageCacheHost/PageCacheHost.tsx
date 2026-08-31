/**
 * 页面缓存宿主（规格 §4.1/§4.5/§9.1/§9.3，纯前端模式）：
 * - 为每个可缓存页签保持稳定 key 的 <Activity mode="visible|hidden">，隐藏页保留
 *   React state 与 DOM（含独立滚动容器 scrollTop），Effect 由 Activity 生命周期清理/重建；
 * - 每个 Activity 内是 CachedRouteView：以该页签不可变 location 快照调用
 *   useRoutes(renderRoutes, snapshot)，独立获得路由上下文（§20 闸门 ①）；
 * - 每个缓存实例独立 PageErrorBoundary + Suspense（页面锚点自带）；
 * - 依据 Data Router 当前 location 同步页签：启动重建 affix 页签、打开/替换快照、
 *   执行 LRU 容量淘汰（PAGE_CACHE_MAX_ENTRIES 只统计非 affix，当前页与 affix 永不淘汰）；
 * - noCache/hideInTabs 页面只渲染当前实例（live 视图），离开即卸载、不进入 Activity/LRU。
 * 禁止缓存 Data Router 的 <Outlet/> 或 useOutlet() 结果——本组件只经纯渲染投影渲染页面。
 */
import { Activity, useLayoutEffect, useMemo, useRef } from 'react'
import { useLocation, useMatches, type RouteObject } from 'react-router'
import { useDispatch, useSelector } from 'react-redux'
import { PAGE_CACHE_MAX_ENTRIES } from '@/constants/app.constants'
import { PageActiveContext } from '@/hooks/usePageActive'
import { cacheEntriesRemoved, cacheEntryTouched } from '@/store/slices/pageCache.slice'
import { tabOpened } from '@/store/slices/tabs.slice'
import type { RootState } from '@/store/store'
import type { AffixTabRoute } from '@/layouts/BasicLayout/tabsModel'
import {
  buildAffixTabItem,
  resolveCurrentTabView,
  selectLruEvictions,
} from '@/layouts/BasicLayout/tabsModel'
import { CachedRouteView } from '../CachedRouteView/CachedRouteView'
import { PageErrorBoundary } from '../PageErrorBoundary/PageErrorBoundary'
import styles from './PageCacheHost.module.css'

export interface PageCacheHostProps {
  /** 纯渲染投影（renderRoutes）：由 BasicLayout 注入，模块初始化生成、引用稳定 */
  renderRoutes: RouteObject[]
  /** affix 页签投影：启动重建「Dashboard + 当前页签」用（规格 §9.3） */
  affixTabRoutes: readonly AffixTabRoute[]
}

export function PageCacheHost({ renderRoutes, affixTabRoutes }: PageCacheHostProps) {
  const dispatch = useDispatch()
  const location = useLocation()
  const matches = useMatches()
  const items = useSelector((state: RootState) => state.tabs.items)
  const lruOrder = useSelector((state: RootState) => state.pageCache.lruOrder)
  const revisions = useSelector((state: RootState) => state.pageCache.revisions)

  // 当前 location 的页签视图：meta 取最深带 meta 的 match（规格 §4.5）
  const view = useMemo(() => resolveCurrentTabView(location, matches), [location, matches])
  // 可见缓存实例：当前页可缓存时为其 key；noCache/hideInTabs 页面无可见缓存实例
  const visibleKey = view.cacheable ? view.key : null

  const bootedRef = useRef(false)
  // 页签同步（规格 §4.5/§9.3）：启动重建 affix 页签、随导航打开/替换快照并进入 LRU。
  // useLayoutEffect 保证 store 中的页签态与 TabsBar 高亮在绘制前完成同步；
  // 渲染本身只依赖 view（当前地址），不经受这层同步的时序影响。
  // 依赖只有 view：关闭激活页签的 dispatch 与后继导航之间存在一帧 items 变化而
  // location 未变的中间态，若依赖 items 会以陈旧 view 重开刚关闭的页签。
  useLayoutEffect(() => {
    if (!bootedRef.current) {
      bootedRef.current = true
      // 浏览器刷新重建（规格 §9.3）：空页签态时先建 affix 页签；当前页随后由下方
      // tabOpened 合入——当前即 affix 地址时同 key 替换，不会产生重复实例
      if (items.length === 0) {
        for (const affixRoute of affixTabRoutes) {
          dispatch(tabOpened({ tab: buildAffixTabItem(affixRoute) }))
        }
      }
    }
    if (view.tabbed) {
      dispatch(
        tabOpened({
          tab: { key: view.key, title: view.title, affix: view.affix, location: view.snapshot },
        }),
      )
      if (view.cacheable) {
        dispatch(cacheEntryTouched({ key: view.key }))
      }
    }
    // 依赖刻意只有 view：items.length 属启动重建的只读条件，列入依赖会使本 effect
    // 在「关闭激活页签已派发、后继导航尚未落地」的中间态以陈旧 view 重开该页签
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [view, affixTabRoutes, dispatch])

  // 容量淘汰（规格 §9.1/§17.13）：只统计非 affix 缓存，当前页与 affix 永不淘汰；
  // 页签保留、仅释放缓存实例，再激活时经上方 touched 重新挂载。
  // 以渲染后的最新切片状态为输入：同步 effect 派发的 touched/removed 完成后本 effect 执行。
  const affixKeys = useMemo(() => new Set(items.filter((tab) => tab.affix).map((tab) => tab.key)), [items])
  useLayoutEffect(() => {
    const evictions = selectLruEvictions(lruOrder, affixKeys, visibleKey, PAGE_CACHE_MAX_ENTRIES)
    if (evictions.length > 0) {
      dispatch(cacheEntriesRemoved({ keys: evictions }))
    }
  }, [lruOrder, affixKeys, visibleKey, dispatch])

  const cachedKeys = useMemo(() => new Set(lruOrder), [lruOrder])

  return (
    <div className={styles.host} data-region="page-cache-host">
      {items
        .filter((tab) => cachedKeys.has(tab.key))
        .map((tab) => {
          const visible = tab.key === visibleKey
          return (
            // 稳定 key = 页签 key + revision：刷新当前页签递增 revision 生成新 React key 重建（规格 §9.3）
            <Activity key={`${tab.key}::${revisions[tab.key] ?? 0}`} mode={visible ? 'visible' : 'hidden'}>
              <section className={styles.pagePane} data-page-pane={tab.key}>
                <PageErrorBoundary>
                  <PageActiveContext.Provider value={visible}>
                    <CachedRouteView routes={renderRoutes} snapshot={tab.location} />
                  </PageActiveContext.Provider>
                </PageErrorBoundary>
              </section>
            </Activity>
          )
        })}
      {visibleKey === null && (
        // noCache/hideInTabs 页面：只渲染当前实例，key 随地址变化，离开即卸载（规格 §9.1）
        <section key={`live::${view.key}`} className={styles.pagePane} data-page-pane={view.key} data-live-pane="">
          <PageErrorBoundary>
            <PageActiveContext.Provider value={true}>
              <CachedRouteView routes={renderRoutes} snapshot={view.snapshot} />
            </PageActiveContext.Provider>
          </PageErrorBoundary>
        </section>
      )}
    </div>
  )
}
