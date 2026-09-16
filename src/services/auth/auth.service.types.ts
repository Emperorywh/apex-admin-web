/**
 * 认证域请求/响应 DTO：旧后端 /fms/v1/auth/authorize/* 协议。
 *
 * 字段契约对齐冻结源码（Login/index.tsx、types/Login/index.d.ts @ e570b8df）；
 * detail 响应的完整字段旧前端从未消费，按登录响应对称假设，
 * 真实字段以 T090 独立环境核验为准（见 docs/migration/contracts/identity.md）。
 */

import type { PermissionNode } from '@/types/auth/auth.types'

/** POST /fms/v1/auth/authorize/login 请求体；password 为源规则的 MD5 十六进制结果 */
export interface LoginRequestDto {
  username: string
  password: string
}

/** 登录响应 data：token 为不含 Bearer 前缀的原始值（源代码存储时补 "Bearer " 前缀） */
export interface AuthLoginDataDto {
  token: string
  /** 严格等于 false 才进入软件授权流程；字段缺失视为已激活 */
  activated?: boolean
  /** 菜单权限源：后端权限树 */
  permissionsTree?: PermissionNode[]
  /** 按钮权限源：后端平铺权限码数组（data.permissions，前端存储沿用源改名） */
  permissions?: string[]
}

/**
 * GET /fms/v1/auth/authorize/detail 响应 data：刷新恢复时重新核对身份与权限。
 * username/permissionsTree/permissions 为核对目标；字段缺失按"无法核对"处理。
 */
export interface AuthDetailDataDto {
  username?: string
  activated?: boolean
  permissionsTree?: PermissionNode[]
  permissions?: string[]
}
