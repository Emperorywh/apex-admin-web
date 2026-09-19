/**
 * 用户管理服务（P31 用户管理页；owner 归 P31，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对最新 OpenAPI，method/path/参数形态一致）：
 * - GET  /fms/v1/auth/user/pageUsers      分页查询用户列表（GET + query 平铺，
 *                                         旧实现 get(url, data) 同形态；OpenAPI
 *                                         文档仅写 pageParam 占位参数，与 P12
 *                                         pageMapPushRecords 同款已实证平铺可用）
 * - POST /fms/v1/auth/user/addUser        新增用户（POST + JSON body）
 * - POST /fms/v1/auth/user/updateState    修改用户状态（POST + JSON body）
 * - POST /fms/v1/auth/user/resetPassword  重置密码（POST + JSON body）
 * - POST /fms/v1/auth/user/deleteUser     删除用户（POST + JSON body）
 * - POST /fms/v1/auth/user/assignRoles    分配用户角色（POST + JSON body）
 * - GET  /fms/v1/auth/role/getRoles       查询角色列表（GET + query userId 可选；
 *                                         owner=P31 建立，P32 角色管理页复用）
 *
 * 协议纪律：
 * - 密码仅以 MD5 摘要进入协议（页面提交前加密，本层不二次处理明文）；本层
 *   不持久化任何密码字段（专项验收：密码不持久化）；
 * - 写操作不自动重试：失败由页面如实反馈（message + 乐观状态回滚），后端
 *   拒绝不当成功（root 保护等以后端业务码为准）；
 * - 查询不缓存：列表失败由表格内建错误态呈现（重试入口在表格内部，按钮
 *   纪律），会话失效由请求层统一收敛（1000000 → 登录页）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  AssignUserRolesParam,
  AuthRoleDto,
  AuthRoleQueryParam,
  AuthUserAddParam,
  AuthUserIdParam,
  AuthUserPageParam,
  AuthUserPageResult,
  AuthUserUpdateStateParam,
} from '@/services/access-user/access-user.service.types'

/** 用户控制类统一前缀（request 层 baseURL 已含 /fms/v1） */
const USER_BASE = '/auth/user'
/** 角色控制类统一前缀（本页仅消费 getRoles） */
const ROLE_BASE = '/auth/role'

/** 分页查询用户列表：GET + query 平铺（pageNo 从 1 计数） */
export async function pageAuthUsers(
  params: AuthUserPageParam,
  options?: RequestOptions,
): Promise<AuthUserPageResult> {
  return api.get<AuthUserPageResult>(`${USER_BASE}/pageUsers`, {
    signal: options?.signal,
    params,
  })
}

/** 新增用户：POST + JSON body（密码已由页面 MD5 摘要） */
export async function addAuthUser(
  body: AuthUserAddParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${USER_BASE}/addUser`, body, { signal: options?.signal })
}

/** 修改用户状态：POST + JSON body（按 username 定位，旧实现同形态） */
export async function updateAuthUserState(
  body: AuthUserUpdateStateParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${USER_BASE}/updateState`, body, { signal: options?.signal })
}

/** 重置密码：POST + JSON body（后端重置为默认密码，页面提示默认新密码） */
export async function resetAuthUserPassword(
  body: AuthUserIdParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${USER_BASE}/resetPassword`, body, { signal: options?.signal })
}

/** 删除用户：POST + JSON body（按 id 定位） */
export async function deleteAuthUser(
  body: AuthUserIdParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${USER_BASE}/deleteUser`, body, { signal: options?.signal })
}

/** 分配用户角色：POST + JSON body（roleIds 整组提交=整体替换语义） */
export async function assignAuthUserRoles(
  body: AssignUserRolesParam,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${USER_BASE}/assignRoles`, body, { signal: options?.signal })
}

/** 查询角色列表：GET + query（不传 userId=全部角色；传 userId=该用户已分配角色） */
export async function getAuthRoles(
  params?: AuthRoleQueryParam,
  options?: RequestOptions,
): Promise<AuthRoleDto[]> {
  return api.get<AuthRoleDto[]>(`${ROLE_BASE}/getRoles`, {
    signal: options?.signal,
    ...(params ? { params } : {}),
  })
}
