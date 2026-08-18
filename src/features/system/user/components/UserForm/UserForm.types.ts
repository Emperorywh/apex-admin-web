/**
 * UserForm 私有类型（规格 §3.4，对齐真实后端写入契约）：
 * 表单模式、表单值与提交载荷只被本组件与用户管理页消费，紧邻实现共置；
 * 写入契约 DTO 的权威定义位于 user.service.types.ts，此处仅引用。
 */
import type { CreateUserRequestDto, UpdateUserRequestDto } from '@/services/system/user/user.service.types'
import type { User } from '@/types/system/user/user.types'

/** 表单模式：创建含 username/password；编辑仅资料字段（后端契约差异） */
export type UserFormMode = 'create' | 'edit'

/** 表单值：创建与编辑共用一个值形状，编辑模式下 username/password 不渲染且不提交 */
export interface UserFormValues {
  username: string
  password: string
  displayName: string
  email: string
  phone?: string
}

/** 编辑目标用户的表单回显数据（email/phone 后端可空，回显统一为空串） */
export function toUserFormValues(user: User): UserFormValues {
  return {
    username: user.username,
    password: '',
    displayName: user.displayName,
    email: user.email ?? '',
    phone: user.phone ?? '',
  }
}

/** 提交载荷：按模式区分的写入契约 DTO（页面据此调用对应 service 函数） */
export type UserFormSubmitPayload =
  | { mode: 'create'; dto: CreateUserRequestDto }
  | { mode: 'edit'; dto: UpdateUserRequestDto }
