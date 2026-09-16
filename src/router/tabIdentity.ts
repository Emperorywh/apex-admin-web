/**
 * 页签身份解析（T013 抽取）：SessionHost 的页签同步与页面侧 useTabSession
 * 必须使用同一规则推导「当前页签 key」，否则页面登记的草稿/轻量状态会与
 * 协调器检查的页签对不上。
 *
 * 规则与 T007 页签同步一致（contracts/routing-host.md §6）：
 * - 满幅视图（hideInTabs）与公开路由不生成页签，返回 null；
 * - tabKeyMode=pathname 只用路径；默认「路径 + 规范化 search」；
 * - 对象页签按 objectParam 归一（兼容旧裸 query），其余参数不参与身份。
 */

import { buildObjectTabKey } from '@/router/objectTab'
import type { RouteMeta } from '@/router/router.types'
import { normalizeSearchString } from '@/utils/url'

/** 参与身份判定的最小位置形状（react-router Location 的子集，便于测试与复用） */
export interface TabIdentityLocation {
  pathname: string
  search: string
  hash: string
  key: string
}

/** 页签身份解析结果：tabKey 为页签唯一身份；tabSearch 为页签快照存储的规范 search */
export interface TabIdentity {
  tabKey: string
  tabSearch: string
}

/** 按路由 meta 与当前位置解析页签身份；该路由不生成页签时返回 null */
export function resolveTabIdentity(meta: RouteMeta, location: TabIdentityLocation): TabIdentity | null {
  if (meta.public === true || meta.hideInTabs === true) return null
  const search = normalizeSearchString(location.search)
  let tabKey = meta.tabKeyMode === 'pathname' ? location.pathname : `${location.pathname}${search}`
  let tabSearch = search
  if (meta.objectParam !== undefined) {
    // 对象页签：兼容旧裸 query 并归一到规范参数，其余 query 不参与身份
    const resolved = buildObjectTabKey(location.pathname, location.search, meta.objectParam)
    tabKey = resolved.key
    if (resolved.objectKey !== null) {
      tabSearch = `?${meta.objectParam}=${encodeURIComponent(resolved.objectKey)}`
    }
  }
  return { tabKey, tabSearch }
}
