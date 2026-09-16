/**
 * 页面会话订阅 Hook（T013）：业务页经此登记草稿与读写轻量页签状态，
 * 不直接操作 pageSessionStore，也不自行推导页签身份（与宿主共用同一规则）。
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useLocation, useMatches } from 'react-router'
import { resolveTabIdentity } from '@/router/tabIdentity'
import type { RouteHandle } from '@/router/router.types'
import type { DraftRecord } from '@/services/page-session/pageSession.types'
import {
  clearTabDraft,
  getLightState,
  getPageSessionSnapshot,
  setLightState as setLightStateInStore,
  setTabDraft as setTabDraftInStore,
  subscribePageSession,
} from '@/services/page-session/pageSessionStore'

/** 取最深业务叶子的 handle（与 SessionHost 的 resolveLeaf 同规则，页面侧轻量版） */
function useCurrentLeafMeta() {
  const matches = useMatches()
  return useMemo(() => {
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const handle = matches[i].handle as RouteHandle | undefined
      if (handle?.meta) return handle.meta
    }
    return null
  }, [matches])
}

export interface PageSessionController {
  /** 当前页签 key；满幅视图（hideInTabs）下为 null——此类视图不登记草稿 */
  tabKey: string | null
  /** 登记一份脏草稿：必须在用户实际修改数据的事件处理器中调用 */
  setDirty: (draftKey: string, label: string) => void
  /** 解除草稿保护：保存成功或用户确认重置后调用 */
  clearDirty: (draftKey: string) => void
  /** 保存轻量页签状态（可序列化；LRU 淘汰后重建仍可读回） */
  setLightState: (stateKey: string, value: unknown) => void
  /** 读取轻量页签状态；未保存过返回 undefined */
  getLightState: <T = unknown>(stateKey: string) => T | undefined
}

/**
 * 当前页面的会话控制器：页签身份按 SessionHost 同一规则解析
 * （对象页签含 objectParam 归一），保证页面登记与协调器检查指向同一页签。
 */
export function usePageSession(): PageSessionController {
  const location = useLocation()
  const meta = useCurrentLeafMeta()

  const tabKey = useMemo(() => {
    if (meta === null) return null
    return resolveTabIdentity(meta, location)?.tabKey ?? null
    // location 的四个字段共同参与身份；引用变化不需要额外依赖
  }, [meta, location.pathname, location.search, location.hash, location.key])

  const setDirty = useCallback(
    (draftKey: string, label: string) => {
      if (tabKey === null) return
      setTabDraftInStore(tabKey, draftKey, label)
    },
    [tabKey],
  )

  const clearDirty = useCallback(
    (draftKey: string) => {
      if (tabKey === null) return
      clearTabDraft(tabKey, draftKey)
    },
    [tabKey],
  )

  const setLightState = useCallback(
    (stateKey: string, value: unknown) => {
      if (tabKey === null) return
      setLightStateInStore(tabKey, stateKey, value)
    },
    [tabKey],
  )

  const getLightStateForTab = useCallback(
    <T,>(stateKey: string): T | undefined => {
      if (tabKey === null) return undefined
      return getLightState<T>(tabKey, stateKey)
    },
    [tabKey],
  )

  return { tabKey, setDirty, clearDirty, setLightState, getLightState: getLightStateForTab }
}

/** 订阅当前页签的草稿登记列表（页签栏打点/页面自展示用；本卡供验证探针使用） */
export function useTabDrafts(tabKey: string | null): readonly DraftRecord[] {
  const snapshot = useSyncExternalStore(subscribePageSession, getPageSessionSnapshot)
  if (tabKey === null) return []
  return snapshot.drafts[tabKey] ?? []
}
