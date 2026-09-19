/**
 * 角色管理服务（P32 角色管理页；owner 归 P32，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对最新 OpenAPI，method/path/参数形态一致）：
 * - GET  /fms/v1/auth/role/pageRoles            分页查询角色列表（GET + query 平铺；
 *                                               OpenAPI 文档仅写 param 占位对象，
 *                                               与 P31 pageUsers 同款已实证平铺可用）
 * - POST /fms/v1/auth/role/addRole              新增角色（POST + JSON body）
 * - POST /fms/v1/auth/role/updateRole           更新角色（POST + JSON body，按 id 定位）
 * - POST /fms/v1/auth/role/delete               删除角色（POST + query 参数 id，
 *                                               body 为空对象——旧实现同形态，
 *                                               与「POST+JSON body」族不同勿混淆）
 * - GET  /fms/v1/auth/permission/getPermissions 查询权限资源树（GET + query roleId
 *                                               可选；不带=全部资源树，带=该角色
 *                                               已分配权限树）
 * - POST /fms/v1/auth/role/assignPermissions    分配角色权限（POST + JSON body）
 *
 * 协议纪律：
 * - getRoles（角色选项族）owner=P31 已建于 services/access-user，本页无角色选
 *   项场景，不复用不重建（P31 交接记录约定）；
 * - 写操作不自动重试：失败由页面如实反馈（message），后端拒绝不当成功；
 * - 查询不缓存：列表失败由表格内建错误态呈现（重试入口在表格内部，按钮纪
 *   律）；权限树双查失败由弹窗如实反馈，不伪装成功；
 * - 权限变更时效=下次登录生效（旧 SPEC_button_permission B15 结论）：本服务
 *   不提供任何「即时刷新当前会话权限」的调用，页面也不伪造（专项验收）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  AssignRolePermissionsParam,
  AuthPermissionNode,
  AuthPermissionQueryParam,
  AuthRoleAddParam,
  AuthRoleIdParam,
  AuthRolePageParam,
  AuthRolePageResult,
  AuthRoleUpdateParam,
} from '@/services/access-role/access-role.service.types'

/** 角色控制类统一前缀（request 层 baseURL 已含 /fms/v1） */
const ROLE_BASE = '/auth/role'
/** 权限资源控制类统一前缀 */
const PERMISSION_BASE = '/auth/permission'

/** 分页查询角色列表：GET + query 平铺（pageNo 从 1 计数） */
export async function pageRoles(
  params: AuthRolePageParam,
  options?: RequestOptions,
): Promise<AuthRolePageResult> {
  return api.get<AuthRolePageResult>(`${ROLE_BASE}/pageRoles`, {
    signal: options?.signal,
    params,
  })
}

/** 新增角色：POST + JSON body */
export async function addRole(
  body: AuthRoleAddParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${ROLE_BASE}/addRole`, body, { signal: options?.signal })
}

/** 更新角色：POST + JSON body（按 id 定位，整组提交） */
export async function updateRole(
  body: AuthRoleUpdateParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${ROLE_BASE}/updateRole`, body, { signal: options?.signal })
}

/** 删除角色：POST + query 参数 id（body 空对象；旧实现 post(url?id=) 同形态） */
export async function deleteRole(
  params: AuthRoleIdParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${ROLE_BASE}/delete`, {}, {
    signal: options?.signal,
    params,
  })
}

/** 查询权限资源树：GET + query（不带 roleId=全部资源树；带 roleId=该角色已分配权限树） */
export async function getPermissions(
  params?: AuthPermissionQueryParam,
  options?: RequestOptions,
): Promise<AuthPermissionNode[]> {
  return api.get<AuthPermissionNode[]>(`${PERMISSION_BASE}/getPermissions`, {
    signal: options?.signal,
    ...(params ? { params } : {}),
  })
}

/** 分配角色权限：POST + JSON body（permissionIds 整组提交=整体替换语义） */
export async function assignPermissions(
  body: AssignRolePermissionsParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${ROLE_BASE}/assignPermissions`, body, {
    signal: options?.signal,
  })
}
