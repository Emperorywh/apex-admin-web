/**
 * 角色管理服务：分页/CRUD、启停用、详情（含权限码只读展示）。
 * 后端暂无权限分配端点，前端保持只读（SPEC 约定）。
 */

import { api } from '@/services/request/request'
import type { EntityStatus, PageQuery, RequestOptions } from '@/services/request/request.types'
import type {
  CreateRoleRequestDto,
  RoleItemDto,
  RolePageDto,
  UpdateRoleRequestDto,
} from '@/services/system/role/role.service.types'

export interface RoleListQuery extends PageQuery {
  status?: EntityStatus
}

export function pageRoles(query: RoleListQuery, options?: RequestOptions): Promise<RolePageDto> {
  const params: Record<string, string> = {
    page: String(query.page),
    pageSize: String(query.pageSize),
  }
  if (query.sort) params.sort = query.sort
  if (query.status) params.status = query.status
  return api.get<RolePageDto>('/roles', { params, signal: options?.signal })
}

export function getRole(idOrCode: string, options?: RequestOptions): Promise<RoleItemDto> {
  return api.get<RoleItemDto>(`/roles/${idOrCode}`, { signal: options?.signal })
}

export function createRole(body: CreateRoleRequestDto, options?: RequestOptions): Promise<RoleItemDto> {
  return api.post<RoleItemDto>('/roles', body, { signal: options?.signal })
}

export function updateRole(id: string, body: UpdateRoleRequestDto, options?: RequestOptions): Promise<RoleItemDto> {
  return api.put<RoleItemDto>(`/roles/${id}`, body, { signal: options?.signal })
}

export function enableRole(id: string, options?: RequestOptions): Promise<void> {
  return api.post<void>(`/roles/${id}/enable`, null, { signal: options?.signal })
}

export function disableRole(id: string, options?: RequestOptions): Promise<void> {
  return api.post<void>(`/roles/${id}/disable`, null, { signal: options?.signal })
}

export function deleteRole(id: string, options?: RequestOptions): Promise<void> {
  return api.delete<void>(`/roles/${id}`, { signal: options?.signal })
}
