/**
 * 菜单域跨层实体。
 */

import type { EntityStatus } from '@/services/request/request.types'

/** 菜单实体 */
export interface MenuEntity {
  id: string
  parentId: string | null
  name: string
  path: string
  icon: string | null
  sort: number
  status: EntityStatus
  createdAt: string
  updatedAt: string
}

/** 菜单树节点（列表接口实体按 parentId 组装） */
export interface MenuTreeNode extends MenuEntity {
  children: MenuTreeNode[]
}

/** 层级/排序调整 body 的单节点载荷 */
export interface MenuHierarchyNode {
  id: string
  parentId: string | null
  sort: number
}
