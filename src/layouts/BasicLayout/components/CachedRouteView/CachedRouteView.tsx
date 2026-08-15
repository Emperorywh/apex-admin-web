/**
 * 纯渲染路由视图（规格 §4.1 投影 2/§9.1）：
 * 以所属页签的不可变 location 快照调用 useRoutes(renderRoutes, snapshot)，
 * 让每个缓存实例获得独立的 useLocation/useParams/useSearchParams 上下文
 * （互不串值，§20 闸门 ① 已验证）。禁止缓存 Data Router 的 <Outlet/> 或
 * useOutlet() 结果——本组件不接触 Data Router 的元素树。
 * routes 由调用方注入模块级稳定的三投影 renderRoutes，本组件不重建路由。
 */
import { useRoutes, type RouteObject } from 'react-router'
import type { TabLocationSnapshot } from '@/store/slices/tabs.slice'

export interface CachedRouteViewProps {
  /** 纯渲染投影（renderRoutes）：模块初始化生成、引用稳定（规格 §4.1） */
  routes: RouteObject[]
  /** 本页签的不可变 location 快照（规格 §4.5） */
  snapshot: TabLocationSnapshot
}

/** 单个缓存实例的路由渲染：组件顶层调用 useRoutes，绝不在列表循环体内调用 hook */
export function CachedRouteView({ routes, snapshot }: CachedRouteViewProps) {
  return useRoutes(routes, snapshot)
}
