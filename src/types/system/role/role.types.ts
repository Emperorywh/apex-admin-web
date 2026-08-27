/**
 * 角色域跨层实体。
 */

import type { EntityStatus, PageResult } from '@/services/request/request.types'

/** 角色实体 */
export interface RoleEntity {
  id: string
  code: string
  name: string
  description: string | null
  status: EntityStatus
  /** 成员数（仅详情接口返回） */
  memberCount?: number
  createdAt: string
  updatedAt: string
}

/** 角色分页结果 */
export type RolePage = PageResult<RoleEntity>

/** 下拉用的角色选项 */
export interface RoleOption {
  id: string
  code: string
  name: string
}
