/**
 * 用户管理五接口（规格 §14.3）：list/create/update/delete/assign-roles。
 * 每个函数显式声明入参与 Promise<T> 返回类型，经封装的 request<T>() 完成类型解包；
 * 接口路径在请求调用点直接内联（规格 §14.3 v1.8）。
 * send 参数默认真实 request 传输；列表查询由页面 Hook 注入 usePageRequest() 的
 * 页签作用域请求函数（规格 §7.4-6），写操作默认走全局传输。
 */
import { request } from '@/services/request/request'
import type { SendRequest } from '@/services/request/request.types'
import type {
  AssignUserRolesRequestDto,
  CreateUserRequestDto,
  UpdateUserRequestDto,
  UserListQueryParams,
  UserListResponseDto,
  UserMutationResponseDto,
} from './user.service.types'

/**
 * 写操作可调选项（规格 §7.4-3）：
 * 表单/抽屉自行呈现错误（字段映射或页面级）的调用方传 silent: true 关闭全局提示，
 * 避免同一错误既弹全局提示又在表单内重复出现；默认走全局统一提示。
 */
export interface UserWriteOptions {
  silent?: boolean
}

/** 以真实用户 ID 替换 endpoint 模板中的 :id 占位符 */
function fillUserId(endpoint: string, userId: string): string {
  return endpoint.replace(':id', encodeURIComponent(userId))
}

/** 分页查询用户：GET /users（规格 §14.3：keyword/sortBy/sortOrder/分页语义由后端实施） */
export function listUsers(params: UserListQueryParams, send: SendRequest = request): Promise<UserListResponseDto> {
  return send<UserListResponseDto>({
    url: '/users',
    method: 'get',
    params,
  })
}

/** 创建用户：POST /users（写入契约见 CreateUserRequestDto；用户名全局唯一） */
export function createUser(
  dto: CreateUserRequestDto,
  options: UserWriteOptions = {},
): Promise<UserMutationResponseDto> {
  return request<UserMutationResponseDto>({
    url: '/users',
    method: 'post',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 编辑用户：PUT /users/:id（编辑契约不含 username/password/roleIds） */
export function updateUser(
  userId: string,
  dto: UpdateUserRequestDto,
  options: UserWriteOptions = {},
): Promise<UserMutationResponseDto> {
  return request<UserMutationResponseDto>({
    url: fillUserId('/users/:id', userId),
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 删除用户：DELETE /users/:id；响应 data 固定为 null */
export function deleteUser(userId: string): Promise<null> {
  return request<null>({
    url: fillUserId('/users/:id', userId),
    method: 'delete',
  })
}

/** 分配用户角色：PUT /users/:id/roles（body { roleIds }） */
export function assignUserRoles(
  userId: string,
  dto: AssignUserRolesRequestDto,
  options: UserWriteOptions = {},
): Promise<UserMutationResponseDto> {
  return request<UserMutationResponseDto>({
    url: fillUserId('/users/:id/roles', userId),
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}
