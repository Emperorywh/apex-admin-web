/**
 * 角色域请求/响应 DTO。
 */

import type { EntityStatus, PageResult } from '@/services/request/request.types'

export interface RoleItemDto {
  id: string
  code: string
  name: string
  description: string | null
  status: EntityStatus
  memberCount?: number
  permissionCodes?: string[]
  createdAt: string
  updatedAt: string
}

export type RolePageDto = PageResult<RoleItemDto>

export interface CreateRoleRequestDto {
  code: string
  name: string
  description: string | null
}

export interface UpdateRoleRequestDto {
  name: string
  description: string | null
}
