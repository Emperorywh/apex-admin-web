/**
 * 菜单树 Hook：拉取扁平列表并按 parentId 组装为树。
 * 查询生命周期统一由 usePageQuery 接管（可见性、过期响应隔离、取消）。
 */

import { useCallback } from 'react'
import { usePageQuery } from '@/hooks/page-query'
import { listMenus } from '@/services/system/menu/menu.service'
import { toApiError } from '@/services/request/request'
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
  const page = usePageQuery({
    fetcher: (_params, { signal }) => listMenus({ signal }),
    params: null,
  })

  const reload = useCallback(() => page.reload(), [page.reload])

  return {
    tree: page.data ? buildTree(page.data) : [],
    loading: page.loading,
    error: page.error ? toApiError(page.error).title : null,
    reload,
  }
}
