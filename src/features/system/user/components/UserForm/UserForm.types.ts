/**
 * UserForm 私有类型（规格 §3.4）：
 * 表单模式、表单值与提交载荷只被本组件与用户管理页消费，紧邻实现共置；
 * 纯前端模式下创建/编辑写入载荷由本文件收敛（原 user service DTO 已随请求层移除）。
 */
import type { User } from '@/types/system/user/user.types'

/** 表单模式：创建含 username/password；编辑仅资料字段（与原后端契约差异保持一致） */
export type UserFormMode = 'create' | 'edit'

/** 表单值：创建与编辑共用一个值形状，编辑模式下 username/password 不渲染且不提交 */
export interface UserFormValues {
  username: string
  password: string
  displayName: string
  email: string
  phone: string
}

/** 编辑目标用户的表单回显数据（email/phone 可空，回显统一为空串） */
export function toUserFormValues(user: User): UserFormValues {
  return {
    username: user.username,
    password: '',
    displayName: user.displayName,
    email: user.email ?? '',
    phone: user.phone ?? '',
  }
}

/** 创建用户载荷：username 唯一且创建后不可改；创建后固定 active */
export interface CreateUserDraft {
  username: string
  password: string
  displayName: string
  email?: string
  phone?: string
}

/** 编辑用户载荷：不含 username/password/status（username 禁改，状态走列表启停用） */
export interface UpdateUserDraft {
  displayName: string
  email?: string
  phone?: string
}

/** 提交载荷：按模式区分的写入载荷（页面据此在内存用户集合中插入或更新） */
export type UserFormSubmitPayload =
  | { mode: 'create'; draft: CreateUserDraft }
  | { mode: 'edit'; draft: UpdateUserDraft }
