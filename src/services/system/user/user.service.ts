/**
 * 用户管理接口（对齐真实后端 identity 模块）：
 * list/create/update/enable/disable/delete 与用户角色查询/分配。
 * 每个函数显式声明入参与 Promise<T> 返回类型，经封装的 request<T>() 完成类型解包；
 * 接口路径在请求调用点直接内联（规格 §14.3 v1.8）。
 * send 参数默认真实 request 传输；列表与角色查询由页面 Hook 注入 usePageRequest() 的
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
  UserRolesResponseDto,
} from './user.service.types'

/**
 * 写操作可调选项（规格 §7.4-3）：
 * 表单/抽屉自行呈现错误（字段映射或页面级）的调用方传 silent: true 关闭全局提示，
 * 避免同一错误既弹全局提示又在表单内重复出现；默认走全局统一提示。
 */
export interface UserWriteOptions {
  silent?: boolean
}

/** 以真实用户 ID 替换 endpoint 模板中的 :userId 占位符 */
function fillUserId(endpoint: string, userId: string): string {
  return endpoint.replace(':userId', encodeURIComponent(userId))
}

/** 分页查询用户：GET /users（status 筛选 + sort 白名单排序，语义由后端实施） */
export function listUsers(params: UserListQueryParams, send: SendRequest = request): Promise<UserListResponseDto> {
  return send<UserListResponseDto>({
    url: '/users',
    method: 'get',
    params,
  })
}

/** 创建用户：POST /users（201 + Location；写入契约见 CreateUserRequestDto；用户名全局唯一） */
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

/** 编辑用户资料：PUT /users/:userId（编辑契约不含 username/password/status） */
export function updateUser(
  userId: string,
  dto: UpdateUserRequestDto,
  options: UserWriteOptions = {},
): Promise<UserMutationResponseDto> {
  return request<UserMutationResponseDto>({
    url: fillUserId('/users/:userId', userId),
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 启用用户：POST /users/:userId/enable（已启用返回 409 USER.ALREADY_ACTIVE） */
export function enableUser(userId: string): Promise<UserMutationResponseDto> {
  return request<UserMutationResponseDto>({
    url: fillUserId('/users/:userId/enable', userId),
    method: 'post',
  })
}

/** 禁用用户：POST /users/:userId/disable（后端吊销该用户全部会话；已禁用返回 409 USER.ALREADY_DISABLED） */
export function disableUser(userId: string): Promise<UserMutationResponseDto> {
  return request<UserMutationResponseDto>({
    url: fillUserId('/users/:userId/disable', userId),
    method: 'post',
  })
}

/** 删除用户：DELETE /users/:userId；响应 204 空体解包为 null */
export function deleteUser(userId: string): Promise<null> {
  return request<null>({
    url: fillUserId('/users/:userId', userId),
    method: 'delete',
  })
}

/** 查询用户角色：GET /users/:userId/roles（响应键为 snake_case，见 UserRolesResponseDto） */
export function getUserRoles(userId: string, send: SendRequest = request): Promise<UserRolesResponseDto> {
  return send<UserRolesResponseDto>({
    url: fillUserId('/users/:userId/roles', userId),
    method: 'get',
  })
}

/** 分配用户角色：PUT /users/:userId/roles（body { roleCodes }，角色编码全量替换） */
export function assignUserRoles(
  userId: string,
  dto: AssignUserRolesRequestDto,
  options: UserWriteOptions = {},
): Promise<UserRolesResponseDto> {
  return request<UserRolesResponseDto>({
    url: fillUserId('/users/:userId/roles', userId),
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}
