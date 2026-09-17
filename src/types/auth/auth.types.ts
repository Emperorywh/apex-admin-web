/**
 * 认证域跨层实体：登录会话。
 *
 * 会话由登录返回的 UserAuth 一次性构建（规格 5.1）：
 * token、激活状态、用户摘要、角色码、按钮权限码与权限树。
 * 权限树 DTO 作为权威定义从 auth.service.types 引用，禁止复制接口。
 */

import type { AuthPermissionDto } from '@/services/auth/auth.service.types'

/** 登录用户（由 UserSummaryDto 转换） */
export interface AuthUser {
  /** 用户 id：int64 以字符串无损承载（精度缺口 G10 登记） */
  id: string
  username: string
  /** 显示名：后端 UserSummary 未提供独立字段，取用户名 */
  displayName: string
  /** 账号状态（DISABLED 时不自动可用，由后端鉴权兜底） */
  state: 'ENABLED' | 'DISABLED'
  /** 用户等级 */
  level: number
  /** 头像展示用的姓名缩写（如 "YW"） */
  initials: string
}

/** 完整会话：持久化恢复与权限判断的统一来源 */
export interface AuthSession {
  /** 登录令牌；请求层以 Bearer 方式携带（G03 旧代码证据，待真实联调最终确认） */
  token: string
  /** 系统是否已激活；false 时应引导软件授权（P02 消费） */
  activated: boolean
  user: AuthUser
  /** 角色编码列表 */
  roles: string[]
  /** 按钮权限码列表（旧 flatPermissions） */
  permissions: string[]
  /** 权限树（菜单数据源，T00.4 消费） */
  permissionsTree: AuthPermissionDto[]
}
