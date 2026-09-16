/**
 * 用户管理服务：分页/筛选/CRUD、启停用、角色分配。
 *
 * 协议说明：下方模板方法仍为新协议（无令牌即失败），随 T078 页面迁移替换为
 * 旧协议；`updateUserPassword` 是本轮唯一按旧协议接入的方法（T017 外壳改密，
 * 附录B「updateUserPassword（外壳）」），归 system/user 服务域唯一实现。
 */

import { md5 } from '@/services/auth/crypto/md5'
import { api } from '@/services/request/request'
import { legacyPost } from '@/services/request/legacy/legacyRequest'
import type { EntityStatus, PageQuery, RequestOptions } from '@/services/request/request.types'
import type {
  CreateUserRequestDto,
  UpdateUserRequestDto,
  UpdateUserRolesRequestDto,
  UserItemDto,
  UserPageDto,
  UserRoleAssignmentDto,
} from '@/services/system/user/user.service.types'

/**
 * 当前登录用户修改本人密码（旧协议，源 ActionsRender + PasswordModal）。
 * 密码在此处做 32 位小写 MD5 摘要后上送（源规则：避免明文传输），
 * 调用方只传明文，不重复加密；成功/失败信封语义由 legacyPost 统一处理。
 */
export function updateUserPassword(input: { username: string; password: string }): Promise<void> {
  return legacyPost('/fms/v1/auth/user/updatePassword', {
    username: input.username,
    password: md5(input.password),
  })
}


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
