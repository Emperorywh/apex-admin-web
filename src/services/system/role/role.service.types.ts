/**
 * 角色管理接口请求/响应 DTO 权威定义（规格 §14.3）。
 * 角色 CRUD、分配权限与权限树接口的 DTO 只在本文件定义一次，
 * 调用端（含 demo adapter）一律 import type 引用，不得复制接口；
 * 响应实体 Role / PermissionNode 是跨层业务实体，权威定义位于
 * src/types/system/role/role.types.ts，此处仅以别名声明 DTO 名称。
 */
import type { SortOrder } from '@/constants/request.constants'
import type { RoleSortField } from '@/constants/system/role/role.constants'
import type { PermissionNode, Role } from '@/types/system/role/role.types'
// PageResult 是跨业务域共享的分页实体，权威定义位于 user 域（TASK-003 所有权划分），
// 此处按单一权威定义规则 import type 引用，不复制接口（规格 §3.4）
import type { PageResult } from '@/types/system/user/user.types'

/**
 * GET /roles 分页查询参数（规格 §14.3）。
 * sortBy 白名单见 ROLE_SORT_FIELDS；keyword 对 code/name 做不区分大小写包含匹配。
 */
export interface RoleListQueryParams {
  page?: number
  size?: number
  keyword?: string
  sortBy?: RoleSortField
  sortOrder?: SortOrder
}

/** POST /roles 请求体（创建契约，规格 §14.3）：code 全局唯一且创建后不可修改 */
export interface CreateRoleRequestDto {
  code: string
  name: string
  description?: string
  status: Role['status']
}

/** PUT /roles/:id 请求体（编辑契约，规格 §14.3）：不含 code，code 创建后不可修改 */
export interface UpdateRoleRequestDto {
  name: string
  description?: string
  status: Role['status']
}

/** PUT /roles/:id/permissions 请求体（分配权限契约，规格 §14.3）：后端验证所有权限码存在 */
export interface AssignRolePermissionsRequestDto {
  permCodes: string[]
}

/** GET /roles 响应 data：分页角色列表 */
export type RoleListResponseDto = PageResult<Role>

/** POST /roles、PUT /roles/:id、PUT /roles/:id/permissions 响应 data：变更后的角色实体 */
export type RoleMutationResponseDto = Role

/** GET /permissions/tree 响应 data：权限树（checked 状态由 Role.permCodes 推导，规格 §14.1） */
export type PermissionTreeResponseDto = PermissionNode[]
