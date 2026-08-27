/**
 * 用户域跨层实体（页面、组件与 service 共用的 ViewModel）。
 */

import type { EntityStatus, PageResult } from '@/services/request/request.types'

/** 用户实体 */
export interface UserEntity {
  id: string
  username: string
  displayName: string
  email: string | null
  status: EntityStatus
  roleCodes: string[]
  createdAt: string
  updatedAt: string
}

/** 用户分页结果 */
export type UserPage = PageResult<UserEntity>

/** 用户与角色的关联（GET/PUT /users/:id/roles，响应为 snake_case，此处已转换） */
export interface UserRoleAssignment {
  userId: string
  roleIds: string[]
}
