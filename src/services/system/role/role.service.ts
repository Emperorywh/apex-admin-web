/**
 * 角色列表接口（规格 §14.3）：GET /roles → PageResult<Role>。
 * 用户管理页的分配角色 Drawer 经本函数获取可选角色集合；
 * 角色 CRUD、分配权限与权限树接口随角色管理任务（TASK-015）扩展本文件。
 * endpoint 引用 role 域常量 ROLE_ENDPOINTS；send 参数注入形态与 user service 一致。
 */
import { ROLE_ENDPOINTS } from '@/constants/system/role/role.constants'
import { request } from '@/services/request/request'
import type { SendRequest } from '@/services/request/request.types'
import type { RoleListQueryParams, RoleListResponseDto } from './role.service.types'

/** 分页查询角色：GET /roles（规格 §14.3） */
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
