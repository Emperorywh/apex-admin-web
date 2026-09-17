/**
 * 认证域请求/响应 DTO（依据 OpenAPI：POST /fms/v1/auth/authorize/login、logout）。
 */

/** POST /auth/authorize/login 请求体（OpenAPI LoginParam；密码字段承载 MD5 摘要，见 G03） */
export interface LoginParamDto {
  username: string
  password: string
}

/**
 * POST /auth/authorize/login 响应 data（OpenAPI UserAuth）：
 * 登录一次返回构建会话所需的全部信息（规格 5.1）；后端无 /users/me、无刷新接口（G01/G02）。
 */
export interface UserAuthDto {
  /** 用户登录 token */
  token: string | null
  /** 系统是否已激活（false 时应引导至软件授权流程，P02 消费） */
  activated: boolean | null
  /** 用户摘要 */
  user: UserSummaryDto | null
  /** 用户角色编码列表 */
  roles: string[] | null
  /** 用户按钮权限码列表 */
  permissions: string[] | null
  /** 用户权限树（菜单数据源，T00.4 消费） */
  permissionsTree: AuthPermissionDto[] | null
}

/** 用户摘要（OpenAPI UserSummary） */
export interface UserSummaryDto {
  /** 用户 id（int64，JSON number 承载；实体层转字符串无损保存，精度缺口 G10 登记） */
  id: number
  username: string
  /** 用户状态 */
  state: 'ENABLED' | 'DISABLED' | null
  /** 用户等级 */
  level: number | null
}

/** 权限资源（OpenAPI AuthPermission；树形，parentCode 表达父子） */
export interface AuthPermissionDto {
  id: number | null
  createTime: string | null
  updateTime: string | null
  createUser: string | null
  updateUser: string | null
  /** 权限编码 */
  code: string | null
  /** 权限名称 */
  name: string | null
  /** 权限类型 */
  type: 'MENU' | 'BUTTON' | null
  /** 父权限编码 */
  parentCode: string | null
  /** 前端路由路径 */
  path: string | null
  /** 前端菜单图标 */
  icon: string | null
  sort: number | null
  state: 'ENABLED' | 'DISABLED' | null
  childPermissions: AuthPermissionDto[] | null
}
