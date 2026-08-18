/**
 * 认证业务域实体（规格 §14.1，v1.14）。
 * 被 pages/features/services/store 跨层共享的权威定义；
 * 登录/刷新等请求/响应 DTO 随 service 任务放入 auth.service.types.ts。
 */
import type { User } from '@/types/system/user/user.types'

/**
 * 会话权限快照（规格 §5.1/§6.3 v1.15）：user 来自 GET /users/me，permCodes 来自
 * GET /me/permissions（启用角色权限点并集），menuPaths 来自 GET /me/menus
 * （菜单树节点 path 扁平化集合，null 表示不受菜单树限制）。
 * username 为 admin 的超管用户由前端注入 roleCodes ['admin']（通配语义，规格 §4.4），
 * 其余用户 roleCodes 为空数组（后端无当前用户角色码自助接口）。
 */
export interface ProfileData {
  user: User
  roleCodes: string[]
  permCodes: string[]
  /** 后端菜单树 path 白名单原始值（规范化比对在菜单过滤处统一进行）；null = 超管不受限 */
  menuPaths: string[] | null
}
