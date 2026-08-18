/**
 * 认证接口请求/响应 DTO 权威定义（规格 §6.3）。
 * login/refresh/logout/profile/password 六个接口的 DTO 只在本文件定义一次，
 * 调用端一律 import type 引用，不得复制接口；
 * GET /auth/profile 的返回实体 ProfileData 是跨层业务实体，权威定义位于
 * src/types/auth/auth.types.ts，此处仅引用。
 */
import type { ProfileData } from '@/types/auth/auth.types'
import type { User } from '@/types/system/user/user.types'

/** POST /auth/login 请求体 */
export interface LoginRequestDto {
  username: string
  password: string
}

/** POST /auth/login 响应 data：双 token 与登录用户 */
export interface LoginResponseDto {
  accessToken: string
  refreshToken: string
  user: User
}

/** POST /auth/refresh 请求体 */
export interface RefreshTokensRequestDto {
  refreshToken: string
}

/** POST /auth/refresh 响应 data：旋转后的双 token */
export interface RefreshTokensResponseDto {
  accessToken: string
  refreshToken: string
}

/** POST /auth/logout 请求体；响应 data 固定为 null */
export interface LogoutRequestDto {
  refreshToken: string
}

/** PUT /auth/profile 请求体（规格 §14.3 编辑资料契约）；响应 data 为 User */
export interface UpdateProfileRequestDto {
  displayName: string
  email: string
  phone?: string
}

/** PUT /auth/password 请求体；响应 data 固定为 null */
export interface ChangePasswordRequestDto {
  oldPassword: string
  newPassword: string
}

/** GET /auth/profile 响应 data：直接复用业务实体权威定义 */
export type GetProfileResponseDto = ProfileData
