/**
 * 认证业务域实体（规格 §14.1）。
 * 被 pages/features/services/store 跨层共享的权威定义；
 * 登录/刷新等请求/响应 DTO 随 service 任务放入 auth.service.types.ts。
 */
import type { User } from '@/types/system/user/user.types'

/**
 * profile 使用角色 code 判定 admin，避免把完整角色管理字段耦合到认证接口。
 * permissionVersion 每次权限集合变化时都必须变化，只用于判断权限快照是否变化。
 */
export interface ProfileData {
  user: User
  roleCodes: string[]
  permCodes: string[]
  permissionVersion: string
}
