/**
 * 用户域请求/响应 DTO。写入请求体 extra="forbid"（多传字段即 422），创建/编辑不同构。
 */

import type { EntityStatus, PageResult } from '@/services/request/request.types'

/** GET /users 响应项 */
export interface UserItemDto {
  id: string
  username: string
  displayName: string
  email: string | null
  status: EntityStatus
  roleCodes: string[]
  createdAt: string
  updatedAt: string
}

export type UserPageDto = PageResult<UserItemDto>

/** POST /users 请求体 */
export interface CreateUserRequestDto {
  username: string
  password: string
  displayName: string
  email: string | null
  roleCodes: string[]
}

/** PUT /users/:id 请求体（不含 username/password） */
export interface UpdateUserRequestDto {
  displayName: string
  email: string | null
  roleCodes: string[]
}

/** GET/PUT /users/:id/roles 响应（后端无 response_model，键为 snake_case） */
export interface UserRoleAssignmentDto {
  user_id: string
  role_ids: string[]
}

/** PUT /users/:id/roles 请求体（角色编码而非 ID） */
export interface UpdateUserRolesRequestDto {
  roleCodes: string[]
}
