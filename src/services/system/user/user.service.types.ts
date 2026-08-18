/**
 * 用户管理接口请求/响应 DTO 权威定义（对齐真实后端 identity 模块，apex-admin SPEC 9.3/9.4/11.1）。
 * DTO 只在本文件定义一次，调用端一律 import type 引用，不得复制接口；
 * 响应实体 User / PageResult<User> 是跨层业务实体，权威定义位于
 * src/types/system/user/user.types.ts，此处仅以别名声明 DTO 名称。
 */
import type { PageResult, User, UserStatus } from '@/types/system/user/user.types'

/**
 * GET /users 分页查询参数（后端 SPEC 9.4）。
 * page 从 1 开始，pageSize 默认 20、范围 1-100；sort 为逗号分隔 camelCase 字段，
 * `-` 前缀表示降序（如 `-createdAt`），白名单由 USER_SORT_FIELDS 约束；
 * status 筛选值为后端稳定编码 active / disabled。
 */
export interface UserListQueryParams {
  page?: number
  pageSize?: number
  status?: UserStatus
  sort?: string
}

/** POST /users 请求体（UserCreateRequest，后端 extra="forbid"）：创建后默认 active；不含 status/roleIds */
export interface CreateUserRequestDto {
  username: string
  displayName: string
  /** 明文密码，12-128 个 Unicode 字符（后端 SPEC 23.2 密码策略） */
  password: string
  phone?: string
  email?: string
}

/** PUT /users/:userId 请求体（UserUpdateRequest，后端 extra="forbid"）：不含 username/password/status；启停用走独立端点 */
export interface UpdateUserRequestDto {
  displayName: string
  phone?: string
  email?: string
}

/**
 * PUT /users/:userId/roles 请求体（AssignUserRolesRequest）：
 * 全量替换，元素是角色编码（role code）而非角色 ID。
 */
export interface AssignUserRolesRequestDto {
  roleCodes: string[]
}

/**
 * GET /users/:userId/roles 与 PUT /users/:userId/roles 响应：
 * 该端点无 response_model，后端 dict 原样序列化，键保持 snake_case（user_id / role_ids）。
 */
export interface UserRolesResponseDto {
  user_id: string
  role_ids: string[]
}

/** GET /users 响应：分页用户列表 */
export type UserListResponseDto = PageResult<User>

/** POST /users、PUT /users/:userId、POST /users/:userId/enable|disable 响应：变更后的用户实体 */
export type UserMutationResponseDto = User
