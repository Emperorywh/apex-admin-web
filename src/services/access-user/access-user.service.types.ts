/**
 * 用户管理服务类型（P31 用户管理页；OpenAPI「用户控制类」+「角色控制类」）。
 *
 * AuthUserDto 对应 OpenAPI schema AuthUser（pageUsers 返回 records 元素）；
 * AuthRoleDto 对应 OpenAPI schema AuthRole（getRoles 返回 data 元素）。
 * 契约要点：
 * - id 为 int64 主键（G10：以保守类型承载，实际序列化形态以带令牌联验实证
 *   为准，展示层不做二次加工；行 ID 统一字符串化守卫精度）；
 * - state 为受控枚举 ENABLED/DISABLED（旧实现同源）：未知枚举按原值呈现，
 *   不猜语义（缺失/未知不参与 Switch 受控判定，呈现只读原值）；
 * - createTime/updateTime 协议为时间字符串，展示层经共享 displayDateTime
 *   转换（缺失留白），不改协议原值——时间语义遵循部署时区（G15）；
 * - 密码类字段（password/confirm）只在请求参数方向出现，永不落入列表 DTO、
 *   永不持久化（专项验收：密码不持久化）。
 */

/** 用户状态（旧实现同源受控枚举：启用 / 禁用） */
export type AuthUserState = 'ENABLED' | 'DISABLED'

/** 用户记录（pageUsers 返回 records 元素；字段与 OpenAPI AuthUser 一致） */
export interface AuthUserDto {
  /** 用户主键（int64；行 ID 来源，协议原样） */
  id?: number | string | null
  /** 创建时间（展示层 displayDateTime 转换、缺失留白） */
  createTime?: string | null
  /** 更新时间（展示层 displayDateTime 转换、缺失留白） */
  updateTime?: string | null
  /** 创建人（契约字段；旧版页面未展示，保留类型完整） */
  createUser?: string | null
  /** 更新人（契约字段；旧版页面未展示，保留类型完整） */
  updateUser?: string | null
  /** 用户名（登录账号；root 为系统内置超管，前端按 username 判定等价旧实现） */
  username?: string | null
  /** 状态（ENABLED/DISABLED；未知枚举原值呈现） */
  state?: string | null
}

/** 用户分页查询参数（GET pageUsers，query 平铺；旧实现同形态不归一化） */
export interface AuthUserPageParam {
  /** 当前页码（从 1 计数；页面用 toBackendPage 从零基 pageIndex 换算） */
  pageNo: number
  /** 每页数量 */
  pageSize: number
  /** 关键字（按用户名过滤；空条件裁剪不提交） */
  query?: string
}

/** 用户分页结果载体（与后端 ResultPageAuthUser.data 一致；仅消费业务字段） */
export interface AuthUserPageResult {
  records?: AuthUserDto[] | null
  total?: number | null
  size?: number | null
  current?: number | null
}

/** 新增用户参数（POST addUser JSON body）。
 * 形态对照实证（2026-09-20 P31 联验）：两字段（OpenAPI 形态）与三字段
 * （旧实现形态）后端均受理；confirm 提供时后端校验与 password 一致（不一致
 * 500）。按等价迁移保留旧实现三字段形态（password/confirm 均 MD5 摘要），
 * 前端一致性校验通过后才提交。 */
export interface AuthUserAddParam {
  /** 用户名（明文；4-16 位字母数字下划线，前端校验后提交） */
  username: string
  /** 密码（MD5 摘要后提交，明文不落协议日志） */
  password: string
  /** 确认密码（MD5 摘要后提交；旧实现等价形态，后端校验与 password 一致） */
  confirm: string
}

/** 修改用户状态参数（POST updateState JSON body；按 username 定位，旧实现同形态） */
export interface AuthUserUpdateStateParam {
  /** 目标用户名 */
  username: string
  /** 目标状态（ENABLED/DISABLED） */
  state: AuthUserState
}

/** 按用户 id 定位的通用参数（resetPassword/deleteUser 共用，OpenAPI AuthUserParam） */
export interface AuthUserIdParam {
  /** 用户主键 */
  id: number
}

/** 分配用户角色参数（POST assignRoles JSON body；OpenAPI AssignUserRolesParam） */
export interface AssignUserRolesParam {
  /** 目标用户主键 */
  userId: number
  /** 分配的角色主键集合（整组提交=整体替换语义，未勾选即移除） */
  roleIds: number[]
}

/** 角色记录（getRoles 返回 data 元素；字段与 OpenAPI AuthRole 一致） */
export interface AuthRoleDto {
  /** 角色主键（int64） */
  id?: number | string | null
  /** 创建时间（本页不展示，保留类型完整） */
  createTime?: string | null
  /** 更新时间（本页不展示，保留类型完整） */
  updateTime?: string | null
  /** 创建人（本页不展示，保留类型完整） */
  createUser?: string | null
  /** 更新人（本页不展示，保留类型完整） */
  updateUser?: string | null
  /** 角色编码 */
  code?: string | null
  /** 角色名称（分配弹窗展示名） */
  name?: string | null
  /** 状态（ENABLED/DISABLED；分配弹窗按旧实现不按状态过滤，原样列出） */
  state?: string | null
}

/** 查询角色列表参数（GET getRoles，query 平铺）。
 * 不带 userId → 全部角色（渲染候选）；带 userId → 该用户已分配角色（回显勾选），
 * 旧实现同源双查语义。 */
export interface AuthRoleQueryParam {
  /** 目标用户主键（回显已分配角色时携带） */
  userId?: number
}
