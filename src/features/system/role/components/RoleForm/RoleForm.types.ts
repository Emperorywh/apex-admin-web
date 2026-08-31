/**
 * RoleForm 私有类型（规格 §3.4）：
 * 表单模式、表单值与提交载荷只被本组件与角色管理页消费，紧邻实现共置；
 * 纯前端模式下创建/编辑写入载荷由本文件收敛（原 role service DTO 已随请求层移除）。
 */
import type { Role } from '@/types/system/role/role.types'

/** 表单模式：创建含 code（创建后不可改）；编辑仅 displayName/description?/sortOrder（契约差异与原后端一致） */
export type RoleFormMode = 'create' | 'edit'

/** 表单值：创建与编辑共用一个值形状，编辑模式下 code 不渲染为表单项且不提交 */
export interface RoleFormValues {
  code: string
  displayName: string
  description: string
  sortOrder: number
}

/** 编辑目标角色的表单回显数据（description 可空，回显统一为空串） */
export function toRoleFormValues(role: Role): RoleFormValues {
  return { code: role.code, displayName: role.displayName, description: role.description ?? '', sortOrder: role.sortOrder }
}

/** 创建角色载荷：code 全局唯一且创建后不可修改，`^[a-z][a-z0-9_]*$`；创建后固定 active */
export interface CreateRoleDraft {
  code: string
  displayName: string
  description?: string
  sortOrder: number
}

/** 编辑角色载荷：不含 code/status；启停用走列表操作 */
export interface UpdateRoleDraft {
  displayName: string
  description?: string
  sortOrder: number
}

/** 提交载荷：按模式区分的写入载荷（页面据此在内存角色集合中插入或更新） */
export type RoleFormSubmitPayload =
  | { mode: 'create'; draft: CreateRoleDraft }
  | { mode: 'edit'; draft: UpdateRoleDraft }
