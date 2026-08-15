/**
 * PasswordForm 私有类型（规格 §3.4/§14.3）：
 * 表单值只被本组件与个人中心页消费，紧邻实现共置；
 * 写入契约 DTO 的权威定义位于 auth.service.types.ts，此处仅引用。
 */
import type { ChangePasswordRequestDto } from '@/services/auth/auth.service.types'

/** 表单值：含确认密码的表单形态（confirmPassword 不进入提交契约） */
export interface PasswordFormValues {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

/** 提交载荷：即修改密码写入契约 DTO { oldPassword, newPassword } */
export type PasswordFormSubmitPayload = ChangePasswordRequestDto
