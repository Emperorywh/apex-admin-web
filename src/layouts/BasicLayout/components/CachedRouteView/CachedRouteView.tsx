/**
 * 缓存页签渲染器：以页签 location 快照调用 useRoutes(renderRoutes, snapshot)，
 * 使每个缓存实例拥有独立的 useLocation/useParams/useSearchParams 上下文（SPEC §4.1）。
 * 页面滚动发生在自身容器上，天然保留 scrollTop（SPEC §5.2）。
 */

import { useMemo } from 'react'
import { useRoutes, type Location } from 'react-router'
import { renderRoutes } from '@/router/projections'
import type { TabLocationSnapshot } from '@/store/slices/tabsSlice'
import styles from '@/layouts/BasicLayout/components/CachedRouteView/CachedRouteView.module.css'

interface CachedRouteViewProps {
  snapshot: TabLocationSnapshot
}

export function CachedRouteView({ snapshot }: CachedRouteViewProps) {
  // state 固定为 null：模板业务导航禁止依赖 location.state（SPEC §4.4）
  const locationArg = useMemo<Location>(
    () => ({
      pathname: snapshot.pathname,
      search: snapshot.search,
      hash: snapshot.hash,
      key: snapshot.key,
      state: null,
    }),
    [snapshot.pathname, snapshot.search, snapshot.hash, snapshot.key],
  )

  const element = useRoutes(renderRoutes, locationArg)
  return <div className={styles.scrollHost}>{element}</div>
}
