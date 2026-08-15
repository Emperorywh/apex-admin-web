/**
 * 用户管理接口请求/响应 DTO 权威定义（规格 §14.3）。
 * 用户 CRUD 与角色分配五个接口的 DTO 只在本文件定义一次，
 * 调用端（含 demo adapter）一律 import type 引用，不得复制接口；
 * 响应实体 User / PageResult<User> 是跨层业务实体，权威定义位于
 * src/types/system/user/user.types.ts，此处仅以别名声明 DTO 名称。
 */
import type { SortOrder } from '@/constants/request.constants'
import type { UserSortField } from '@/constants/system/user/user.constants'
import type { PageResult, User } from '@/types/system/user/user.types'

/**
 * GET /users 分页查询参数（规格 §14.3）。
 * page 从 1 开始，size 默认 10、最大 100；未传 sortBy 时后端统一按 createdAt desc。
 */
export interface UserListQueryParams {
  page?: number
  size?: number
  /** 去除首尾空白后对 username/displayName 做不区分大小写包含匹配 */
  keyword?: string
  /** 白名单见 USER_SORT_FIELDS；白名单外由后端返回 VALIDATION_FAILED */
  sortBy?: UserSortField
  sortOrder?: SortOrder
}

/** POST /users 请求体（创建契约，规格 §14.3）：username 创建后不可修改；密码与角色走创建契约 */
export interface CreateUserRequestDto {
  username: string
  password: string
  displayName: string
  email: string
  phone?: string
  status: User['status']
  roleIds: string[]
}

/** PUT /users/:id 请求体（编辑契约，规格 §14.3）：不含 username/password/roleIds，密码与角色分别走独立接口 */
export interface UpdateUserRequestDto {
  displayName: string
  email: string
  phone?: string
  status: User['status']
}

/** PUT /users/:id/roles 请求体（分配角色契约，规格 §14.3） */
export interface AssignUserRolesRequestDto {
  roleIds: string[]
}

/** GET /users 响应 data：分页用户列表 */
export type UserListResponseDto = PageResult<User>

/** POST /users、PUT /users/:id、PUT /users/:id/roles 响应 data：变更后的用户实体 */
export type UserMutationResponseDto = User
