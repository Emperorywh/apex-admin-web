/**
 * 角色管理业务域实体（对齐真实后端 rbac RoleResponse / RoleDetailResponse）。
 * 被 pages/features/services 跨层共享的权威定义；
 * 请求/响应 DTO 随 service 任务放入 role.service.types.ts，不得复制本文件接口。
 */

/** 角色状态稳定编码（后端 RoleStatus StrEnum：active / disabled） */
export type RoleStatus = 'active' | 'disabled'

/**
 * 角色实体（列表项，后端 RoleResponse）：
 * code 是后端稳定角色标识；isBuiltin 角色禁止删除、启用/禁用与修改 code；
 * 权限码集合不在列表响应中，详情见 RoleDetail。
 */
export interface Role {
  id: string
  code: string
  displayName: string
  description: string | null
  status: RoleStatus
  isBuiltin: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/**
 * 角色详情（后端 RoleDetailResponse）：在列表实体之上补权限码全集与成员数。
 * 分配权限（PUT /roles/:id/permissions）的响应同此形状。
 */
export interface RoleDetail extends Role {
  permissionCodes: string[]
  memberCount: number
}
