/**
 * 用户管理服务：分页/筛选/CRUD、启停用、角色分配。
 */

import { api } from '@/services/request/request'
import type { EntityStatus, PageQuery, RequestOptions } from '@/services/request/request.types'
import type {
  CreateUserRequestDto,
  UpdateUserRequestDto,
  UpdateUserRolesRequestDto,
  UserItemDto,
  UserPageDto,
  UserRoleAssignmentDto,
} from '@/services/system/user/user.service.types'

export interface UserListQuery extends PageQuery {
  status?: EntityStatus
}

function buildListParams(query: UserListQuery): Record<string, string> {
  const params: Record<string, string> = {
    page: String(query.page),
    pageSize: String(query.pageSize),
  }
  if (query.sort) params.sort = query.sort
  if (query.status) params.status = query.status
  return params
}

export function pageUsers(query: UserListQuery, options?: RequestOptions): Promise<UserPageDto> {
  return api.get<UserPageDto>('/users', { params: buildListParams(query), signal: options?.signal })
}

export function getUser(id: string, options?: RequestOptions): Promise<UserItemDto> {
  return api.get<UserItemDto>(`/users/${id}`, { signal: options?.signal })
}

export function createUser(body: CreateUserRequestDto, options?: RequestOptions): Promise<UserItemDto> {
  return api.post<UserItemDto>('/users', body, { signal: options?.signal })
}

export function updateUser(id: string, body: UpdateUserRequestDto, options?: RequestOptions): Promise<UserItemDto> {
  return api.put<UserItemDto>(`/users/${id}`, body, { signal: options?.signal })
}

export function enableUser(id: string, options?: RequestOptions): Promise<void> {
  return api.post<void>(`/users/${id}/enable`, null, { signal: options?.signal })
}

export function disableUser(id: string, options?: RequestOptions): Promise<void> {
  return api.post<void>(`/users/${id}/disable`, null, { signal: options?.signal })
}

export function deleteUser(id: string, options?: RequestOptions): Promise<void> {
  return api.delete<void>(`/users/${id}`, { signal: options?.signal })
}

export function getUserRoles(id: string, options?: RequestOptions): Promise<UserRoleAssignmentDto> {
  return api.get<UserRoleAssignmentDto>(`/users/${id}/roles`, { signal: options?.signal })
}

export function updateUserRoles(
  id: string,
  body: UpdateUserRolesRequestDto,
  options?: RequestOptions,
): Promise<UserRoleAssignmentDto> {
  return api.put<UserRoleAssignmentDto>(`/users/${id}/roles`, body, { signal: options?.signal })
}
