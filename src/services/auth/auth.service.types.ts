/**
 * 认证接口请求/响应 DTO 权威定义（规格 §6.3 v1.14，真实后端 apex-admin 契约）。
 * login/refresh/logout/profile/password 六个接口的 DTO 只在本文件定义一次，
 * 调用端一律 import type 引用，不得复制接口；
 * refreshToken 由 __Host-apex_refresh HttpOnly Cookie 承载，任何 DTO 均不包含该字段；
 * profile 聚合（GET /users/me + GET /me/menus + GET /me/permissions，规格 §6.3 v1.15）
 * 的返回实体 ProfileData 是跨层业务实体，权威定义位于 src/types/auth/auth.types.ts，
 * 此处仅引用。
 */
import type { ProfileData } from '@/types/auth/auth.types'
import type { UserDepartmentInfo, UserPostInfo } from '@/types/system/user/user.types'

/** POST /auth/login 请求体（device 可选：会话设备标识，暂不传，后端以 User-Agent 头记录） */
export interface LoginRequestDto {
  username: string
  password: string
  device?: string
}

/** 登录/刷新成功响应体：accessToken 仅在响应体返回一次；tokenType 固定 Bearer；expiresIn 单位秒 */
export interface TokenPairResponseDto {
  accessToken: string
  tokenType: 'Bearer'
  /** Token 有效期，单位：秒（后端默认 900） */
  expiresIn: number
}

/** POST /auth/login 响应体（refreshToken 经 Set-Cookie 下发，不在此处） */
export type LoginResponseDto = TokenPairResponseDto

/** POST /auth/refresh 响应体（无请求体，Cookie 携带；新 refreshToken 经 Set-Cookie 轮换） */
export type RefreshTokensResponseDto = TokenPairResponseDto

/** POST /auth/logout 响应体（认证请求、无请求体；后端吊销当前会话并删除 Cookie） */
export interface LogoutResponseDto {
  /** 被吊销的会话数量 */
  revokedCount: number
}

/** GET /users/me 响应体：后端 UserResponse 原始形态（auth service 内适配为 User 实体） */
export interface GetUserMeResponseDto {
  id: string
  username: string
  displayName: string
  /** 后端用户状态稳定编码：active | disabled（与前端 User 实体同形，直接透传） */
  status: 'active' | 'disabled'
  phone: string | null
  email: string | null
  lastLoginAt: string | null
  passwordUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  /** 所属部门投影（org 模块 G2 阶段未接入时为 null） */
  department?: UserDepartmentInfo | null
  /** 岗位投影（G2 阶段未接入时空数组） */
  posts?: UserPostInfo[]
}

/**
 * GET /me/menus 响应体的节点形态（规格 §6.3 v1.15）：后端 MenuTreeNode 的前端消费子集——
 * 菜单展示过滤只消费 path；title/icon 等呈现字段由前端静态路由定义承担，
 * 完整契约随菜单管理域接口对齐任务再行引入。
 */
export interface MeMenuNodeDto {
  /** 前端路由路径（可选；目录/link 节点可能为 null） */
  path: string | null
  children?: MeMenuNodeDto[] | null
}

/** GET /me/menus 响应体：当前用户启用角色聚合的可访问菜单树（无角色返回 []） */
export type GetMeMenusResponseDto = MeMenuNodeDto[]

/** GET /me/permissions 响应体：当前用户启用角色权限点并集 */
export interface GetPermissionsResponseDto {
  permissions: string[]
}

/** PUT /users/me 请求体（规格 §14.3 自助资料白名单：displayName/phone/email） */
export interface UpdateProfileRequestDto {
  displayName: string
  phone?: string
  email?: string
}

/** PUT /users/me/password 请求体；响应 204 无响应体 */
export interface ChangePasswordRequestDto {
  oldPassword: string
  newPassword: string
}

/** profile 聚合结果：跨层业务实体，直接复用权威定义 */
export type GetProfileResponseDto = ProfileData
