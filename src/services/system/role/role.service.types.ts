/**
 * 角色管理接口请求/响应 DTO 权威定义（规格 §14.3）。
 * 当前任务只落盘列表查询契约（供用户管理分配角色使用）；角色 CRUD、
 * 分配权限与权限树的 DTO 随角色管理任务（TASK-015）在同一文件补齐。
 * 响应实体 Role / PageResult<Role> 是跨层业务实体，权威定义位于
 * src/types/system/role/role.types.ts，此处仅以别名声明 DTO 名称。
 */
import type { SortOrder } from '@/constants/request.constants'
import type { RoleSortField } from '@/constants/system/role/role.constants'
import type { Role } from '@/types/system/role/role.types'
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

/** GET /roles 响应 data：分页角色列表 */
export type RoleListResponseDto = PageResult<Role>
