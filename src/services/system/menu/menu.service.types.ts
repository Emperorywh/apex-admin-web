/**
 * 菜单管理接口请求/响应 DTO 权威定义（规格 §14.3）。
 * 菜单树/创建/编辑/删除接口的 DTO 只在本文件定义一次，
 * 调用端（含 demo adapter）一律 import type 引用，不得复制接口；
 * 响应实体 MenuItem 是跨层业务实体，权威定义位于 src/types/system/menu/menu.types.ts，
 * 此处仅以别名声明 DTO 名称。
 */
import type { MenuItem } from '@/types/system/menu/menu.types'

/**
 * POST /menus 与 PUT /menus/:id 请求体（创建/编辑同构，规格 §14.3 写入契约）：
 * { parentId, type, name, routeId?, path?, permCode?, sort, visible, status }。
 * 按类型条件约束：directory 不得设置 routeId，page 必须设置可识别 routeId
 * （可识别全集见 MENU_PAGE_ROUTE_IDS），button 必须设置 permCode。
 */
export interface MenuWriteRequestDto {
  parentId: string | null
  type: MenuItem['type']
  name: string
  routeId?: string
  path?: string
  permCode?: string
  sort: number
  visible: boolean
  status: MenuItem['status']
}

/** GET /menus/tree 响应 data：菜单树（不分页，兄弟节点按 sort asc、id asc 稳定排序） */
export type MenuTreeResponseDto = MenuItem[]

/** POST /menus、PUT /menus/:id 响应 data：变更后的菜单实体 */
export type MenuMutationResponseDto = MenuItem
