/**
 * 角色管理六接口（规格 §14.3）：list/create/update/delete/assign-permissions
 * 与 GET /permissions/tree 权限树。
 * 每个函数显式声明入参与 Promise<T> 返回类型，经封装的 request<T>() 完成类型解包；
 * endpoint 一律引用 role 域常量 ROLE_ENDPOINTS / PERMISSION_TREE_ENDPOINT，不在调用点内联字符串。
 * send 参数默认真实 request 传输；列表查询与权限树由页面 Hook 注入 usePageRequest() 的
 * 页签作用域请求函数（规格 §7.4-6），写操作默认走全局传输。
 */
import { PERMISSION_TREE_ENDPOINT, ROLE_ENDPOINTS } from '@/constants/system/role/role.constants'
import { request } from '@/services/request/request'
import type { SendRequest } from '@/services/request/request.types'
import type {
  AssignRolePermissionsRequestDto,
  CreateRoleRequestDto,
  PermissionTreeResponseDto,
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

/** 以真实角色 ID 替换 endpoint 模板中的 :id 占位符 */
function fillRoleId(endpoint: string, roleId: string): string {
  return endpoint.replace(':id', encodeURIComponent(roleId))
}

/** 分页查询角色：GET /roles（规格 §14.3：keyword/sortBy/sortOrder/分页语义由后端实施） */
export function listRoles(
  params: RoleListQueryParams,
  send: SendRequest = request,
): Promise<RoleListResponseDto> {
  return send<RoleListResponseDto>({
    url: ROLE_ENDPOINTS.LIST,
    method: 'get',
    params,
  })
}

/** 创建角色：POST /roles（写入契约见 CreateRoleRequestDto；code 全局唯一） */
export function createRole(
  dto: CreateRoleRequestDto,
  options: RoleWriteOptions = {},
): Promise<RoleMutationResponseDto> {
  return request<RoleMutationResponseDto>({
    url: ROLE_ENDPOINTS.CREATE,
    method: 'post',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 编辑角色：PUT /roles/:id（编辑契约不含 code，code 创建后不可修改） */
export function updateRole(
  roleId: string,
  dto: UpdateRoleRequestDto,
  options: RoleWriteOptions = {},
): Promise<RoleMutationResponseDto> {
  return request<RoleMutationResponseDto>({
    url: fillRoleId(ROLE_ENDPOINTS.UPDATE, roleId),
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 删除角色：DELETE /roles/:id；builtIn 或被用户引用时返回 RESOURCE_CONFLICT，响应 data 固定为 null */
export function deleteRole(roleId: string): Promise<null> {
  return request<null>({
    url: fillRoleId(ROLE_ENDPOINTS.DELETE, roleId),
    method: 'delete',
  })
}

/** 分配权限：PUT /roles/:id/permissions（body { permCodes }，后端验证所有权限码存在） */
export function assignRolePermissions(
  roleId: string,
  dto: AssignRolePermissionsRequestDto,
  options: RoleWriteOptions = {},
): Promise<RoleMutationResponseDto> {
  return request<RoleMutationResponseDto>({
    url: fillRoleId(ROLE_ENDPOINTS.ASSIGN_PERMISSIONS, roleId),
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 权限树：GET /permissions/tree（规格 §14.1：仅叶子提供 permCode，checked 由 Role.permCodes 推导） */
export function getPermissionTree(send: SendRequest = request): Promise<PermissionTreeResponseDto> {
  return send<PermissionTreeResponseDto>({
    url: PERMISSION_TREE_ENDPOINT,
    method: 'get',
  })
}
