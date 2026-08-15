/**
 * RoleForm 私有类型（规格 §3.4/§14.3）：
 * 表单模式、表单值与提交载荷只被本组件与角色管理页消费，紧邻实现共置；
 * 写入契约 DTO 的权威定义位于 role.service.types.ts，此处仅引用。
 */
import type { CreateRoleRequestDto, UpdateRoleRequestDto } from '@/services/system/role/role.service.types'
import type { Role } from '@/types/system/role/role.types'

/** 表单模式：创建含 code（创建后不可改）；编辑仅 name/description?/status（规格 §14.3 契约差异） */
export type RoleFormMode = 'create' | 'edit'

/** 表单值：创建与编辑共用一个值形状，编辑模式下 code 不渲染为表单项且不提交 */
export interface RoleFormValues {
  code: string
  name: string
  description?: string
  status: Role['status']
}

/** 提交载荷：按模式区分的写入契约 DTO（页面据此调用对应 service 函数） */
export type RoleFormSubmitPayload =
  | { mode: 'create'; dto: CreateRoleRequestDto }
  | { mode: 'edit'; dto: UpdateRoleRequestDto }
