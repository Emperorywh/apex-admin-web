/**
 * 菜单域请求/响应 DTO。层级/排序调整走独立 hierarchy 端点（创建/编辑请求体不同构）。
 */

import type { EntityStatus } from '@/services/request/request.types'

export interface MenuItemDto {
  id: string
  parentId: string | null
  name: string
  path: string
  icon: string | null
  sort: number
  status: EntityStatus
  permCode: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMenuRequestDto {
  parentId: string | null
  name: string
  path: string
  icon: string | null
  sort: number
  permCode: string | null
}

export interface UpdateMenuRequestDto {
  name: string
  path: string
  icon: string | null
  sort: number
  permCode: string | null
}

/** PUT /menus/:id/hierarchy 请求体 */
export interface UpdateMenuHierarchyRequestDto {
  parentId: string | null
  sort: number
}
