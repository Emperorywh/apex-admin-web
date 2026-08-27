/**
 * 菜单管理服务：列表、CRUD 与层级调整。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  CreateMenuRequestDto,
  MenuItemDto,
  UpdateMenuHierarchyRequestDto,
  UpdateMenuRequestDto,
} from '@/services/system/menu/menu.service.types'

export function listMenus(options?: RequestOptions): Promise<MenuItemDto[]> {
  return api.get<MenuItemDto[]>('/menus', { signal: options?.signal })
}

export function createMenu(body: CreateMenuRequestDto, options?: RequestOptions): Promise<MenuItemDto> {
  return api.post<MenuItemDto>('/menus', body, { signal: options?.signal })
}

export function updateMenu(id: string, body: UpdateMenuRequestDto, options?: RequestOptions): Promise<MenuItemDto> {
  return api.put<MenuItemDto>(`/menus/${id}`, body, { signal: options?.signal })
}

export function deleteMenu(id: string, options?: RequestOptions): Promise<void> {
  return api.delete<void>(`/menus/${id}`, { signal: options?.signal })
}

export function updateMenuHierarchy(
  id: string,
  body: UpdateMenuHierarchyRequestDto,
  options?: RequestOptions,
): Promise<MenuItemDto> {
  return api.put<MenuItemDto>(`/menus/${id}/hierarchy`, body, { signal: options?.signal })
}
