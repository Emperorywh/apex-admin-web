/**
 * 角色管理接口请求/响应 DTO 权威定义（对齐真实后端 rbac 模块，apex-admin SPEC 9.3/9.4/13.2）。
 * DTO 只在本文件定义一次，调用端一律 import type 引用，不得复制接口；
 * 响应实体 Role / RoleDetail 是跨层业务实体，权威定义位于
 * src/types/system/role/role.types.ts，此处仅以别名声明 DTO 名称。
 */
import type { Role, RoleDetail, RoleStatus } from '@/types/system/role/role.types'
// PageResult 是跨业务域共享的分页实体，权威定义位于 user 域（TASK-003 所有权划分），
// 此处按单一权威定义规则 import type 引用，不复制接口（规格 §3.4）
import type { PageResult } from '@/types/system/user/user.types'

/**
 * GET /roles 分页查询参数（后端 SPEC 9.4）。
 * sort 为逗号分隔 camelCase 字段，`-` 前缀降序，白名单由 ROLE_SORT_FIELDS 约束；
 * status 筛选值为后端稳定编码 active / disabled。
 */
export interface RoleListQueryParams {
  page?: number
  pageSize?: number
  status?: RoleStatus
  sort?: string
}

/** POST /roles 请求体（RoleCreateRequest，后端 extra="forbid"）：code 全局唯一且创建后不可修改，`^[a-z][a-z0-9_]*$` */
export interface CreateRoleRequestDto {
  code: string
  displayName: string
  description?: string
  sortOrder: number
}

/** PUT /roles/:roleId 请求体（RoleUpdateRequest，后端 extra="forbid"）：不含 code/status/sortOrder 之外的可变字段；启停用走独立端点 */
export interface UpdateRoleRequestDto {
  displayName: string
  description?: string
  sortOrder: number
}

/** PUT /roles/:roleId/permissions 请求体（AssignPermissionsRequest）：权限编码全量替换，空列表表示清除全部 */
export interface AssignRolePermissionsRequestDto {
  permissionCodes: string[]
}

/** GET /roles 响应：分页角色列表 */
export type RoleListResponseDto = PageResult<Role>

/** GET /roles/:roleId 响应：角色详情（含权限码全集与成员数） */
export type RoleDetailResponseDto = RoleDetail

/** POST /roles、PUT /roles/:roleId、POST /roles/:roleId/enable|disable 响应：变更后的角色实体 */
export type RoleMutationResponseDto = Role

/** PUT /roles/:roleId/permissions 响应：分配后的角色详情 */
export type AssignRolePermissionsResponseDto = RoleDetail
