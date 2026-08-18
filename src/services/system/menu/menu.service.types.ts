/**
 * 菜单管理接口请求/响应 DTO 权威定义（对齐真实后端 menu 模块，apex-admin SPEC 9.3/15.1）。
 * DTO 只在本文件定义一次，调用端一律 import type 引用，不得复制接口；
 * 响应实体 MenuItem 是跨层业务实体，权威定义位于 src/types/system/menu/menu.types.ts，
 * 此处仅以别名声明 DTO 名称。
 */
import type { MenuItem, MenuType } from '@/types/system/menu/menu.types'

/**
 * POST /menus 请求体（MenuCreateRequest，后端 extra="forbid"）：
 * menuType 创建后不可变更；status 不在请求体中（启停用走独立端点）。
 */
export interface MenuCreateRequestDto {
  parentId: string | null
  menuType: MenuType
  title: string
  name?: string
  path?: string
  component?: string
  icon?: string
  sortOrder: number
  visible: boolean
}

/**
 * PUT /menus/:menuId 请求体（MenuUpdateRequest，后端 extra="forbid"）：
 * 与创建不同构——不含 parentId/menuType/sortOrder（层级与排序调整走独立端点）。
 */
export interface MenuUpdateRequestDto {
  title: string
  name?: string
  path?: string
  component?: string
  icon?: string
  visible: boolean
}

/** PUT /menus/:menuId/hierarchy 请求体（MenuHierarchyRequest）：调整父级与排序，循环层级返回 409 */
export interface MenuHierarchyRequestDto {
  parentId: string | null
  sortOrder: number
}

/** GET /menus/tree 响应：完整菜单树（含不可见菜单，children 已按 sortOrder 排序） */
export type MenuTreeResponseDto = MenuItem[]

/** POST /menus、PUT /menus/:menuId、PUT /menus/:menuId/hierarchy、POST /menus/:menuId/enable|disable 响应：变更后的菜单实体 */
export type MenuMutationResponseDto = MenuItem
