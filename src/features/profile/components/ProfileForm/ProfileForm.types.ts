/**
 * ProfileForm 私有类型（规格 §3.4/§14.3）：
 * 表单值只被本组件与个人中心页消费，紧邻实现共置；
 * 写入契约 DTO 的权威定义位于 auth.service.types.ts，此处仅引用。
 */
import type { UpdateProfileRequestDto } from '@/services/auth/auth.service.types'

/** 表单值：编辑资料契约 { displayName, email, phone? } 的表单形态（phone 空串表示未填） */
export interface ProfileFormValues {
  displayName: string
  email: string
  phone?: string
}

/** 提交载荷：即编辑资料写入契约 DTO（username 不可修改，不进入表单值） */
export type ProfileFormSubmitPayload = UpdateProfileRequestDto
