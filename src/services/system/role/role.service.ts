/**
 * 角色管理接口（对齐真实后端 rbac 模块）：list/detail/create/update/enable/disable/delete
 * 与分配权限。
 * 每个函数显式声明入参与 Promise<T> 返回类型，经封装的 request<T>() 完成类型解包；
 * 接口路径在请求调用点直接内联（规格 §14.3 v1.8）。
 * send 参数默认真实 request 传输；列表与详情由页面 Hook 注入 usePageRequest() 的
 * 页签作用域请求函数（规格 §7.4-6），写操作默认走全局传输。
 */
import { request } from '@/services/request/request'
import type { SendRequest } from '@/services/request/request.types'
import type {
  AssignRolePermissionsRequestDto,
  AssignRolePermissionsResponseDto,
  CreateRoleRequestDto,
  RoleDetailResponseDto,
  RoleListQueryParams,
  RoleListResponseDto,
  RoleMutationResponseDto,
  UpdateRoleRequestDto,
} from './role.service.types'

/**
 * 写操作可调选项（规格 §7.4-3）：
 * 表单/抽屉自行呈现错误（字段映射或页面级）的调用方传 silent: true 关闭全局提示，
 * 避免同一错误既弹全局提示又在表单内重复出现；默认走全局统一提示。
 */
export interface RoleWriteOptions {
  silent?: boolean
}

/** 以真实角色 ID 替换 endpoint 模板中的 :roleId 占位符 */
function fillRoleId(endpoint: string, roleId: string): string {
  return endpoint.replace(':roleId', encodeURIComponent(roleId))
}

/** 分页查询角色：GET /roles（status 筛选 + sort 白名单排序，语义由后端实施） */
export function listRoles(
  params: RoleListQueryParams,
  send: SendRequest = request,
): Promise<RoleListResponseDto> {
  return send<RoleListResponseDto>({
    url: '/roles',
    method: 'get',
    params,
  })
}

/** 角色详情：GET /roles/:roleId（含 permissionCodes 与 memberCount；不存在返回 404 RBAC.ROLE_NOT_FOUND） */
export function getRoleDetail(roleId: string, send: SendRequest = request): Promise<RoleDetailResponseDto> {
  return send<RoleDetailResponseDto>({
    url: fillRoleId('/roles/:roleId', roleId),
    method: 'get',
  })
}

/** 创建角色：POST /roles（201 + Location；code 冲突返回 409 RBAC.ROLE_ALREADY_EXISTS） */
export function createRole(
  dto: CreateRoleRequestDto,
  options: RoleWriteOptions = {},
): Promise<RoleMutationResponseDto> {
  return request<RoleMutationResponseDto>({
    url: '/roles',
    method: 'post',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 编辑角色：PUT /roles/:roleId（编辑契约不含 code；code 创建后不可修改） */
export function updateRole(
  roleId: string,
  dto: UpdateRoleRequestDto,
  options: RoleWriteOptions = {},
): Promise<RoleMutationResponseDto> {
  return request<RoleMutationResponseDto>({
    url: fillRoleId('/roles/:roleId', roleId),
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 启用角色：POST /roles/:roleId/enable（内置角色返回 409 RBAC.BUILTIN_ROLE_PROTECTED） */
export function enableRole(roleId: string): Promise<RoleMutationResponseDto> {
  return request<RoleMutationResponseDto>({
    url: fillRoleId('/roles/:roleId/enable', roleId),
    method: 'post',
  })
}

/** 禁用角色：POST /roles/:roleId/disable（禁用后权限不计入用户有效权限集；内置角色受保护） */
export function disableRole(roleId: string): Promise<RoleMutationResponseDto> {
  return request<RoleMutationResponseDto>({
    url: fillRoleId('/roles/:roleId/disable', roleId),
    method: 'post',
  })
}

/** 删除角色：DELETE /roles/:roleId；内置或被用户引用返回 409，响应 204 空体解包为 null */
export function deleteRole(roleId: string): Promise<null> {
  return request<null>({
    url: fillRoleId('/roles/:roleId', roleId),
    method: 'delete',
  })
}

/** 分配权限：PUT /roles/:roleId/permissions（body { permissionCodes } 全量替换，后端验证所有权限码存在） */
export function assignRolePermissions(
  roleId: string,
  dto: AssignRolePermissionsRequestDto,
  options: RoleWriteOptions = {},
): Promise<AssignRolePermissionsResponseDto> {
  return request<AssignRolePermissionsResponseDto>({
    url: fillRoleId('/roles/:roleId/permissions', roleId),
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}
