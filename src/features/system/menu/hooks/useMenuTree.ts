/**
 * 菜单树 Hook：拉取扁平列表并按 parentId 组装为树。
 */

import { useCallback, useEffect, useState } from 'react'
import { usePageRequest } from '@/hooks/usePageRequest'
import { listMenus } from '@/services/system/menu/menu.service'
import { isCancelledError, toApiError } from '@/services/request/request'
import type { MenuTreeNode } from '@/types/system/menu/menu.types'

export interface UseMenuTreeResult {
  tree: MenuTreeNode[]
  loading: boolean
  error: string | null
  reload: () => void
}

/** 扁平实体 → 树（孤儿节点挂到根，避免整枝丢失） */
function buildTree(
  items: Array<Omit<MenuTreeNode, 'children'>>,
): MenuTreeNode[] {
  const byId = new Map<string, MenuTreeNode>()
  for (const item of items) byId.set(item.id, { ...item, children: [] })
  const roots: MenuTreeNode[] = []
  for (const node of byId.values()) {
    if (node.parentId !== null && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const bySort = (a: MenuTreeNode, b: MenuTreeNode) => a.sort - b.sort
  const sortTree = (nodes: MenuTreeNode[]) => {
    nodes.sort(bySort)
    nodes.forEach((node) => sortTree(node.children))
  }
  sortTree(roots)
  return roots
}

export function useMenuTree(): UseMenuTreeResult {
  const { signal, revision } = usePageRequest()
  const [tree, setTree] = useState<MenuTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    listMenus({ signal })
      .then((items) => {
        if (!active) return
        setTree(buildTree(items))
      })
      .catch((caught) => {
        if (!active || isCancelledError(caught)) return
        setError(toApiError(caught).title)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [signal, reloadToken, revision])

  return { tree, loading, error, reload }
}
